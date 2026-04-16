const WORDS = [
  'gaming', 'battle', 'victory', 'challenge', 'warrior', 'champion',
  'lightning', 'thunder', 'storm', 'dragon', 'phoenix', 'titan',
  'galaxy', 'cosmos', 'nebula', 'quantum', 'cyber', 'neon',
  'velocity', 'momentum', 'kinetic', 'dynamic', 'fusion', 'blaze',
  'eclipse', 'horizon', 'zenith', 'vertex', 'apex', 'summit'
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
  if (!room.gameState.words) {
    room.gameState.words = shuffleArray(WORDS).slice(0, 10);
    room.gameState.currentWordIndex = 0;
    room.gameState.completed = {};
    room.gameState.wordStartTime = {};
    room.players.forEach(p => {
      room.gameState.completed[p.id] = 0;
    });
  }

  const currentWord = room.gameState.words[room.gameState.currentWordIndex];

  // If no move, send current word
  if (!move) {
    room.gameState.wordStartTime = Date.now();
    io.to(roomCode).emit('updateGameState', {
      gameState: {
        ...room.gameState,
        currentWord: currentWord,
        wpm: 0,
        accuracy: 100
      },
      scores: buildScores(room),
      status: `Type: "${currentWord}" - First to finish wins the round!`,
      currentPlayerId: null // All players can play
    });
    return;
  }

  const { playerId, typed } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Check if player already completed this word
  if (room.gameState.completed[playerId] > room.gameState.currentWordIndex) {
    io.to(playerId).emit('error', 'You already completed this word');
    return;
  }

  // Check if word is correct
  if (typed.toLowerCase().trim() === currentWord.toLowerCase()) {
    const timeTaken = Date.now() - room.gameState.wordStartTime;
    const wpm = Math.round((currentWord.length / 5) / (timeTaken / 60000));
    
    room.gameState.completed[playerId] = room.gameState.currentWordIndex + 1;
    player.score += Math.max(5, 20 - room.gameState.currentWordIndex);

    io.to(roomCode).emit('updatePlayers', room.players);

    // Check if all players completed
    const allCompleted = room.players.every(p => 
      room.gameState.completed[p.id] > room.gameState.currentWordIndex
    );

    if (allCompleted || room.gameState.currentWordIndex >= 9) {
      // Move to next word or end game
      room.gameState.currentWordIndex++;
      
      if (room.gameState.currentWordIndex >= 10) {
        // Game over
        const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `Game Over! ${winner.name} wins Speed Typing with ${winner.score} points!`,
          wpm: wpm,
          accuracy: 100
        });
        io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Speed Typing!` });
        room.gameState = {};
        room.state = 'lobby';
        return;
      }

      // Next word
      const nextWord = room.gameState.words[room.gameState.currentWordIndex];
      room.gameState.wordStartTime = Date.now();
      
      io.to(roomCode).emit('updateGameState', {
        gameState: {
          ...room.gameState,
          currentWord: nextWord,
          wpm: wpm,
          accuracy: 100
        },
        scores: buildScores(room),
        status: `Round ${room.gameState.currentWordIndex + 1}/10 - Type: "${nextWord}"`,
        currentPlayerId: null
      });
    } else {
      // Wait for others
      const completedCount = room.players.filter(p => 
        room.gameState.completed[p.id] > room.gameState.currentWordIndex
      ).length;
      
      io.to(roomCode).emit('updateGameState', {
        gameState: {
          ...room.gameState,
          currentWord: currentWord,
          wpm: wpm,
          accuracy: 100
        },
        scores: buildScores(room),
        status: `${player.name} finished! Waiting for others... (${completedCount}/${room.players.length})`,
        currentPlayerId: null
      });
    }
  } else {
    io.to(playerId).emit('error', 'Incorrect! Try again');
  }
};
