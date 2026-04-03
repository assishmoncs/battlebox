module.exports = function(roomCode, pos, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Validate position
  if (typeof pos !== 'number' || pos < 0 || pos > 8) {
    return io.to(roomCode).emit('error', 'Invalid position');
  }

  // Initialize board if needed
  if (!room.gameState.board) room.gameState.board = Array(9).fill(null);

  // Check if position is already taken
  if (room.gameState.board[pos] !== null) {
    return io.to(roomCode).emit('error', 'Position already taken');
  }

  const playerIndex = room.gameState.currentTurn !== undefined ? room.gameState.currentTurn : 0;
  const player = room.players[playerIndex];
  room.gameState.board[pos] = playerIndex === 0 ? 'X' : 'O';

  // Check for winner
  const winCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let combo of winCombos) {
    if (combo.every(i => room.gameState.board[i] === (playerIndex === 0 ? 'X' : 'O'))) {
      player.score += 10;
      io.to(roomCode).emit('gameOver', { winner: `${player.name} wins Tic Tac Toe!` });
      // Reset game state
      room.players.forEach(p => p.score = p.score); // keep scores
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
  }

  // Check for draw
  if (!room.gameState.board.includes(null)) {
    io.to(roomCode).emit('updateGameState', { status: 'Draw!' });
    room.state = 'lobby';
    io.to(roomCode).emit('updatePlayers', room.players);
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
      status: 'Lobby'
    });
    return;
  }

  // Switch turns
  room.gameState.currentTurn = 1 - playerIndex;
  io.to(roomCode).emit('updatePlayers', room.players);
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
    status: `Player ${playerIndex === 0 ? 'O' : 'X'}'s turn`
  });
};
