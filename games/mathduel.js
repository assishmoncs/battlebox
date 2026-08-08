'use strict';

const { buildScores, shuffleArray, endGame } = require('./utils');

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

module.exports = function mathduel(roomCode, io, rooms, answer) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.gameState.questions) {
    room.gameState.questions = shuffleArray(QUESTIONS).slice(0, room.gameState.maxTurns || 12);
  }

  if (!room.gameState.questions.length) {
    endGame(roomCode, io, rooms, 'Math Duel');
    return;
  }

  const turn = room.gameState.turn || 1;
  const maxTurns = Math.min(room.gameState.maxTurns || 12, QUESTIONS.length);
  const currentIdx = room.gameState.currentPlayer || 0;
  const currentPlayer = room.players[currentIdx];
  if (!currentPlayer) return;

  const currentQuestion = room.gameState.questions[turn - 1];
  if (!currentQuestion) {
    endGame(roomCode, io, rooms, 'Math Duel');
    return;
  }

  if (answer === undefined) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, prompt: currentQuestion.q, turn, maxTurns },
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn — solve: ${currentQuestion.q}`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  if (!room.timers) room.timers = {};

  // Validate answer — must be a number
  const numAnswer = Number(answer);
  if (!Number.isFinite(numAnswer)) {
    return io.to(currentPlayer.id).emit('error', 'Answer must be a number');
  }

  if (numAnswer === currentQuestion.a) {
    currentPlayer.score += 10;
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `✅ Correct! ${currentPlayer.name} gets 10 pts!`
    });
  } else {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `❌ Wrong! Answer was ${currentQuestion.a}.`
    });
  }

  io.to(roomCode).emit('updatePlayers', room.players);

  if (turn >= maxTurns) {
    room.timers.mathEnd = setTimeout(() => endGame(roomCode, io, rooms, 'Math Duel'), 2000);
    return;
  }

  // Advance turn
  room.gameState.turn = turn + 1;
  room.gameState.currentPlayer = (currentIdx + 1) % room.players.length;
  const next = room.players[room.gameState.currentPlayer];
  const nextQ = room.gameState.questions[room.gameState.turn - 1];

  room.timers.mathNext = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing') return;
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...r.gameState, prompt: nextQ.q },
      scores: buildScores(r),
      status: `${next.name}'s turn — solve: ${nextQ.q}`,
      currentPlayerId: next.id
    });
  }, 2000);
};
