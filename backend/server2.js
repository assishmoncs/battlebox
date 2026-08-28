'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const { RoomManager } = require('./room-manager');
const { definitions, modules, initialGameStates, getGame } = require('../games/registry');
const { clearAllGameTimers, buildScores } = require('../games/utils');
const { sanitizeName, normalizeRoom, isPlainObject, intInRange, payloadSizeOk, stringInSet } = require('./validation');

const app = express();
const server = http.createServer(app);

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;
const MAX_PAYLOAD_BYTES = 16 * 1024;
const roomManager = new RoomManager({ maxPlayers: 8, reconnectGraceMs: 15000 });

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://fonts.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      imgSrc: ["'self'", 'data:']
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeRooms: Object.keys(roomManager.rooms).length, uptime: process.uptime() });
});
app.get('/ready', (_req, res) => {
  res.status(200).json({ status: 'ready' });
});
app.get('/api/games', (_req, res) => res.json({ games: definitions.map(({ module, initialState, ...publicMeta }) => publicMeta) }));

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: MAX_PAYLOAD_BYTES,
  pingTimeout: 60000,
  pingInterval: 25000
});

const rateLimits = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || now - current.start >= windowMs) {
    rateLimits.set(key, { start: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, item] of rateLimits) if (item.start < cutoff) rateLimits.delete(key);
}, 60000).unref();
setInterval(() => roomManager.cleanup(), 60000).unref();

function safePlayerList(room) {
  return room.players.map(({ name, score, ready }) => ({ name, score: score || 0, ready: !!ready }));
}

function broadcastRoom(roomCode) {
  const room = roomManager.get(roomCode);
  if (!room) return;
  const host = room.players.find(p => p.id === room.host);
  io.to(roomCode).emit('roomInfo', { game: room.game, hostId: room.host, hostName: host?.name || null });
  io.to(roomCode).emit('updatePlayers', safePlayerList(room));
}

function publicGameState(gameId, state) {
  if (!state || typeof state !== 'object') return {};
  if (gameId === 'memorymatch') {
    const flipped = new Set(state.flipped || []);
    const matched = new Set(state.matched || []);
    const cards = Array.isArray(state.cards)
      ? state.cards.map((value, index) => (flipped.has(index) || matched.has(index)) ? value : null)
      : [];
    return { ...state, cards };
  }
  if (gameId === 'trivia') {
    const questions = Array.isArray(state.questions) ? state.questions : [];
    const q = questions[state.currentQuestion] || {};
    return {
      currentQuestion: state.currentQuestion,
      timer: state.timer,
      answered: state.answered || {},
      question: q.q,
      options: q.options || []
    };
  }
  const copy = JSON.parse(JSON.stringify(state));
  for (const key of ['target', 'answer', 'correctAnswer', 'secret', 'solution']) delete copy[key];
  if (copy.questions) delete copy.questions;
  return copy;
}

function playerInRoom(room, socketId) {
  return room?.players.find(p => p.id === socketId) || null;
}

function emitError(socket, message) {
  socket.emit('error', message);
}

function startModule(roomCode) {
  const room = roomManager.get(roomCode);
  if (!room) return;
  const module = modules[room.game];
  if (typeof module !== 'function') throw new Error(`Game module missing: ${room.game}`);
  module(roomCode, io, roomManager.rooms);
}

