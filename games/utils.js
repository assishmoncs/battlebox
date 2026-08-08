/**
 * Shared utility functions for all game modules.
 * Centralises duplicated helpers that previously existed in every game file.
 */

'use strict';

/**
 * Build a { playerName: score } map from a room's players array.
 * @param {object} room
 * @returns {object}
 */
function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

/**
 * Fisher-Yates in-place shuffle (returns a new array).
 * @param {Array} arr
 * @returns {Array}
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Clear all timers stored on room.timers and reset the timers object.
 * Call this before wiping room.gameState so no orphaned callbacks fire later.
 * @param {object} room
 */
function clearAllGameTimers(room) {
  if (!room.timers) return;
  for (const key of Object.keys(room.timers)) {
    const ref = room.timers[key];
    if (ref !== null && ref !== undefined) {
      clearTimeout(ref);
      clearInterval(ref);
    }
    delete room.timers[key];
  }
}

/**
 * Determine the winner(s) from a room's players by score.
 * Returns { winner, isTie } where winner is null on a tie.
 * @param {object} room
 * @returns {{ winner: object|null, isTie: boolean }}
 */
function determineWinner(room) {
  if (!room.players.length) return { winner: null, isTie: false };
  const maxScore = Math.max(...room.players.map(p => p.score || 0));
  const leaders = room.players.filter(p => (p.score || 0) === maxScore);
  return {
    winner: leaders.length === 1 ? leaders[0] : null,
    isTie: leaders.length > 1
  };
}

/**
 * Safely end a game: clear timers, reset room state, emit gameOver.
 * @param {string} roomCode
 * @param {object} io
 * @param {object} rooms
 * @param {string} gameLabel  Human-readable game name
 */
function endGame(roomCode, io, rooms, gameLabel) {
  const room = rooms[roomCode];
  if (!room) return;

  clearAllGameTimers(room);

  const { winner, isTie } = determineWinner(room);
  const scores = buildScores(room);

  let statusMsg, winnerMsg;
  if (isTie) {
    statusMsg = `It's a tie! Everyone's level.`;
    winnerMsg = null;
  } else if (winner) {
    statusMsg = `Game over! ${winner.name} wins ${gameLabel} with ${winner.score} points!`;
    winnerMsg = `${winner.name} wins ${gameLabel}!`;
  } else {
    statusMsg = 'Game over!';
    winnerMsg = null;
  }

  io.to(roomCode).emit('updateGameState', { scores, status: statusMsg, gameState: {} });
  io.to(roomCode).emit('gameOver', { winner: winnerMsg });
  io.to(roomCode).emit('updatePlayers', room.players.map(({ name, score, ready }) => ({ name, score, ready })));

  room.gameState = {};
  room.timers = {};
  room.state = 'lobby';
}

module.exports = { buildScores, shuffleArray, clearAllGameTimers, determineWinner, endGame };
