module.exports = function(roomCode, word, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (typeof word !== 'string') {
    return io.to(roomCode).emit('error', 'Invalid word');
  }

  const cleanWord = word.trim().toLowerCase();

  if (cleanWord.length < 2) {
    return io.to(roomCode).emit('error', 'Word must be at least 2 letters');
  }
  if (!/^[a-z]+$/.test(cleanWord)) {
    return io.to(roomCode).emit('error', 'Word must contain only letters');
  }

  if (!room.gameState.chain) room.gameState.chain = [];
  if (!room.gameState.lastLetter) room.gameState.lastLetter = 'a';
  if (!room.gameState.usedWords) room.gameState.usedWords = [];

  const currentPlayerIndex = room.gameState.currentPlayer || 0;
  const currentPlayer = room.players[currentPlayerIndex];

  function buildScores() {
    return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
  }

  // Check starting letter
  if (cleanWord[0] !== room.gameState.lastLetter) {
    const nextIdx = (currentPlayerIndex + 1) % room.players.length;
    room.gameState.currentPlayer = nextIdx;
    const nextPlayer = room.players[nextIdx];
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(),
      status: `❌ "${cleanWord}" must start with "${room.gameState.lastLetter.toUpperCase()}". ${currentPlayer.name}'s turn skipped. ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
    return;
  }

  // Check for duplicate word
  if (room.gameState.usedWords.includes(cleanWord)) {
    const nextIdx = (currentPlayerIndex + 1) % room.players.length;
    room.gameState.currentPlayer = nextIdx;
    const nextPlayer = room.players[nextIdx];
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(),
      status: `❌ "${cleanWord}" was already used! ${currentPlayer.name}'s turn skipped. ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
    return;
  }

  // Valid word — update state
  room.gameState.chain.push(cleanWord);
  room.gameState.usedWords.push(cleanWord);
  room.gameState.lastLetter = cleanWord.slice(-1);
  currentPlayer.score += cleanWord.length;

  const nextIdx = (currentPlayerIndex + 1) % room.players.length;
  room.gameState.currentPlayer = nextIdx;

  // Check if game is over (each player has had 5 turns)
  if (room.gameState.chain.length >= room.players.length * 5) {
    const winner = room.players.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(),
      status: `Game over! ${winner.name} wins with ${winner.score} points!`
    });
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Word Chain!` });
    room.gameState = {};
    room.state = 'lobby';
    io.to(roomCode).emit('updatePlayers', room.players);
    return;
  }

  const nextPlayer = room.players[nextIdx];
  io.to(roomCode).emit('updatePlayers', room.players);
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(),
    status: `✅ "${cleanWord}" accepted! ${nextPlayer.name}'s turn — word starting with "${room.gameState.lastLetter.toUpperCase()}"`,
    currentPlayerId: nextPlayer.id
  });
};

