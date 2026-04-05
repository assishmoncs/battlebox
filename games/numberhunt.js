function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
}

module.exports = function(roomCode, io, rooms, payload) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  room.gameState.round = room.gameState.round || 1;
  room.gameState.maxRounds = room.gameState.maxRounds || 6;
  room.gameState.guesses = room.gameState.guesses || {};

  if (!room.gameState.target) {
    room.gameState.target = Math.floor(Math.random() * 21) + 10;
  }

  if (!payload) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, target: null },
      scores: buildScores(room),
      status: `Round ${room.gameState.round}/${room.gameState.maxRounds} — Guess a number between 10 and 30`
    });
    return;
  }

  const player = room.players.find(p => p.id === payload.playerId);
  if (!player) return;

  const guess = Number(payload.guess);
  if (!Number.isInteger(guess) || guess < 10 || guess > 30) {
    io.to(payload.playerId).emit('error', 'Guess must be an integer from 10 to 30');
    return;
  }

  room.gameState.guesses[payload.playerId] = guess;

  const allSubmitted = room.players.every(p => room.gameState.guesses[p.id] !== undefined);
  if (!allSubmitted) {
    const count = room.players.filter(p => room.gameState.guesses[p.id] !== undefined).length;
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, target: null },
      scores: buildScores(room),
      status: `${count}/${room.players.length} guesses locked for round ${room.gameState.round}`
    });
    return;
  }

  const target = room.gameState.target;
  const ranked = room.players
    .map(p => ({ player: p, diff: Math.abs(room.gameState.guesses[p.id] - target) }))
    .sort((a, b) => a.diff - b.diff);

  if (ranked[0]) ranked[0].player.score += 4;
  if (ranked[1]) ranked[1].player.score += 2;

  const summary = room.players
    .map(p => `${p.name}: ${room.gameState.guesses[p.id]}`)
    .join(', ');

  io.to(roomCode).emit('updatePlayers', room.players);

  if (room.gameState.round >= room.gameState.maxRounds) {
    const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, target: null },
      scores: buildScores(room),
      status: `Target was ${target}. ${summary}. Game over! ${winner.name} wins Number Hunt with ${winner.score} points!`
    });
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Number Hunt!` });
    room.gameState = {};
    room.state = 'lobby';
    return;
  }

  room.gameState.round += 1;
  room.gameState.guesses = {};
  room.gameState.target = Math.floor(Math.random() * 21) + 10;

  io.to(roomCode).emit('updateGameState', {
    gameState: { ...room.gameState, target: null },
    scores: buildScores(room),
    status: `Target was ${target}. ${summary}. Next: round ${room.gameState.round}/${room.gameState.maxRounds}`
  });
};