function dispatchMove(roomCode, socket, payload) {
  const room = roomManager.get(roomCode);
  if (!room || room.state !== 'playing') return emitError(socket, 'Game is not active');
  if (!isPlainObject(payload)) return emitError(socket, 'Invalid move payload');
  const player = playerInRoom(room, socket.id);
  if (!player) return emitError(socket, 'Not in room');

  const gs = room.gameState;
  const game = room.game;
  switch (game) {
    case 'tictactoe': {
      if (!intInRange(payload.pos, 0, 8)) return emitError(socket, 'Invalid board position');
      if (room.players[gs.currentTurn ?? 0]?.id !== socket.id) return emitError(socket, 'Not your turn');
      return modules.tictactoe(roomCode, payload.pos, io, roomManager.rooms, socket.id);
    }
    case 'wordchain': {
      if (typeof payload.word !== 'string' || payload.word.length > 30) return emitError(socket, 'Invalid word');
      if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id) return emitError(socket, 'Not your turn');
      return modules.wordchain(roomCode, payload.word, io, roomManager.rooms, socket.id);
    }
    case 'mathduel': {
      if (!Number.isFinite(Number(payload.answer))) return emitError(socket, 'Invalid answer');
      if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id) return emitError(socket, 'Not your turn');
      return modules.mathduel(roomCode, io, roomManager.rooms, payload.answer);
    }
    case 'rpsarena':
      if (!stringInSet(payload.choice, ['rock', 'paper', 'scissors'])) return emitError(socket, 'Invalid choice');
      return modules.rpsarena(roomCode, io, roomManager.rooms, { playerId: socket.id, choice: payload.choice });
    case 'anagram':
      if (typeof payload.guess !== 'string' || payload.guess.length > 30) return emitError(socket, 'Invalid guess');
      if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id) return emitError(socket, 'Not your turn');
      return modules.anagram(roomCode, io, roomManager.rooms, payload.guess);
    case 'numberhunt':
      if (!intInRange(payload.guess, 10, 30)) return emitError(socket, 'Guess must be an integer from 10 to 30');
      return modules.numberhunt(roomCode, io, roomManager.rooms, { playerId: socket.id, guess: payload.guess });
    case 'memorymatch':
      if (!intInRange(payload.cardIndex, 0, 15)) return emitError(socket, 'Invalid card index');
      if (room.players[gs.currentPlayer ?? 0]?.id !== socket.id) return emitError(socket, 'Not your turn');
      return modules.memorymatch(roomCode, io, roomManager.rooms, { playerId: socket.id, cardIndex: payload.cardIndex });
    case 'speedtyping':
      if (typeof payload.typed !== 'string' || payload.typed.length > 60) return emitError(socket, 'Invalid typing payload');
      return modules.speedtyping(roomCode, io, roomManager.rooms, { playerId: socket.id, typed: payload.typed });
    case 'colormatch':
      if (!stringInSet(payload.color, ['red', 'blue', 'green', 'yellow'])) return emitError(socket, 'Invalid color');
      return modules.colormatch(roomCode, io, roomManager.rooms, { playerId: socket.id, color: payload.color });
    case 'simonsays':
      if (!Array.isArray(payload.sequence) || payload.sequence.length > 12 || payload.sequence.some(v => !stringInSet(v, ['red', 'blue', 'green', 'yellow']))) return emitError(socket, 'Invalid sequence');
      return modules.simonsays(roomCode, io, roomManager.rooms, { playerId: socket.id, sequence: payload.sequence });
    case 'trivia':
      if (!intInRange(payload.option, 0, 3)) return emitError(socket, 'Invalid answer option');
      return modules.trivia(roomCode, io, roomManager.rooms, { playerId: socket.id, option: payload.option });
    case 'connectfour':
      if (!intInRange(payload.column, 0, 6)) return emitError(socket, 'Invalid column');
      return modules.connectfour(roomCode, io, roomManager.rooms, { playerId: socket.id, column: payload.column });
    case 'higherlower':
      if (!stringInSet(payload.choice, ['higher', 'lower'])) return emitError(socket, 'Invalid choice');
      return modules.higherlower(roomCode, io, roomManager.rooms, { playerId: socket.id, choice: payload.choice });
    case 'oddoneout':
      if (!intInRange(payload.index, 0, 8)) return emitError(socket, 'Invalid tile');
      return modules.oddoneout(roomCode, io, roomManager.rooms, { playerId: socket.id, index: payload.index });
    default:
      return emitError(socket, 'Unknown game');
  }
}

