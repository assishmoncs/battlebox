const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../frontend')));

let rooms = {};

function getRoom(roomCode) {
  return rooms[roomCode];
}

function updateAllInRoom(roomCode) {
  const room = getRoom(roomCode);
  if (room) {
    io.to(roomCode).emit('updatePlayers', room.players);
    io.to(roomCode).emit('roomInfo', {
      game: room.game,
      hostId: room.host,
      hostName: room.players.find(p => p.id === room.host)?.name || null
    });
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
      status: room.state === 'playing' ? 'Game in progress' : 'Lobby'
    });
  }
}

function resetGame(roomCode) {
  const room = getRoom(roomCode);
  if (room) {
    room.players.forEach(p => p.score = 0);
    room.gameState = {};
    room.state = 'lobby';
    updateAllInRoom(roomCode);
  }
}

// Load game modules
const gameModules = {
  reaction: require('../games/reaction.js'),
  tictactoe: require('../games/tictactoe.js'),
  wordchain: require('../games/wordchain.js')
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ room: roomCode, game }, ack) => {
    rooms[roomCode] = {
      game: game || 'reaction',
      host: socket.id,
      players: [],
      state: 'lobby',
      gameState: {}
    };
    socket.join(roomCode);
    socket.emit('youAreHost', true); // Tell creator they are host
    io.to(roomCode).emit('roomInfo', { game: game || 'reaction', hostId: socket.id, hostName: null });
    if (typeof ack === 'function') {
      ack({ ok: true, room: roomCode });
    }
    console.log('Room created:', roomCode, game);
  });

  socket.on('joinRoom', ({ room: roomCode, playerName }) => {
    const room = getRoom(roomCode);
    if (!room) {
      return socket.emit('error', 'Room not found');
    }
    socket.join(roomCode);
    
    // Check if player already exists (reconnection scenario)
    const existingPlayer = room.players.find(p => p.name === playerName);
    if (existingPlayer) {
      // Update socket ID for reconnected player (preserve score)
      // If they were the host, update host reference
      if (existingPlayer.id === room.host) {
        room.host = socket.id;
      }
      existingPlayer.id = socket.id;
      console.log(`${playerName} reconnected to room:`, roomCode);
    } else {
      // New player joining
      room.players.push({ id: socket.id, name: playerName, score: 0 });
      console.log(`${playerName} joined room:`, roomCode);
    }

    // First player in an empty room becomes host
    if (!room.host || room.players.length === 1) {
      room.host = socket.id;
    }
    
    // Only the host gets the youAreHost signal
    if (socket.id === room.host) {
      socket.emit('youAreHost', true);
    }
    // Broadcast room info including game
    io.to(roomCode).emit('roomInfo', {
      game: room.game,
      hostId: room.host,
      hostName: room.players.find(p => p.id === room.host)?.name || null
    });
    
    // If game is in progress, send current game state to this client
    if (room.state === 'playing') {
      socket.emit('updateGameState', {
        gameState: room.gameState,
        scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
        status: 'Game in progress'
      });
    }
    
    updateAllInRoom(roomCode);
  });

  socket.on('startGame', (roomCode) => {
    const room = getRoom(roomCode);
    if (room && socket.id === room.host && room.state === 'lobby' && room.players.length >= 2) {
      room.state = 'playing';
      io.to(roomCode).emit('gameStarted');
      updateAllInRoom(roomCode);
      console.log('Game started in room', roomCode, 'game:', room.game);
      
      // Init game
      switch (room.game) {
        case 'reaction':
          gameModules.reaction(roomCode, io, rooms);
          break;
        case 'tictactoe':
          room.gameState = { board: Array(9).fill(null), currentTurn: 0 };
          updateAllInRoom(roomCode);
          break;
        case 'wordchain':
          room.gameState = { chain: [], currentPlayer: 0, lastLetter: 'a' };
          updateAllInRoom(roomCode);
          break;
      }
    } else {
      const reason = !room ? 'no room' : socket.id !== room.host ? 'not host' : room.state !== 'lobby' ? 'not lobby' : 'less than 2 players';
      socket.emit('error', `Cannot start: ${reason}`);
      console.log('Start game failed for', socket.id, 'in', roomCode, reason);
    }
  });

  socket.on('reactionClick', (roomCode) => {
    const room = getRoom(roomCode);
    if (room && room.game === 'reaction' && room.gameState.canClick) {
      const reactionTime = Date.now() - room.gameState.clickTime;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return socket.emit('error', 'Not in room');
      player.score += Math.max(0, 100 - reactionTime / 10);
      io.to(roomCode).emit('updateGameState', { status: `${player.name} clicked in ${reactionTime}ms!` });
      room.gameState.canClick = false;
      io.to(roomCode).emit('updateGameState', { status: `Clicked in ${reactionTime}ms!` });
      setTimeout(() => gameModules.reaction(roomCode, io, rooms), 2000);
    }
  });

  socket.on('gameMove', ({ room: roomCode, pos, word }) => {
    const room = getRoom(roomCode);
    if (!room || room.state !== 'playing') return socket.emit('error', 'Game not active');
    const currentIndex = 'currentTurn' in room.gameState ? room.gameState.currentTurn : room.gameState.currentPlayer;
    if (room.players[currentIndex]?.id !== socket.id) return socket.emit('error', 'Not your turn');
    switch (room.game) {
      case 'tictactoe':
        gameModules.tictactoe(roomCode, pos, io, rooms);
        break;
      case 'wordchain':
        gameModules.wordchain(roomCode, word, io, rooms);
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let roomCode in rooms) {
      const room = getRoom(roomCode);
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.host === socket.id) {
        room.host = room.players[0]?.id || null;
      }
      io.to(roomCode).emit('roomInfo', {
        game: room.game,
        hostId: room.host,
        hostName: room.players.find(p => p.id === room.host)?.name || null
      });
      updateAllInRoom(roomCode);
      if (room.players.length === 0) {
        delete rooms[roomCode];
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
