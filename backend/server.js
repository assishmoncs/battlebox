'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const helmet     = require('helmet');
const crypto     = require('crypto');

const { clearAllGameTimers } = require('../games/utils');

const app    = express();
const server = http.createServer(app);

// ─── HTTP Security Headers (SEC-06) ────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", 'https://fonts.googleapis.com'],
        styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc:     ["'self'", 'data:']
      }
    },
    crossOriginEmbedderPolicy: false // allow Socket.IO transport
  })
);

// ─── Socket.IO (SEC-01: restrict CORS to configured origin) ────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout:  60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Health check endpoint (ARCH-04) ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    activeRooms: Object.keys(rooms).length,
    uptime:      process.uptime()
  });
});

// ─── In-memory state ────────────────────────────────────────────────────────
let rooms = {};
const disconnectTimers = {};

const RECONNECTION_GRACE_PERIOD_MS = 15000;
const MAX_PLAYERS_PER_ROOM         = 8;
const RATE_LIMIT_WINDOW            = 1000;  // ms
const RATE_LIMIT_MAX               = 10;

// ─── Rate limiter keyed on IP (SEC-07 fix: not bypassable via reconnect) ───
const rateLimits = {};

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimits[ip]) {
    rateLimits[ip] = { count: 1, windowStart: now };
    return true;
  }
  if (now - rateLimits[ip].windowStart > RATE_LIMIT_WINDOW) {
    rateLimits[ip] = { count: 1, windowStart: now };
    return true;
  }
  if (rateLimits[ip].count >= RATE_LIMIT_MAX) return false;
  rateLimits[ip].count++;
  return true;
}

