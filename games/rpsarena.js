function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
}

function normalizeChoice(choice) {
  const v = String(choice || '').toLowerCase().trim();
  return ['rock', 'paper', 'scissors'].includes(v) ? v : null;
}

function decideWinner(a, b) {
  if (a === b) return 0;
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 1;
  return -1;
}

module.exports = function(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  const round = room.gameState.round || 1;
  const maxRounds = room.gameState.maxRounds || 5;
  room.gameState.choices = room.gameState.choices || {};

  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, round, maxRounds },
      scores: buildScores(room),
      status: `Round ${round}/${maxRounds} — Pick rock, paper, or scissors`
    });
    return;
  }

  const player = room.players.find(p => p.id === move.playerId);
  if (!player) return;
  const choice = normalizeChoice(move.choice);
  if (!choice) {
    io.to(move.playerId).emit('error', 'Choose rock, paper, or scissors');
    return;
  }

  room.gameState.choices[move.playerId] = choice;

  const submitted = room.players.filter(p => room.gameState.choices[p.id]);
  if (submitted.length < room.players.length) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, round, maxRounds },
      scores: buildScores(room),
      status: `${submitted.length}/${room.players.length} players locked in for round ${round}`
    });
    return;
  }

  const [p1, p2] = room.players;
  const c1 = room.gameState.choices[p1.id];
  const c2 = room.gameState.choices[p2.id];
  const result = decideWinner(c1, c2);

  let status;
  if (result === 1) {
    p1.score += 3;
    status = `Round ${round}: ${p1.name} wins (${c1} beats ${c2})`;
  } else if (result === -1) {
    p2.score += 3;
    status = `Round ${round}: ${p2.name} wins (${c2} beats ${c1})`;
  } else {
    p1.score += 1;
    p2.score += 1;
    status = `Round ${round}: tie (${c1} vs ${c2})`;
  }

  io.to(roomCode).emit('updatePlayers', room.players);

  if (round >= maxRounds) {
    const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Game over! ${winner.name} wins RPS Arena with ${winner.score} points!`
    });
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins RPS Arena!` });
    room.gameState = {};
    room.state = 'lobby';
    return;
  }

  room.gameState.round = round + 1;
  room.gameState.choices = {};
  io.to(roomCode).emit('updateGameState', {
    gameState: { ...room.gameState, round: room.gameState.round, maxRounds },
    scores: buildScores(room),
    status: `${status}. Next: round ${room.gameState.round}/${maxRounds}`
  });
};