io.on('connection', socket => {
  const ip = socket.handshake.address || 'unknown';

  socket.on('createRoom', (payload, ack) => {
    try {
      if (!rateLimit(`create:${ip}`, 5, 60000)) return ack?.({ ok: false, error: 'Too many room creation attempts' });
      if (!isPlainObject(payload) || !payloadSizeOk(payload)) return ack?.({ ok: false, error: 'Invalid payload' });
      const game = getGame(payload.game);
      const name = sanitizeName(payload.playerName);
      if (!game) return ack?.({ ok: false, error: 'Invalid game type' });
      if (!name) return ack?.({ ok: false, error: 'Gamertag must be 2–20 characters and use letters, numbers, spaces, hyphens or underscores' });

      const code = roomManager.create(game.id, { id: socket.id, sessionId: require('crypto').randomUUID(), name, score: 0, ready: false });
      socket.join(code);
      ack?.({ ok: true, room: code });
      socket.emit('youAreHost', true);
      broadcastRoom(code);
    } catch (error) {
      console.error('[createRoom]', error);
      ack?.({ ok: false, error: 'Server error' });
    }
  });

  socket.on('joinRoom', payload => {
    try {
      if (!rateLimit(`join:${ip}`, 20, 60000)) return emitError(socket, 'Too many join attempts');
      if (!isPlainObject(payload) || !payloadSizeOk(payload)) return emitError(socket, 'Invalid payload');
      const code = normalizeRoom(payload.room);
      const name = sanitizeName(payload.playerName);
      if (!code || !name) return emitError(socket, 'Invalid room code or gamertag');
      const room = roomManager.get(code);
      if (!room) return emitError(socket, 'Room not found');
      const game = getGame(room.game);
      const isRejoin = room.players.some(p => p.name.toLowerCase() === name.toLowerCase());
      if (isRejoin) {
        const result = roomManager.rejoin(code, name, socket.id);
        if (!result.ok) return emitError(socket, result.error);
      } else {
        if (room.state === 'playing') return emitError(socket, 'Game already in progress');
        if (room.players.length >= game.maxPlayers) return emitError(socket, `Room is full (max ${game.maxPlayers} players)`);
        const result = roomManager.addPlayer(code, { id: socket.id, sessionId: require('crypto').randomUUID(), name, score: 0, ready: false });
        if (!result.ok) return emitError(socket, result.error);
      }
      socket.join(code);
      if (room.state === 'playing') socket.emit('updateGameState', { gameState: publicGameState(room.game, room.gameState), scores: buildScores(room), status: 'Reconnected — game in progress' });
      if (socket.id === room.host) socket.emit('youAreHost', true);
      broadcastRoom(code);
    } catch (error) {
      console.error('[joinRoom]', error);
      emitError(socket, 'Server error');
    }
  });

  socket.on('playerReady', payload => {
    if (!isPlainObject(payload)) return;
    const code = normalizeRoom(payload.room);
    const room = code && roomManager.get(code);
    const player = room && playerInRoom(room, socket.id);
    if (!room || !player) return;
    player.ready = !!payload.ready;
    broadcastRoom(code);
  });

  socket.on('chatMessage', payload => {
    if (!rateLimit(`chat:${ip}`, 8, 1000)) return emitError(socket, 'Chat rate limit exceeded');
    if (!isPlainObject(payload) || !payloadSizeOk(payload, 2048)) return emitError(socket, 'Invalid message');
    const code = normalizeRoom(payload.room);
    const room = code && roomManager.get(code);
    const player = room && playerInRoom(room, socket.id);
    const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, 200) : '';
    if (!room || !player || !message) return;
    io.to(code).emit('chatMessage', { playerName: player.name, message });
  });

  socket.on('startGame', roomCodeRaw => {
    if (!rateLimit(`start:${ip}`, 10, 1000)) return emitError(socket, 'Rate limit exceeded');
    const code = normalizeRoom(roomCodeRaw);
    const room = code && roomManager.get(code);
    if (!room) return emitError(socket, 'Room not found');
    if (socket.id !== room.host) return emitError(socket, 'Only the host can start the game');
    const game = getGame(room.game);
    if (!game) return emitError(socket, 'Unknown game');
    const started = roomManager.start(code, initialGameStates[game.id]?.() || {});
    if (!started.ok) return emitError(socket, started.error);
    clearAllGameTimers(room);
    io.to(code).emit('gameStarted');
    startModule(code);
    broadcastRoom(code);
  });

  socket.on('reactionClick', roomCodeRaw => {
    const code = normalizeRoom(roomCodeRaw);
    const room = code && roomManager.get(code);
    if (!room || room.state !== 'playing' || room.game !== 'reaction') return;
    const player = playerInRoom(room, socket.id);
    if (!player || !room.gameState.canClick) return;
    if (room.gameState.waiting) return emitError(socket, 'Too early! Wait for green.');
    if (room.gameState.clicked) return emitError(socket, 'Already clicked this round!');
    room.gameState.clicked = true;
    if (room.timers?.reactionMiss) { clearTimeout(room.timers.reactionMiss); room.timers.reactionMiss = null; }
    const reactionTime = Date.now() - room.gameState.clickTime;
    const points = Math.max(0, Math.round(100 - reactionTime / 10));
    room.gameState.canClick = false;
    player.score += points;
    io.to(code).emit('updateGameState', { scores: buildScores(room), status: `${player.name} clicked in ${reactionTime}ms! (+${points} pts)` });
    io.to(code).emit('updatePlayers', safePlayerList(room));
    const round = room.gameState.round;
    room.timers.reactionNext = setTimeout(() => modules.reaction.nextRound?.(code, io, roomManager.rooms, round), 2000);
  });

  socket.on('gameMove', payload => {
    try {
      if (!rateLimit(`move:${socket.id}`, 30, 1000)) return emitError(socket, 'Move rate limit exceeded');
      if (!isPlainObject(payload) || !payloadSizeOk(payload)) return emitError(socket, 'Invalid move payload');
      const code = normalizeRoom(payload.room);
      if (!code) return emitError(socket, 'Invalid room code');
      dispatchMove(code, socket, payload);
    } catch (error) {
      console.error('[gameMove]', error);
      emitError(socket, 'Invalid move');
    }
  });

  socket.on('requestRematch', roomCodeRaw => {
    const code = normalizeRoom(roomCodeRaw);
    const room = code && roomManager.get(code);
    if (!room || socket.id !== room.host) return;
    roomManager.reset(code);
    io.to(code).emit('rematchAvailable');
    broadcastRoom(code);
  });

  socket.on('disconnect', () => {
    roomManager.removeSocket(socket.id, event => {
      if (!event.code) return;
      if (event.type === 'game_aborted') io.to(event.code).emit('gameOver', { winner: `${event.room.players[0]?.name || 'Remaining player'} wins (opponent left)` });
      if (event.type === 'player_removed') {
        if (event.room.players[0] && !event.room.players.find(p => p.id === event.room.host)) {
          event.room.host = event.room.players[0].id;
          io.to(event.code).emit('roomInfo', { game: event.room.game, hostId: event.room.host, hostName: event.room.players[0].name });
          io.to(event.room.host).emit('youAreHost', true);
        }
        broadcastRoom(event.code);
      }
    });
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`BattleBox listening on port ${PORT}`));
}

module.exports = { app, server, io, roomManager, rateLimit, publicGameState };