// Periodically prune stale rate-limit entries (memory hygiene)
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW * 2;
  for (const ip of Object.keys(rateLimits)) {
    if (rateLimits[ip].windowStart < cutoff) delete rateLimits[ip];
  }
}, 60000);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeName(name) {
  return (String(name || '').trim().substring(0, 20)) || 'Anonymous';
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function findPlayerByName(room, playerName) {
  if (!room || !room.players) return null;
  return room.players.find(p => p.name === playerName) || null;
}

function buildScores(room) {
  if (!room || !room.players) return {};
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

/**
 * Broadcast the room player list with socket IDs stripped (PERF-03 / privacy fix).
 */
function safePlayerList(room) {
  return room.players.map(({ name, score, ready }) => ({ name, score, ready }));
}

function updateAllInRoom(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  const host = room.players.find(p => p.id === room.host);
  io.to(roomCode).emit('roomInfo', {
    game:     room.game,
    hostId:   room.host,
    hostName: host ? host.name : null
  });
  // Strip socket IDs from player list (privacy fix)
  io.to(roomCode).emit('updatePlayers', safePlayerList(room));
}

/**
 * Generate a cryptographically random 4-char room code (SEC-03 fix).
 * Uses crypto.randomBytes instead of Math.random().
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars
  let code = '';
  const bytes = crypto.randomBytes(4);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

/**
 * Safe cleanup: clear all game timers then wipe state (BUG-06 / BUG-10 fix).
 */
function resetRoomToLobby(room) {
  clearAllGameTimers(room);
  room.gameState = {};
  room.timers    = {};
  room.state     = 'lobby';
  room.players.forEach(p => { p.score = 0; p.ready = false; });
}

// ─── Game modules ─────────────────────────────────────────────────────────────
const gameModules = {
  reaction:    require('../games/reaction'),
  tictactoe:   require('../games/tictactoe'),
  wordchain:   require('../games/wordchain'),
  mathduel:    require('../games/mathduel'),
  rpsarena:    require('../games/rpsarena'),
  anagram:     require('../games/anagram'),
  numberhunt:  require('../games/numberhunt'),
  memorymatch: require('../games/memorymatch'),
  speedtyping: require('../games/speedtyping'),
  colormatch:  require('../games/colormatch'),
  simonsays:   require('../games/simonsays'),
  trivia:      require('../games/trivia')
};

// Initial game states (QUAL-03 fix: decoupled from the startGame mega-switch)
const initialGameStates = {
  reaction:    () => ({ round: 0, canClick: false, waiting: false }),
  tictactoe:   () => ({ board: Array(9).fill(null), currentTurn: 0 }),
  wordchain:   () => ({ chain: [], currentPlayer: 0, lastLetter: 'a', usedWords: [] }),
  mathduel:    () => ({ currentPlayer: 0, turn: 1, maxTurns: 12 }),
  rpsarena:    () => ({ round: 1, maxRounds: 5, choices: {} }),
  anagram:     () => ({ currentPlayer: 0, round: 1, maxRounds: 10 }),
  numberhunt:  () => ({ round: 1, maxRounds: 6, guesses: {}, target: null }),
  memorymatch: () => ({ cards: [], flipped: [], matched: [], currentPlayer: 0, matches: {}, totalMatches: 0, lockBoard: false }),
  speedtyping: () => ({ currentWord: '', currentPlayer: 0, completed: {}, round: 1, maxRounds: 10 }),
  colormatch:  () => ({ round: 1, maxRounds: 10, currentDisplay: null, answered: {} }),
  simonsays:   () => ({ sequence: [], playerIndex: 0, showingSequence: false, round: 1 }),
  trivia:      () => ({ currentQuestion: 0, maxQuestions: 15, answered: {}, scores: {} })
};

// ─── Socket events ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`[connect] ${socket.id} from ${clientIp}`);

  // ── createRoom ──────────────────────────────────────────────────────────
  socket.on('createRoom', ({ game, playerName }, ack) => {
    try {
      if (!checkRateLimit(clientIp)) {
        return ack?.({ ok: false, error: 'Rate limit exceeded' });
      }

      if (!game || !gameModules[game]) {
        return ack?.({ ok: false, error: 'Invalid game type' });
      }

      // SEC-03: room code generated server-side with crypto
      const roomCode = generateRoomCode();
      const safeName = sanitizeName(playerName);

      rooms[roomCode] = {
        game,
        host:      socket.id,
        players:   [{ id: socket.id, name: safeName, score: 0, ready: false }],
        state:     'lobby',
        gameState: {},
        timers:    {},
        createdAt: Date.now()
      };

      socket.join(roomCode);
      socket.emit('youAreHost', true);

      console.log(`[createRoom] ${roomCode} (${game}) by ${safeName}`);
      ack?.({ ok: true, room: roomCode });
      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('[createRoom] error:', err);
      ack?.({ ok: false, error: 'Server error' });
    }
  });

  // ── joinRoom ─────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ room: roomCode, playerName }) => {
    try {
      if (!checkRateLimit(clientIp)) {
        return socket.emit('error', 'Rate limit exceeded');
      }

      const room = getRoom(roomCode);
      if (!room) return socket.emit('error', 'Room not found');

      const safeName  = sanitizeName(playerName);
      const existing  = findPlayerByName(room, safeName);
      const isRejoining = !!existing;

      if (room.state === 'playing' && !isRejoining) {
        return socket.emit('error', 'Game already in progress');
      }
      if (!isRejoining && room.players.length >= MAX_PLAYERS_PER_ROOM) {
        return socket.emit('error', `Room is full (max ${MAX_PLAYERS_PER_ROOM} players)`);
      }

      socket.join(roomCode);

      if (isRejoining) {
        if (disconnectTimers[existing.id]) {
          clearTimeout(disconnectTimers[existing.id]);
          delete disconnectTimers[existing.id];
        }
        if (existing.id === room.host) room.host = socket.id;
        existing.id = socket.id;
        console.log(`[rejoin] ${safeName} in room ${roomCode}`);
      } else {
        room.players.push({ id: socket.id, name: safeName, score: 0, ready: false });
        console.log(`[join] ${safeName} joined room ${roomCode}`);
      }

      // Ensure valid host
      if (!room.host || !room.players.find(p => p.id === room.host)) {
        room.host = room.players[0]?.id ?? null;
      }

      if (socket.id === room.host) socket.emit('youAreHost', true);

      if (room.state === 'playing') {
        socket.emit('updateGameState', {
          gameState: room.gameState,
          scores:    buildScores(room),
          status:    'Reconnected — game in progress'
        });
      }

      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('[joinRoom] error:', err);
      socket.emit('error', 'Server error');
    }
  });

  // ── playerReady ───────────────────────────────────────────────────────────
  socket.on('playerReady', ({ room: roomCode, ready }) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = !!ready;
        updateAllInRoom(roomCode);
      }
    } catch (err) {
      console.error('[playerReady] error:', err);
    }
  });

  // ── chatMessage ───────────────────────────────────────────────────────────
  // SEC-02 fix: playerName is derived from server record, never trusted from client
  socket.on('chatMessage', ({ room: roomCode, message }) => {
    try {
      if (!checkRateLimit(clientIp)) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // Derive name from authoritative server record
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return; // sender not in room

      const safeMessage = String(message || '').trim().substring(0, 200);
      if (!safeMessage) return;

      io.to(roomCode).emit('chatMessage', {
        playerName: player.name,  // authoritative, not from client
        message:    safeMessage
      });
    } catch (err) {
      console.error('[chatMessage] error:', err);
    }
  });

  // ── startGame ─────────────────────────────────────────────────────────────
  socket.on('startGame', (roomCode) => {
    try {
      if (!checkRateLimit(clientIp)) return socket.emit('error', 'Rate limit exceeded');

      const room = getRoom(roomCode);
      if (!room)                    return socket.emit('error', 'Room not found');
      if (socket.id !== room.host)  return socket.emit('error', 'Only the host can start the game');
      if (room.state !== 'lobby')   return socket.emit('error', 'Game already in progress');
      if (room.players.length < 2)  return socket.emit('error', 'Need at least 2 players to start');

      // Clear any lingering timers from a previous game (BUG-06)
      clearAllGameTimers(room);

      room.state     = 'playing';
      room.timers    = {};
      room.gameState = initialGameStates[room.game]?.() ?? {};
      room.players.forEach(p => { p.score = 0; p.ready = false; });
      room.startedAt = Date.now();

      io.to(roomCode).emit('gameStarted');
      console.log(`[startGame] room ${roomCode} game: ${room.game}`);

      // Delegate to game module (all now use consistent initialState)
      gameModules[room.game](roomCode, io, rooms);

      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('[startGame] error:', err);
      socket.emit('error', 'Failed to start game');
    }
  });

  // ── reactionClick ─────────────────────────────────────────────────────────
  socket.on('reactionClick', (roomCode) => {
    try {
      const room = getRoom(roomCode);
      if (!room || room.game !== 'reaction' || !room.gameState.canClick) return;

      if (room.gameState.waiting) {
        socket.emit('error', 'Too early! Wait for green.');
        return;
      }
      if (room.gameState.clicked) {
        socket.emit('error', 'Already clicked this round!');
        return;
      }

      room.gameState.clicked = true;

      // Cancel miss timeout
      if (room.timers?.reactionMiss) {
        clearTimeout(room.timers.reactionMiss);
        room.timers.reactionMiss = null;
      }

      const reactionTime = Date.now() - room.gameState.clickTime;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return socket.emit('error', 'Not in room');

      room.gameState.canClick = false;
      const points = Math.max(0, Math.round(100 - reactionTime / 10));
      player.score += points;

      io.to(roomCode).emit('updateGameState', {
        scores:    buildScores(room),
        status:    `${player.name} clicked in ${reactionTime}ms! (+${points} pts)`,
        lastClick: { player: player.name, time: reactionTime }
      });
      io.to(roomCode).emit('updatePlayers', safePlayerList(room));

      const currentRound = room.gameState.round;
      room.timers.reactionNext = setTimeout(() =>
        gameModules.reaction.nextRound
          ? gameModules.reaction.nextRound(roomCode, io, rooms, currentRound)
          : gameModules.reaction(roomCode, io, rooms),
      2000);
    } catch (err) {
      console.error('[reactionClick] error:', err);
    }
  });

  // ── gameMove (QUAL-04: single switch dispatches to typed modules) ──────────
  socket.on('gameMove', (payload) => {
    try {
      if (!checkRateLimit(clientIp)) return socket.emit('error', 'Rate limit exceeded');

      const { room: roomCode, pos, word, answer, choice, guess,
              cardIndex, typed, color, sequence, option } = payload || {};

      const room = getRoom(roomCode);
      if (!room)                   return socket.emit('error', 'Room not found');
      if (room.state !== 'playing') return socket.emit('error', 'Game is not active');

      const gs = room.gameState;

      switch (room.game) {
        case 'tictactoe':
          if (room.players[gs.currentTurn ?? 0]?.id !== socket.id)
            return socket.emit('error', 'Not your turn');
          gameModules.tictactoe(roomCode, pos, io, rooms);
          break;

        case 'wordchain':
          if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id)
            return socket.emit('error', 'Not your turn');
          gameModules.wordchain(roomCode, word, io, rooms);
          break;

        case 'mathduel':
          if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id)
            return socket.emit('error', 'Not your turn');
          gameModules.mathduel(roomCode, io, rooms, answer);
          break;

        case 'rpsarena':
          gameModules.rpsarena(roomCode, io, rooms, { playerId: socket.id, choice });
          break;

        case 'anagram':
          if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id)
            return socket.emit('error', 'Not your turn');
          gameModules.anagram(roomCode, io, rooms, guess);
          break;

        case 'numberhunt':
          gameModules.numberhunt(roomCode, io, rooms, { playerId: socket.id, guess });
          break;

        case 'memorymatch':
          if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id)
            return socket.emit('error', 'Not your turn');
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

        default:
          socket.emit('error', 'Unknown game');
      }
    } catch (err) {
      console.error('[gameMove] error:', err);
      socket.emit('error', 'Invalid move');
    }
  });

  // ── requestRematch ────────────────────────────────────────────────────────
  socket.on('requestRematch', (roomCode) => {
    try {
      const room = getRoom(roomCode);
      if (!room || socket.id !== room.host) return;

      // BUG-06/BUG-10: clear all timers before wiping state
      resetRoomToLobby(room);

      io.to(roomCode).emit('rematchAvailable');
      updateAllInRoom(roomCode);
    } catch (err) {
      console.error('[requestRematch] error:', err);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);

    for (const roomCode of Object.keys(rooms)) {
      const room = getRoom(roomCode);
      if (!room) continue;
      if (!room.players.some(p => p.id === socket.id)) continue;

      const leavingId = socket.id;
      disconnectTimers[leavingId] = setTimeout(() => {
        delete disconnectTimers[leavingId];
        const r = getRoom(roomCode);
        if (!r) return;
        if (!r.players.some(p => p.id === leavingId)) return; // already reconnected

        r.players = r.players.filter(p => p.id !== leavingId);

        if (r.players.length === 0) {
          clearAllGameTimers(r);
          delete rooms[roomCode];
          return;
        }

        if (r.host === leavingId) {
          r.host = r.players[0].id;
          io.to(roomCode).emit('roomInfo', {
            game:     r.game,
            hostId:   r.host,
            hostName: r.players[0].name
          });
          io.to(r.host).emit('youAreHost', true);
        }

        if (r.state === 'playing' && r.players.length < 2) {
          clearAllGameTimers(r);
          r.state     = 'lobby';
          r.gameState = {};
          r.timers    = {};
          io.to(roomCode).emit('gameOver', {
            winner: `${r.players[0]?.name || 'Remaining player'} wins (opponent left)`
          });
        }

        updateAllInRoom(roomCode);
      }, RECONNECTION_GRACE_PERIOD_MS);
    }
  });
});

// ─── Periodic room cleanup (BUG-09 fix: also cleans playing rooms) ──────────
setInterval(() => {
  const now = Date.now();
  for (const roomCode of Object.keys(rooms)) {
    const room = rooms[roomCode];
    const age  = now - (room.startedAt || room.createdAt || 0);

    // Lobby rooms older than 1 hour
    if (room.state === 'lobby' && now - room.createdAt > 3_600_000) {
      clearAllGameTimers(room);
      delete rooms[roomCode];
      console.log(`[cleanup] removed idle lobby room ${roomCode}`);
    }
    // Playing rooms older than 3 hours (zombie guard — BUG-09)
    else if (room.state === 'playing' && age > 10_800_000) {
      clearAllGameTimers(room);
      io.to(roomCode).emit('gameOver', { winner: null });
      delete rooms[roomCode];
      console.log(`[cleanup] removed zombie game room ${roomCode}`);
    }
  }
}, 600_000); // every 10 minutes

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BattleBox Server running on http://localhost:${PORT}`);
  console.log('Available games:', Object.keys(gameModules).join(', '));
  console.log('CORS origin:', ALLOWED_ORIGIN);
});

module.exports = { app, server, io, rooms }; // exported for testing
