'use strict';

const crypto = require('crypto');
const { clearAllGameTimers } = require('../games/utils');

const ROOM_STATES = Object.freeze({ LOBBY: 'lobby', PLAYING: 'playing' });
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class RoomManager {
  constructor({ maxPlayers = 8, reconnectGraceMs = 15000, log = console } = {}) {
    this.rooms = Object.create(null);
    this.disconnectTimers = Object.create(null);
    this.maxPlayers = maxPlayers;
    this.reconnectGraceMs = reconnectGraceMs;
    this.log = log;
  }

  generateCode() {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += ROOM_CODE_CHARS[crypto.randomInt(0, ROOM_CODE_CHARS.length)];
      }
    } while (this.rooms[code]);
    return code;
  }

  create(game, player) {
    const code = this.generateCode();
    const now = Date.now();
    this.rooms[code] = { game, host: player.id, players: [player], state: ROOM_STATES.LOBBY, gameState: {}, timers: {}, createdAt: now, startedAt: null };
    return { code, sessionId: player.sessionId };
  }

  get(code) { return this.rooms[code]; }
  has(code) { return !!this.rooms[code]; }

  addPlayer(code, player) {
    const room = this.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.state === ROOM_STATES.PLAYING) return { ok: false, error: 'Game already in progress' };
    if (room.players.length >= this.maxPlayers) return { ok: false, error: `Room is full (max ${this.maxPlayers} players)` };
    if (room.players.some(p => p.name.toLowerCase() === player.name.toLowerCase())) return { ok: false, error: 'That gamertag is already in the room' };
    room.players.push(player);
    return { ok: true, rejoined: false };
  }

  rejoin(code, sessionId, name, socketId) {
    const room = this.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    const player = room.players.find(p => p.sessionId === sessionId && p.name.toLowerCase() === name.toLowerCase());
    if (!player) return { ok: false, error: 'Player session not found' };
    if (this.disconnectTimers[player.id]) {
      clearTimeout(this.disconnectTimers[player.id]);
      delete this.disconnectTimers[player.id];
    }
    const oldId = player.id;
    player.id = socketId;
    if (room.host === oldId) room.host = socketId;
    return { ok: true, rejoined: true, player };
  }

  start(code, gameState) {
    const room = this.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.state !== ROOM_STATES.LOBBY) return { ok: false, error: 'Game already in progress' };
    if (room.players.length < 2) return { ok: false, error: 'Need at least 2 players to start' };
    room.state = ROOM_STATES.PLAYING;
    room.gameState = gameState || {};
    room.startedAt = Date.now();
    room.players.forEach(p => { p.score = 0; p.ready = false; });
    return { ok: true, room };
  }

  reset(code) {
    const room = this.get(code);
    if (!room) return;
    clearAllGameTimers(room);
    room.gameState = {};
    room.timers = {};
    room.state = ROOM_STATES.LOBBY;
    room.startedAt = null;
    room.players.forEach(p => { p.score = 0; p.ready = false; });
  }

  removeSocket(socketId, onChange) {
    for (const [code, room] of Object.entries(this.rooms)) {
      const player = room.players.find(p => p.id === socketId);
      if (!player) continue;
      this.disconnectTimers[socketId] = setTimeout(() => {
        delete this.disconnectTimers[socketId];
        const current = this.get(code);
        if (!current || !current.players.some(p => p.id === socketId)) return;
        const wasHost = current.host === socketId;
        current.players = current.players.filter(p => p.id !== socketId);
        if (current.players.length === 0) {
          clearAllGameTimers(current);
          delete this.rooms[code];
          onChange?.({ type: 'room_deleted', code });
          return;
        }
        if (wasHost) current.host = current.players[0].id;
        if (current.state === ROOM_STATES.PLAYING && current.players.length < 2) {
          clearAllGameTimers(current);
          current.state = ROOM_STATES.LOBBY;
          current.gameState = {};
          current.timers = {};
          onChange?.({ type: 'game_aborted', code, room: current, hostChanged: wasHost });
          return;
        }
        onChange?.({ type: 'player_removed', code, room: current, hostChanged: wasHost });
      }, this.reconnectGraceMs);
    }
  }

  cleanup(maxLobbyAgeMs = 60 * 60 * 1000, maxPlayingAgeMs = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [code, room] of Object.entries(this.rooms)) {
      const age = now - (room.startedAt || room.createdAt);
      const limit = room.state === ROOM_STATES.PLAYING ? maxPlayingAgeMs : maxLobbyAgeMs;
      if (age > limit) {
        clearAllGameTimers(room);
        delete this.rooms[code];
      }
    }
  }
}

module.exports = { RoomManager, ROOM_STATES };