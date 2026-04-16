const QUESTIONS = [
  { q: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], a: 2 },
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], a: 1 },
  { q: 'What is 2 + 2 × 2?', options: ['6', '8', '4', '10'], a: 0 },
  { q: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], a: 2 },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
  { q: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], a: 2 },
  { q: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], a: 2 },
  { q: 'How many continents are there?', options: ['5', '6', '7', '8'], a: 2 },
  { q: 'What is the speed of light?', options: ['300,000 km/s', '150,000 km/s', '400,000 km/s', '250,000 km/s'], a: 0 },
  { q: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], a: 1 },
  { q: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], a: 2 },
  { q: 'Which element has the atomic number 1?', options: ['Helium', 'Hydrogen', 'Oxygen', 'Carbon'], a: 1 },
  { q: 'What is the tallest mountain in the world?', options: ['K2', 'Mount Everest', 'Kilimanjaro', 'Denali'], a: 1 },
  { q: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], a: 1 },
  { q: 'What is the main component of the Sun?', options: ['Oxygen', 'Carbon', 'Hydrogen', 'Nitrogen'], a: 2 }
];

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = function(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Initialize game state
  if (!room.gameState.questions) {
    room.gameState.questions = shuffleArray(QUESTIONS).slice(0, 15);
    room.gameState.currentQuestion = 0;
    room.gameState.answered = {};
    room.gameState.questionStartTime = Date.now();
    room.gameState.timer = 15;
  }

  const question = room.gameState.questions[room.gameState.currentQuestion];

  // Start timer for question
  if (!room.gameState.timerInterval) {
    room.gameState.timerInterval = setInterval(() => {
      room.gameState.timer--;
      if (room.gameState.timer <= 0) {
        clearInterval(room.gameState.timerInterval);
        room.gameState.timerInterval = null;
        // Time's up - move to next question
        nextQuestion();
      } else {
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `Question ${room.gameState.currentQuestion + 1}/15 - Time: ${room.gameState.timer}s`,
          currentPlayerId: null
        });
      }
    }, 1000);
  }

  // If no move, send current question
  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: {
        ...room.gameState,
        question: question.q,
        options: question.options
      },
      scores: buildScores(room),
      status: `Question ${room.gameState.currentQuestion + 1}/15`,
      currentPlayerId: null
    });
    return;
  }

  const { playerId, option } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Check if player already answered
  if (room.gameState.answered[playerId] !== undefined) {
    io.to(playerId).emit('error', 'You already answered');
    return;
  }

  // Record answer
  const isCorrect = option === question.a;
  const answerTime = Date.now() - room.gameState.questionStartTime;
  
  room.gameState.answered[playerId] = {
    correct: isCorrect,
    option: option
  };

  // Award points
  if (isCorrect) {
    // Faster = more points (max 15, min 5)
    const points = Math.max(5, Math.round(15 - answerTime / 1000));
    player.score += points;
  }

  io.to(roomCode).emit('updatePlayers', room.players);

  // Check if all players answered
  const allAnswered = room.players.every(p => room.gameState.answered[p.id] !== undefined);

  if (allAnswered) {
    clearInterval(room.gameState.timerInterval);
    room.gameState.timerInterval = null;
    setTimeout(nextQuestion, 2000);
  }

  function nextQuestion() {
    // Show correct answer
    const correctOption = question.options[question.a];
    const results = room.players.map(p => {
      const ans = room.gameState.answered[p.id];
      const correct = ans && ans.correct;
      return `${p.name}: ${correct ? '✓' : '✗'}`;
    }).join(', ');

    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Answer: ${correctOption} | ${results}`,
      currentPlayerId: null
    });

    setTimeout(() => {
      room.gameState.currentQuestion++;

      if (room.gameState.currentQuestion >= 15) {
        // Game over
        const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `Game Over! ${winner.name} wins Trivia with ${winner.score} points!`
        });
        io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Trivia Challenge!` });
        room.gameState = {};
        room.state = 'lobby';
        return;
      }

      // Next question
      const nextQ = room.gameState.questions[room.gameState.currentQuestion];
      room.gameState.answered = {};
      room.gameState.questionStartTime = Date.now();
      room.gameState.timer = 15;

      io.to(roomCode).emit('updateGameState', {
        gameState: {
          ...room.gameState,
          question: nextQ.q,
          options: nextQ.options
        },
        scores: buildScores(room),
        status: `Question ${room.gameState.currentQuestion + 1}/15`,
        currentPlayerId: null
      });
    }, 2000);
  }
};
