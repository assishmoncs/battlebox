const COLORS = [
  { name: 'RED', value: 'red', hex: '#ff3366' },
  { name: 'BLUE', value: 'blue', hex: '#4488ff' },
  { name: 'GREEN', value: 'green', hex: '#00ff88' },
  { name: 'YELLOW', value: 'yellow', hex: '#ffea00' }
];

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateDisplay() {
  const wordColor = getRandomColor();
  const textColor = getRandomColor();
  return {
    word: wordColor.name,
    color: textColor.hex,
    correctAnswer: textColor.value
  };
}

module.exports = function(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Initialize game state
  if (!room.gameState.round) {
    room.gameState.round = 1;
    room.gameState.maxRounds = 10;
    room.gameState.answered = {};
    room.gameState.roundStartTime = Date.now();
    room.gameState.currentDisplay = generateDisplay();
  }

  // If no move, send current display
  if (!move) {
    room.gameState.roundStartTime = Date.now();
    room.gameState.answered = {};
    room.gameState.currentDisplay = generateDisplay();
    
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Round ${room.gameState.round}/${room.gameState.maxRounds} - Click the COLOR of the text!`,
      currentPlayerId: null
    });
    return;
  }

  const { playerId, color } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Check if player already answered
  if (room.gameState.answered[playerId] !== undefined) {
    io.to(playerId).emit('error', 'You already answered');
    return;
  }

  // Record answer time
  const answerTime = Date.now() - room.gameState.roundStartTime;
  const isCorrect = color === room.gameState.currentDisplay.correctAnswer;

  room.gameState.answered[playerId] = {
    correct: isCorrect,
    time: answerTime
  };

  // Award points for correct answer
  if (isCorrect) {
    // Faster = more points (max 10, min 5)
    const points = Math.max(5, Math.round(10 - answerTime / 500));
    player.score += points;
  }

  io.to(roomCode).emit('updatePlayers', room.players);

  // Check if all players answered
  const allAnswered = room.players.every(p => room.gameState.answered[p.id] !== undefined);

  if (allAnswered) {
    // Show results
    const correctColor = COLORS.find(c => c.value === room.gameState.currentDisplay.correctAnswer);
    const results = room.players.map(p => {
      const ans = room.gameState.answered[p.id];
      return `${p.name}: ${ans.correct ? '✓' : '✗'}`;
    }).join(', ');

    setTimeout(() => {
      room.gameState.round++;

      if (room.gameState.round > room.gameState.maxRounds) {
        // Game over
        const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `Game Over! ${winner.name} wins Color Match with ${winner.score} points!`
        });
        io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Color Match!` });
        room.gameState = {};
        room.state = 'lobby';
        return;
      }

      // Next round
      room.gameState.currentDisplay = generateDisplay();
      room.gameState.answered = {};
      room.gameState.roundStartTime = Date.now();

      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `Round ${room.gameState.round}/${room.gameState.maxRounds} - Click the COLOR! (${results})`,
        currentPlayerId: null
      });
    }, 2000);
  } else {
    const answeredCount = Object.keys(room.gameState.answered).length;
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${answeredCount}/${room.players.length} answered...`,
      currentPlayerId: null
    });
  }
};
