'use strict';

const { buildScores, publicPlayers, shuffleArray, endGame } = require('./utils');

const QUESTIONS = [
  { q: 'What is the capital of France?', options: ['London','Berlin','Paris','Madrid'], a: 2 },
  { q: 'Which planet is the Red Planet?', options: ['Venus','Mars','Jupiter','Saturn'], a: 1 },
  { q: 'What is 2 + 2 × 2?', options: ['6','8','4','10'], a: 0 },
  { q: 'Who painted the Mona Lisa?', options: ['Van Gogh','Picasso','Da Vinci','Michelangelo'], a: 2 },
  { q: 'Largest ocean on Earth?', options: ['Atlantic','Indian','Arctic','Pacific'], a: 3 },
  { q: 'Year World War II ended?', options: ['1943','1944','1945','1946'], a: 2 },
  { q: 'Chemical symbol for gold?', options: ['Go','Gd','Au','Ag'], a: 2 },
  { q: 'How many continents are there?', options: ['5','6','7','8'], a: 2 },
  { q: 'Speed of light?', options: ['300,000 km/s','150,000 km/s','400,000 km/s','250,000 km/s'], a: 0 },
  { q: 'Who wrote "Romeo and Juliet"?', options: ['Dickens','Shakespeare','Austen','Twain'], a: 1 },
  { q: 'Smallest prime number?', options: ['0','1','2','3'], a: 2 },
  { q: 'Atomic number 1 element?', options: ['Helium','Hydrogen','Oxygen','Carbon'], a: 1 },
  { q: 'Tallest mountain in the world?', options: ['K2','Mount Everest','Kilimanjaro','Denali'], a: 1 },
  { q: 'Sides of a hexagon?', options: ['5','6','7','8'], a: 1 },
  { q: 'Main component of the Sun?', options: ['Oxygen','Carbon','Hydrogen','Nitrogen'], a: 2 }
];

/** Trivia Challenge — answer keys remain server-side. */
module.exports = function trivia(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;
  if (!room.timers) room.timers = {};

  if (!room.gameState.questions) {
    room.gameState.questions = shuffleArray(QUESTIONS).slice(0, 15);
    room.gameState.currentQuestion = 0;
    room.gameState.answered = {};
    room.gameState.questionStartTime = Date.now();
    room.gameState.timer = 15;
  }

  const questionIndex = room.gameState.currentQuestion;
  const question = room.gameState.questions[questionIndex];
  if (!question) return endGame(roomCode, io, rooms, 'Trivia Challenge');

  if (room.timers.triviaTimer) {
    clearInterval(room.timers.triviaTimer);
    room.timers.triviaTimer = null;
  }

  const emitQuestion = () => io.to(roomCode).emit('updateGameState', {
    gameState: {
      question: question.q,
      options: question.options,
      timer: room.gameState.timer,
      currentQuestion: questionIndex,
      answered: room.gameState.answered
    },
    scores: buildScores(room),
    status: `Question ${questionIndex + 1}/15`,
    currentPlayerId: null
  });

  room.timers.triviaTimer = setInterval(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing') {
      clearInterval(room.timers.triviaTimer);
      room.timers.triviaTimer = null;
      return;
    }
    r.gameState.timer = Math.max(0, (r.gameState.timer || 1) - 1);
    if (r.gameState.timer <= 0) {
      clearInterval(r.timers.triviaTimer);
      r.timers.triviaTimer = null;
      advanceQuestion(roomCode, io, rooms);
      return;
    }
    io.to(roomCode).emit('updateGameState', {
      gameState: { question: question.q, options: question.options, timer: r.gameState.timer, currentQuestion: questionIndex, answered: r.gameState.answered },
      scores: buildScores(r),
      status: `Question ${questionIndex + 1}/15 - Time: ${r.gameState.timer}s`,
      currentPlayerId: null
    });
  }, 1000);

  if (!move) return emitQuestion();

  const { playerId, option } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  if (room.gameState.answered[playerId] !== undefined) return io.to(playerId).emit('error', 'You already answered');
  if (!Number.isInteger(option) || option < 0 || option >= question.options.length) return io.to(playerId).emit('error', 'Invalid answer option');

  const isCorrect = option === question.a;
  const answerTime = Date.now() - room.gameState.questionStartTime;
  room.gameState.answered[playerId] = { correct: isCorrect, option };
  if (isCorrect) player.score += Math.max(5, Math.round(15 - answerTime / 1000));
  io.to(roomCode).emit('updatePlayers', publicPlayers(room));

  if (room.players.every(p => room.gameState.answered[p.id] !== undefined)) {
    clearInterval(room.timers.triviaTimer);
    room.timers.triviaTimer = null;
    clearTimeout(room.timers.triviaAdvance);
    room.timers.triviaAdvance = setTimeout(() => advanceQuestion(roomCode, io, rooms), 1500);
  }
};

function advanceQuestion(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;
  if (room.timers.triviaTimer) { clearInterval(room.timers.triviaTimer); room.timers.triviaTimer = null; }
  if (room.timers.triviaAdvance) { clearTimeout(room.timers.triviaAdvance); room.timers.triviaAdvance = null; }

  const questionIndex = room.gameState.currentQuestion;
  const question = room.gameState.questions[questionIndex];
  const correctOption = question.options[question.a];
  const results = room.players.map(p => `${p.name}: ${room.gameState.answered[p.id]?.correct ? '✓' : '✗'}`).join(', ');

  io.to(roomCode).emit('updateGameState', {
    gameState: { currentQuestion: questionIndex, revealedAnswer: correctOption, answered: room.gameState.answered },
    scores: buildScores(room),
    status: `Answer: ${correctOption} | ${results}`,
    currentPlayerId: null
  });

  room.timers.triviaNext = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing') return;
    r.gameState.currentQuestion += 1;
    if (r.gameState.currentQuestion >= 15) return endGame(roomCode, io, rooms, 'Trivia Challenge');
    r.gameState.answered = {};
    r.gameState.questionStartTime = Date.now();
    r.gameState.timer = 15;
    module.exports(roomCode, io, rooms);
  }, 2000);
}

module.exports.advanceQuestion = advanceQuestion;
