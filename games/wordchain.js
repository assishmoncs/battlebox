module.exports = function(roomCode, word, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;
  if (typeof word !== 'string' || word.length < 2) {
    return io.to(roomCode).emit('error', 'Invalid word');
  }

  if (!room.gameState.chain) room.gameState.chain = [];
  if (!room.gameState.lastLetter) room.gameState.lastLetter = 'a';

  const currentPlayerIndex = room.gameState.currentPlayer || 0;
  if (word.length < 2 || word[0].toLowerCase() !== room.gameState.lastLetter) {
    const player = room.players[currentPlayerIndex];
    io.to(roomCode).emit('updateGameState', { status: `${player.name} entered invalid word! Turn skipped.` });
    room.gameState.currentPlayer = (currentPlayerIndex + 1) % room.players.length;
    io.to(roomCode).emit('updatePlayers', room.players);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
      status: `Player ${room.players[room.gameState.currentPlayer].name}'s turn`
    });
    return;
  }

  room.gameState.chain.push(word);
  room.gameState.lastLetter = word.slice(-1).toLowerCase();
  const player = room.players[currentPlayerIndex];
  player.score += word.length;

  room.gameState.currentPlayer = (currentPlayerIndex + 1) % room.players.length;

  if (room.gameState.chain.length >= room.players.length * 5) {
    const winner = room.players.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Word Chain!` });
    // Reset game state
    room.gameState = {};
    room.state = 'lobby';
    io.to(roomCode).emit('updatePlayers', room.players);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
      status: 'Lobby'
    });
    return;
  }

  io.to(roomCode).emit('updatePlayers', room.players);
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
    status: `Player ${room.players[room.gameState.currentPlayer].name}'s turn`
  });
};
