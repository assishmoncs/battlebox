const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../frontend')));

let rooms = {};
const disconnectTimers = {};
const RECONNECTION_GRACE_PERIOD_MS = 15000;

function sanitizeName(name) {
  return (String(name || '').trim().substring(0, 20)) || 'Anonymous';
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
}

function updateAllInRoom(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  const host = room.players.find(p => p.id === room.host);
  // Emit roomInfo first so clients have hostId before rendering the player list
  io.to(roomCode).emit('roomInfo', {
    game: room.game,
    hostId: room.host,
    hostName: host ? host.name : null
  });
  io.to(roomCode).emit('updatePlayers', room.players);
}

// Load game modules
const gameModules = {
  reaction: require('../games/reaction.js'),
  tictactoe: require('../games/tictactoe.js'),
  wordchain: require('../games/wordchain.js'),
  mathduel: require('../games/mathduel.js'),
  rpsarena: require('../games/rpsarena.js'),
  anagram: require('../games/anagram.js'),
  numberhunt: require('../games/numberhunt.js')
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ room: roomCode, game, playerName }, ack) => {
    if (!roomCode || !game) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room data' });
      return;
    }
    const safeName = sanitizeName(playerName);
    rooms[roomCode] = {
      game: game || 'reaction',
      host: socket.id,
      players: [{ id: socket.id, name: safeName, score: 0 }],
      state: 'lobby',
      gameState: {}
    };
    socket.join(roomCode);
    socket.emit('youAreHost', true);
    if (typeof ack === 'function') {
      ack({ ok: true, room: roomCode });
    }
    console.log('Room created:', roomCode, game, 'by', safeName);
    updateAllInRoom(roomCode);
  });

  socket.on('joinRoom', ({ room: roomCode, playerName }) => {
    const room = getRoom(roomCode);
    if (!room) {
      return socket.emit('error', 'Room not found');
    }
    const safeName = sanitizeName(playerName);
    socket.join(roomCode);

    // Check if player already exists (reconnection by name)
    const existingPlayer = room.players.find(p => p.name === safeName);
    if (existingPlayer) {
      // Cancel any pending removal from a recent disconnect
      if (disconnectTimers[existingPlayer.id]) {
        clearTimeout(disconnectTimers[existingPlayer.id]);
        delete disconnectTimers[existingPlayer.id];
      }
      if (existingPlayer.id === room.host) {
        room.host = socket.id;
      }
      existingPlayer.id = socket.id;
      console.log(`${safeName} reconnected to room:`, roomCode);
    } else {
      room.players.push({ id: socket.id, name: safeName, score: 0 });
      console.log(`${safeName} joined room:`, roomCode);
    }

    // Ensure room has a valid host
    if (!room.host || !room.players.find(p => p.id === room.host)) {
      room.host = room.players[0] ? room.players[0].id : null;
    }

    if (socket.id === room.host) {
      socket.emit('youAreHost', true);
    }

    // Send current game state to reconnecting/new player
    if (room.state === 'playing') {
      socket.emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: 'Game in progress'
      });
    }

    updateAllInRoom(roomCode);
  });

  socket.on('startGame', (roomCode) => {
    const room = getRoom(roomCode);
    if (!room) return socket.emit('error', 'Room not found');
    if (socket.id !== room.host) return socket.emit('error', 'Only the host can start the game');
    if (room.state !== 'lobby') return socket.emit('error', 'Game already in progress');
    if (room.players.length < 2) return socket.emit('error', 'Need at least 2 players to start');

    room.state = 'playing';
    // Reset scores for a fresh game
    room.players.forEach(p => p.score = 0);
    io.to(roomCode).emit('gameStarted');
    console.log('Game started in room', roomCode, 'game:', room.game);

    switch (room.game) {
      case 'reaction':
        room.gameState = { round: 0 };
        gameModules.reaction(roomCode, io, rooms);
        break;
      case 'tictactoe': {
        room.gameState = { board: Array(9).fill(null), currentTurn: 0 };
        const first = room.players[0];
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `${first.name}'s turn (X)`,
          currentPlayerId: first.id
        });
        break;
      }
      case 'wordchain': {
        room.gameState = { chain: [], currentPlayer: 0, lastLetter: 'a', usedWords: [] };
        const first = room.players[0];
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `${first.name}'s turn — word starting with "A"`,
          currentPlayerId: first.id
        });
        break;
      }
      case 'mathduel': {
        room.gameState = { currentPlayer: 0, turn: 1, maxTurns: 12 };
        gameModules.mathduel(roomCode, io, rooms);
        break;
      }
      case 'rpsarena': {
        room.gameState = { round: 1, maxRounds: 5, choices: {} };
        gameModules.rpsarena(roomCode, io, rooms);
        break;
      }
      case 'anagram': {
        room.gameState = { currentPlayer: 0, round: 1, maxRounds: 10 };
        gameModules.anagram(roomCode, io, rooms);
        break;
      }
      case 'numberhunt': {
        room.gameState = { round: 1, maxRounds: 6, guesses: {}, target: null };
        gameModules.numberhunt(roomCode, io, rooms);
        break;
      }
    }
    updateAllInRoom(roomCode);
  });

  socket.on('reactionClick', (roomCode) => {
    const room = getRoom(roomCode);
    if (!room || room.game !== 'reaction' || !room.gameState.canClick) return;
    const reactionTime = Date.now() - room.gameState.clickTime;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return socket.emit('error', 'Not in room');
    room.gameState.canClick = false;
    player.score += Math.max(0, Math.round(100 - reactionTime / 10));
    io.to(roomCode).emit('updateGameState', {
      scores: buildScores(room),
      status: `${player.name} clicked in ${reactionTime}ms! (+${Math.max(0, Math.round(100 - reactionTime / 10))} pts)`
    });
    io.to(roomCode).emit('updatePlayers', room.players);
    setTimeout(() => gameModules.reaction(roomCode, io, rooms), 2000);
  });

  socket.on('gameMove', ({ room: roomCode, pos, word, answer, choice, guess }) => {
    const room = getRoom(roomCode);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.state !== 'playing') return socket.emit('error', 'Game is not active');
    switch (room.game) {
      case 'tictactoe':
        if (room.players[room.gameState.currentTurn || 0]?.id !== socket.id) {
          return socket.emit('error', 'Not your turn');
        }
        gameModules.tictactoe(roomCode, pos, io, rooms);
        break;
      case 'wordchain':
        if (room.players[room.gameState.currentPlayer || 0]?.id !== socket.id) {
          return socket.emit('error', 'Not your turn');
        }
        gameModules.wordchain(roomCode, word, io, rooms);
        break;
      case 'mathduel':
        if (room.players[room.gameState.currentPlayer || 0]?.id !== socket.id) {
          return socket.emit('error', 'Not your turn');
        }
        gameModules.mathduel(roomCode, io, rooms, answer);
        break;
      case 'rpsarena':
        gameModules.rpsarena(roomCode, io, rooms, { playerId: socket.id, choice });
        break;
      case 'anagram':
        if (room.players[room.gameState.currentPlayer || 0]?.id !== socket.id) {
          return socket.emit('error', 'Not your turn');
        }
        gameModules.anagram(roomCode, io, rooms, guess);
        break;
      case 'numberhunt':
        gameModules.numberhunt(roomCode, io, rooms, { playerId: socket.id, guess });
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomCode in rooms) {
      const room = getRoom(roomCode);
      if (!room) continue;
      const wasInRoom = room.players.some(p => p.id === socket.id);
      if (!wasInRoom) continue;

      // Give the player a grace period to reconnect (e.g. navigating lobby → game)
      // before actually removing them and potentially ending the game.
      const leavingId = socket.id;
      disconnectTimers[leavingId] = setTimeout(() => {
        delete disconnectTimers[leavingId];
        const r = getRoom(roomCode);
        if (!r) return;
        // If the player already reconnected their id will have changed; skip removal.
        if (!r.players.some(p => p.id === leavingId)) return;

        r.players = r.players.filter(p => p.id !== leavingId);

        if (r.players.length === 0) {
          delete rooms[roomCode];
          return;
        }

        // Reassign host if needed
        if (r.host === leavingId) {
          r.host = r.players[0].id;
          io.to(roomCode).emit('roomInfo', {
            game: r.game,
            hostId: r.host,
            hostName: r.players[0].name
          });
          io.to(r.host).emit('youAreHost', true);
        }

        // End game if not enough players remain
        if (r.state === 'playing' && r.players.length < 2) {
          r.state = 'lobby';
          r.gameState = {};
          io.to(roomCode).emit('gameOver', { winner: `${r.players[0]?.name || 'Remaining player'} wins (opponent left)` });
        }

        updateAllInRoom(roomCode);
      }, RECONNECTION_GRACE_PERIOD_MS); // grace period for reconnection
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
