/** Shared utility functions for all server-side game modules. */
'use strict';

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

function publicPlayers(room) {
  return room.players.map(({ name, score, ready }) => ({ name, score: score || 0, ready: !!ready }));
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

function determineWinner(room) {
  if (!room.players.length) return { winner: null, isTie: false };
  const maxScore = Math.max(...room.players.map(p => p.score || 0));
  const leaders = room.players.filter(p => (p.score || 0) === maxScore);
  return { winner: leaders.length === 1 ? leaders[0] : null, isTie: leaders.length > 1 };
}

function endGame(roomCode, io, rooms, gameLabel) {
  const room = rooms[roomCode];
  if (!room) return;
  clearAllGameTimers(room);
  const { winner, isTie } = determineWinner(room);
  const scores = buildScores(room);
  const statusMsg = isTie ? `It's a tie in ${gameLabel}!` : winner ? `Game over! ${winner.name} wins ${gameLabel} with ${winner.score} points!` : 'Game over!';
  const winnerMsg = isTie ? null : winner ? `${winner.name} wins ${gameLabel}!` : null;
  io.to(roomCode).emit('updateGameState', { scores, status: statusMsg, gameState: {} });
  io.to(roomCode).emit('gameOver', { winner: winnerMsg });
  io.to(roomCode).emit('updatePlayers', publicPlayers(room));
  room.gameState = {};
  room.timers = {};
  room.state = 'lobby';
}

module.exports = { buildScores, publicPlayers, shuffleArray, clearAllGameTimers, determineWinner, endGame };
