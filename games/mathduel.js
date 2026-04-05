const QUESTIONS = [
  { q: '7 + 6', a: 13 },
  { q: '9 + 8', a: 17 },
  { q: '12 - 5', a: 7 },
  { q: '15 - 9', a: 6 },
  { q: '6 × 4', a: 24 },
  { q: '7 × 3', a: 21 },
  { q: '20 ÷ 5', a: 4 },
  { q: '18 ÷ 3', a: 6 },
  { q: '11 + 14', a: 25 },
  { q: '30 - 13', a: 17 },
  { q: '8 × 5', a: 40 },
  { q: '27 ÷ 9', a: 3 }
];

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
}

function finalizeGame(roomCode, io, room) {
  const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(room),
    status: `Game over! ${winner.name} wins Math Duel with ${winner.score} points!`
  });
  io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Math Duel!` });
  io.to(roomCode).emit('updatePlayers', room.players);
  room.gameState = {};
  room.state = 'lobby';
}

module.exports = function(roomCode, io, rooms, answer) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.gameState.questions) {
    room.gameState.questions = QUESTIONS.sort(() => Math.random() - 0.5).slice(0, room.gameState.maxTurns || 12);
  }

  const turn = room.gameState.turn || 1;
  const maxTurns = room.gameState.maxTurns || 12;
  const currentIdx = room.gameState.currentPlayer || 0;
  const currentPlayer = room.players[currentIdx];
  if (!currentPlayer) return;

  const currentQuestion = room.gameState.questions[turn - 1];
  if (!currentQuestion) {
    finalizeGame(roomCode, io, room);
    return;
  }

  if (answer === undefined) {
    io.to(roomCode).emit('updateGameState', {
      gameState: {
        ...room.gameState,
        prompt: currentQuestion.q,
        turn,
        maxTurns
      },
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn — solve: ${currentQuestion.q}`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  const numericAnswer = Number(answer);
  if (!Number.isFinite(numericAnswer)) {
    io.to(currentPlayer.id).emit('error', 'Answer must be a number');
    return;
  }

  if (numericAnswer === currentQuestion.a) {
    currentPlayer.score += 5;
  }

  const nextTurn = turn + 1;
  if (nextTurn > maxTurns) {
    room.gameState.turn = maxTurns;
    finalizeGame(roomCode, io, room);
    return;
  }

  room.gameState.turn = nextTurn;
  room.gameState.currentPlayer = (currentIdx + 1) % room.players.length;
  io.to(roomCode).emit('updatePlayers', room.players);

  const nextPlayer = room.players[room.gameState.currentPlayer];
  const nextQuestion = room.gameState.questions[nextTurn - 1];
  io.to(roomCode).emit('updateGameState', {
    gameState: {
      ...room.gameState,
      prompt: nextQuestion ? nextQuestion.q : null
    },
    scores: buildScores(room),
    status: `${numericAnswer === currentQuestion.a ? '✅ Correct' : '❌ Wrong'} (${currentQuestion.q} = ${currentQuestion.a}). ${nextPlayer.name}'s turn — solve: ${nextQuestion ? nextQuestion.q : ''}`,
    currentPlayerId: nextPlayer.id
  });
};
