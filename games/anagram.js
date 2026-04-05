const WORDS = [
  'planet', 'socket', 'banana', 'rocket', 'winter', 'hunter',
  'market', 'silver', 'garden', 'throne', 'orange', 'forest'
];

function shuffleWord(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
}

module.exports = function(roomCode, io, rooms, guess) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  room.gameState.round = room.gameState.round || 1;
  room.gameState.maxRounds = room.gameState.maxRounds || 10;
  room.gameState.currentPlayer = room.gameState.currentPlayer || 0;

  if (!room.gameState.roundWords) {
    room.gameState.roundWords = WORDS.sort(() => Math.random() - 0.5).slice(0, room.gameState.maxRounds);
  }

  const currentIdx = room.gameState.currentPlayer;
  const currentPlayer = room.players[currentIdx];
  const currentWord = room.gameState.roundWords[room.gameState.round - 1];
  if (!currentWord || !currentPlayer) return;

  if (!guess) {
    const scrambled = shuffleWord(currentWord);
    room.gameState.scrambled = scrambled;
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, scrambled },
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn — Unscramble: ${scrambled}`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  const cleanGuess = String(guess).trim().toLowerCase();
  if (!cleanGuess) {
    io.to(currentPlayer.id).emit('error', 'Type your guess first');
    return;
  }

  const correct = cleanGuess === currentWord;
  if (correct) currentPlayer.score += 6;

  const nextRound = room.gameState.round + 1;
  if (nextRound > room.gameState.maxRounds) {
    const winner = room.players.reduce((best, p) => p.score > best.score ? p : best, room.players[0]);
    io.to(roomCode).emit('updatePlayers', room.players);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Game over! ${winner.name} wins Anagram Sprint with ${winner.score} points!`
    });
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Anagram Sprint!` });
    room.gameState = {};
    room.state = 'lobby';
    return;
  }

  room.gameState.round = nextRound;
  room.gameState.currentPlayer = (currentIdx + 1) % room.players.length;
  const nextWord = room.gameState.roundWords[nextRound - 1];
  const nextPlayer = room.players[room.gameState.currentPlayer];
  const nextScrambled = shuffleWord(nextWord);
  room.gameState.scrambled = nextScrambled;

  io.to(roomCode).emit('updatePlayers', room.players);
  io.to(roomCode).emit('updateGameState', {
    gameState: { ...room.gameState, scrambled: nextScrambled },
    scores: buildScores(room),
    status: `${correct ? '✅ Correct' : `❌ Wrong (answer: ${currentWord})`}. ${nextPlayer.name}'s turn — Unscramble: ${nextScrambled}`,
    currentPlayerId: nextPlayer.id
  });
};
