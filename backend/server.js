const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../frontend')));

// Room and game state management
let rooms = {};
const disconnectTimers = {};
const RECONNECTION_GRACE_PERIOD_MS = 15000;
const MAX_PLAYERS_PER_ROOM = 8;

// Rate limiting
const rateLimits = {};
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 10; // max 10 requests per second

function sanitizeName(name) {
  return (String(name || '').trim().substring(0, 20)) || 'Anonymous';
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function buildScores(room) {
  if (!room || !room.players) return {};
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
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

function checkRateLimit(socketId) {
  const now = Date.now();
  if (!rateLimits[socketId]) {
    rateLimits[socketId] = { count: 1, windowStart: now };
    return true;
  }
  
  if (now - rateLimits[socketId].windowStart > RATE_LIMIT_WINDOW) {
    rateLimits[socketId] = { count: 1, windowStart: now };
    return true;
  }
  
  if (rateLimits[socketId].count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  rateLimits[socketId].count++;
  return true;
}

// Load game modules
const gameModules = {
  reaction: require('../games/reaction.js'),
  tictactoe: require('../games/tictactoe.js'),
  wordchain: require('../games/wordchain.js'),
  mathduel: require('../games/mathduel.js'),
  rpsarena: require('../games/rpsarena.js'),
  anagram: require('../games/anagram.js'),
  numberhunt: require('../games/numberhunt.js'),
  memorymatch: require('../games/memorymatch.js'),
  speedtyping: require('../games/speedtyping.js'),
  colormatch: require('../games/colormatch.js'),
  simonsays: require('../games/simonsays.js'),
  trivia: require('../games/trivia.js')
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ room: roomCode, game, playerName }, ack) => {
    try {
      if (!checkRateLimit(socket.id)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Rate limit exceeded' });
        return;
      }
      
      if (!roomCode || !game) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room data' });
        return;
      }
      
      if (!gameModules[game]) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid game type' });
        return;
      }
      
      const safeName = sanitizeName(playerName);
      rooms[roomCode] = {
        game: game,
        host: socket.id,
        players: [{ id: socket.id, name: safeName, score: 0, ready: false }],
        state: 'lobby',
        gameState: {},
        createdAt: Date.now()
      };
      
      socket.join(roomCode);
      socket.emit('youAreHost', true);
      
      if (typeof ack === 'function') {
        ack({ ok: true, room: roomCode });
      }
      
      console.log('Room created:', roomCode, game, 'by', safeName);
      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('Error creating room:', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Server error' });
    }
  });

  socket.on('joinRoom', ({ room: roomCode, playerName }) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit('error', 'Rate limit exceeded');
        return;
      }
      
      const room = getRoom(roomCode);
      if (!room) {
        return socket.emit('error', 'Room not found');
      }
      
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        return socket.emit('error', 'Room is full (max 8 players)');
      }
      
      if (room.state === 'playing') {
        return socket.emit('error', 'Game already in progress');
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
        room.players.push({ id: socket.id, name: safeName, score: 0, ready: false });
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
    } catch (err) {
      console.error('Error joining room:', err);
      socket.emit('error', 'Server error');
    }
  });

  socket.on('playerReady', ({ room: roomCode, ready }) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = ready;
        updateAllInRoom(roomCode);
      }
    } catch (err) {
      console.error('Error updating ready status:', err);
    }
  });

  socket.on('chatMessage', ({ room: roomCode, message, playerName }) => {
    try {
      if (!checkRateLimit(socket.id)) return;
      
      const room = getRoom(roomCode);
      if (!room) return;
      
      const safeMessage = String(message || '').trim().substring(0, 200);
      if (!safeMessage) return;
      
      io.to(roomCode).emit('chatMessage', { playerName: sanitizeName(playerName), message: safeMessage });
    } catch (err) {
      console.error('Error sending chat message:', err);
    }
  });

  socket.on('startGame', (roomCode) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit('error', 'Rate limit exceeded');
        return;
      }
      
      const room = getRoom(roomCode);
      if (!room) return socket.emit('error', 'Room not found');
      if (socket.id !== room.host) return socket.emit('error', 'Only the host can start the game');
      if (room.state !== 'lobby') return socket.emit('error', 'Game already in progress');
      if (room.players.length < 2) return socket.emit('error', 'Need at least 2 players to start');

      room.state = 'playing';
      // Reset scores and ready status for a fresh game
      room.players.forEach(p => { 
        p.score = 0; 
        p.ready = false;
      });
      
      io.to(roomCode).emit('gameStarted');
      console.log('Game started in room', roomCode, 'game:', room.game);

      // Initialize game-specific state
      switch (room.game) {
        case 'reaction':
          room.gameState = { round: 0, canClick: false, waiting: false };
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
            status: `${first.name}'s turn - word starting with "A"`,
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
        case 'memorymatch': {
          room.gameState = { 
            cards: [], 
            flipped: [], 
            matched: [], 
            currentPlayer: 0,
            matches: {},
            totalMatches: 0
          };
          gameModules.memorymatch(roomCode, io, rooms);
          break;
        }
        case 'speedtyping': {
          room.gameState = { 
            currentWord: '', 
            currentPlayer: 0, 
            completed: {},
            round: 1,
            maxRounds: 10
          };
          gameModules.speedtyping(roomCode, io, rooms);
          break;
        }
        case 'colormatch': {
          room.gameState = { 
            round: 1, 
            maxRounds: 10,
            currentDisplay: null,
            answered: {}
          };
          gameModules.colormatch(roomCode, io, rooms);
          break;
        }
        case 'simonsays': {
          room.gameState = { 
            sequence: [], 
            playerIndex: 0,
            showingSequence: false,
            round: 1
          };
          gameModules.simonsays(roomCode, io, rooms);
          break;
        }
        case 'trivia': {
          room.gameState = { 
            currentQuestion: 0,
            maxQuestions: 15,
            answered: {},
            scores: {}
          };
          gameModules.trivia(roomCode, io, rooms);
          break;
        }
      }
      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('Error starting game:', err);
      socket.emit('error', 'Failed to start game');
    }
  });

  socket.on('reactionClick', (roomCode) => {
    try {
      const room = getRoom(roomCode);
      if (!room || room.game !== 'reaction' || !room.gameState.canClick) return;
      
      // Anti-cheat: check if clicked too early
      if (room.gameState.waiting) {
        socket.emit('error', 'Too early! Wait for green.');
        return;
      }
      
      // Prevent double-click exploit
      if (room.gameState.clicked) {
        socket.emit('error', 'Already clicked this round!');
        return;
      }
      
      room.gameState.clicked = true;
      
      // Clear the miss timeout since someone clicked
      if (room.gameState.missTimeoutRef) {
        clearTimeout(room.gameState.missTimeoutRef);
        room.gameState.missTimeoutRef = null;
      }
      
      const reactionTime = Date.now() - room.gameState.clickTime;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return socket.emit('error', 'Not in room');
      
      room.gameState.canClick = false;
      const points = Math.max(0, Math.round(100 - reactionTime / 10));
      player.score += points;
      
      io.to(roomCode).emit('updateGameState', {
        scores: buildScores(room),
        status: `${player.name} clicked in ${reactionTime}ms! (+${points} pts)`,
        lastClick: { player: player.name, time: reactionTime }
      });
      io.to(roomCode).emit('updatePlayers', room.players);
      
      setTimeout(() => gameModules.reaction(roomCode, io, rooms), 2000);
    } catch (err) {
      console.error('Error in reaction click:', err);
    }
  });

  socket.on('gameMove', ({ room: roomCode, pos, word, answer, choice, guess, cardIndex, typed, color, sequence, option }) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit('error', 'Rate limit exceeded');
        return;
      }
      
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
        case 'memorymatch':
          if (room.players[room.gameState.currentPlayer || 0]?.id !== socket.id) {
            return socket.emit('error', 'Not your turn');
          }
          gameModules.memorymatch(roomCode, io, rooms, { playerId: socket.id, cardIndex });
          break;
        case 'speedtyping':
          gameModules.speedtyping(roomCode, io, rooms, { playerId: socket.id, typed });
          break;
        case 'colormatch':
          gameModules.colormatch(roomCode, io, rooms, { playerId: socket.id, color });
          break;
        case 'simonsays':
          gameModules.simonsays(roomCode, io, rooms, { playerId: socket.id, sequence });
          break;
        case 'trivia':
          gameModules.trivia(roomCode, io, rooms, { playerId: socket.id, option });
          break;
      }
    } catch (err) {
      console.error('Error processing game move:', err);
      socket.emit('error', 'Invalid move');
    }
  });

  socket.on('requestRematch', (roomCode) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return;
      if (socket.id !== room.host) return;
      
      room.state = 'lobby';
      room.gameState = {};
      room.players.forEach(p => { 
        p.score = 0; 
        p.ready = false;
      });
      
      io.to(roomCode).emit('rematchAvailable');
      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('Error requesting rematch:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up rate limit data
    delete rateLimits[socket.id];
    
    for (const roomCode in rooms) {
      const room = getRoom(roomCode);
      if (!room) continue;
      const wasInRoom = room.players.some(p => p.id === socket.id);
      if (!wasInRoom) continue;

      // Give the player a grace period to reconnect
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
      }, RECONNECTION_GRACE_PERIOD_MS);
    }
  });
});

// Cleanup old rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const roomCode in rooms) {
    const room = rooms[roomCode];
    if (room.state === 'lobby' && now - room.createdAt > 3600000) { // 1 hour
      delete rooms[roomCode];
      console.log('Cleaned up inactive room:', roomCode);
    }
  }
}, 600000); // Every 10 minutes

server.listen(3000, () => {
  console.log('BattleBox Server running on http://localhost:3000');
  console.log('Available games:', Object.keys(gameModules).join(', '));
});
