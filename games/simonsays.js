'use strict';

const { buildScores, endGame } = require('./utils');

const COLORS = ['red', 'blue', 'green', 'yellow'];

function generateSequence(length) {
  return Array.from({ length }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
}

module.exports = function simonsays(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.timers) room.timers = {};

  // Initialise
  if (!room.gameState.sequence || room.gameState.sequence.length === 0) {
    room.gameState.sequence = generateSequence(3);
    room.gameState.playerSequence = {};
    room.gameState.showingSequence = true;
    room.gameState.round = 1;
    room.gameState.eliminated = {};
    room.players.forEach(p => { room.gameState.playerSequence[p.id] = []; });

    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Watch the pattern! Round ${room.gameState.round}`,
      currentPlayerId: null
    });

    room.timers.simonReveal = setTimeout(() => {
      const r = rooms[roomCode];
      if (!r || r.state !== 'playing') return;
      r.gameState.showingSequence = false;
      io.to(roomCode).emit('updateGameState', {
        gameState: r.gameState,
        scores: buildScores(r),
        status: `Repeat the pattern! All active players must match`,
        currentPlayerId: null
      });
    }, 2000 + room.gameState.sequence.length * 600);
    return;
  }

  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: room.gameState.showingSequence ? 'Watch the pattern!' : 'Repeat the pattern!',
      currentPlayerId: null
    });
    return;
  }

  const { playerId, sequence } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player || room.gameState.eliminated[playerId]) return;

  if (room.gameState.showingSequence) {
    io.to(playerId).emit('error', 'Wait for the pattern to finish');
    return;
  }

  const color = Array.isArray(sequence) ? sequence[0] : null;
  if (!COLORS.includes(color)) {
    io.to(playerId).emit('error', 'Invalid color');
    return;
  }

  const playerSeq = room.gameState.playerSequence[playerId];
  const expectedColor = room.gameState.sequence[playerSeq.length];

  if (color !== expectedColor) {
    room.gameState.eliminated[playerId] = true;
    player.score = Math.max(0, (player.score || 0) - 2);
    io.to(playerId).emit('error', `Wrong! You are eliminated this round.`);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${player.name} made a mistake!`,
      currentPlayerId: null
    });
  } else {
    playerSeq.push(color);
  }

  // Check if active player finished sequence
  const activePlayers = room.players.filter(p => !room.gameState.eliminated[p.id]);
  const allDone = activePlayers.every(p =>
    (room.gameState.playerSequence[p.id] || []).length >= room.gameState.sequence.length
  );

  if (!allDone) return;

  // All active players completed (or were eliminated)
  if (activePlayers.length <= 1 || room.gameState.round >= 8) {
    // Award surviving players
    activePlayers.forEach(p => { p.score += 5 * room.gameState.round; });
    io.to(roomCode).emit('updatePlayers', room.players);
    endGame(roomCode, io, rooms, 'Simon Says');
    return;
  }

  // Next round — longer sequence
  room.gameState.round += 1;
  room.gameState.sequence = generateSequence(2 + room.gameState.round);
  room.gameState.playerSequence = {};
  room.gameState.eliminated = {};
  room.gameState.showingSequence = true;
  room.players.forEach(p => { room.gameState.playerSequence[p.id] = []; });

  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(room),
    status: `Round ${room.gameState.round} — Watch the longer pattern!`,
    currentPlayerId: null
  });

  room.timers.simonReveal = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing') return;
    r.gameState.showingSequence = false;
    io.to(roomCode).emit('updateGameState', {
      gameState: r.gameState,
      scores: buildScores(r),
      status: 'Repeat the pattern!',
      currentPlayerId: null
    });
  }, 2000 + room.gameState.sequence.length * 600);
};
