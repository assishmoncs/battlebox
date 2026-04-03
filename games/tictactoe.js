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
    const player = room.players.find(p => p.id === /* socket */ room.players[room.gameState.currentTurn]?.id);
    return io.to(roomCode).emit('error', 'That cell is already taken');
  }

  const playerIndex = room.gameState.currentTurn !== undefined ? room.gameState.currentTurn : 0;
  const player = room.players[playerIndex];
  if (!player) return;
  const mark = playerIndex === 0 ? 'X' : 'O';
  room.gameState.board[pos] = mark;

  function buildScores() {
    return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
  }

  // Check for winner
  const winCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const combo of winCombos) {
    if (combo.every(i => room.gameState.board[i] === mark)) {
      player.score += 10;
      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(),
        status: `${player.name} wins! 🎉`
      });
      io.to(roomCode).emit('gameOver', { winner: `${player.name} wins Tic Tac Toe!` });
      room.gameState = {};
      room.state = 'lobby';
      io.to(roomCode).emit('updatePlayers', room.players);
      return;
    }
  }

  // Check for draw
  if (!room.gameState.board.includes(null)) {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(),
      status: "It's a draw!"
    });
    io.to(roomCode).emit('gameOver', { winner: null });
    room.gameState = {};
    room.state = 'lobby';
    io.to(roomCode).emit('updatePlayers', room.players);
    return;
  }

  // Switch turns
  const nextIndex = 1 - playerIndex;
  room.gameState.currentTurn = nextIndex;
  const nextPlayer = room.players[nextIndex];
  const nextMark = nextIndex === 0 ? 'X' : 'O';

  io.to(roomCode).emit('updatePlayers', room.players);
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(),
    status: `${nextPlayer.name}'s turn (${nextMark})`,
    currentPlayerId: nextPlayer.id
  });
};

