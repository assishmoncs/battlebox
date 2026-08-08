'use strict';

const { buildScores, clearAllGameTimers, endGame } = require('./utils');

/**
 * Reaction Battle – fastest click wins each round.
 * Fixes: timer leaks on rematch, phantom rounds after gameOver.
 */
module.exports = function startReactionRound(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing' || room.game !== 'reaction') return;

  if (!room.timers) room.timers = {};

  // Clear any lingering timers from a prior round
  clearTimeout(room.timers.reactionGo);
  clearTimeout(room.timers.reactionMiss);

  const waitTime = Math.random() * 3000 + 2000;
  room.gameState.waiting = true;
  room.gameState.canClick = false;
  room.gameState.clicked = false;
  room.gameState.round = (room.gameState.round || 0) + 1;

  const currentRound = room.gameState.round;

  io.to(roomCode).emit('updateGameState', {
    scores: buildScores(room),
    status: `Round ${currentRound}/5 — Get ready…`,
    gameState: { round: currentRound }
  });

  room.timers.reactionGo = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing' || r.gameState.round !== currentRound) return;

    r.gameState.waiting = false;
    r.gameState.canClick = true;
    r.gameState.clickTime = Date.now();

    io.to(roomCode).emit('updateGameState', {
      scores: buildScores(r),
      status: 'GO! Click now! 🎯',
      gameState: { round: currentRound }
    });

    // Miss timeout — nobody clicked in time
    r.timers.reactionMiss = setTimeout(() => {
      const r2 = rooms[roomCode];
      if (!r2 || !r2.gameState.canClick || r2.gameState.round !== currentRound || r2.gameState.clicked) return;
      r2.gameState.canClick = false;
      io.to(roomCode).emit('updateGameState', {
        scores: buildScores(r2),
        status: 'Too slow! Nobody clicked in time.',
        gameState: { round: currentRound }
      });
      nextReactionRound(roomCode, io, rooms, currentRound);
    }, 3000);
  }, waitTime);
};

function nextReactionRound(roomCode, io, rooms, completedRound) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;
  if (room.gameState.round !== completedRound) return; // stale callback guard

  if (room.gameState.round >= 5) {
    endGame(roomCode, io, rooms, 'Reaction Battle');
    return;
  }

  room.timers = room.timers || {};
  room.timers.reactionNext = setTimeout(() => {
    module.exports(roomCode, io, rooms);
  }, 2000);
}

// Export nextReactionRound so server.js click handler can call it
module.exports.nextRound = nextReactionRound;
