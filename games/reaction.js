module.exports = function(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  const waitTime = Math.random() * 3000 + 2000;
  room.gameState.waiting = true;
  room.gameState.round = (room.gameState.round || 0) + 1;
  io.to(roomCode).emit('updateGameState', { status: 'Wait...', gameState: room.gameState });

  setTimeout(() => {
    if (!room.gameState.waiting) return;
    room.gameState.waiting = false;
    room.gameState.status = 'GO!';
    io.to(roomCode).emit('updateGameState', { status: 'GO! Click now!', gameState: room.gameState });
    room.gameState.canClick = true;
    room.gameState.clickTime = Date.now();
  }, waitTime);

  setTimeout(() => {
    if (room.gameState.canClick) {
      nextReactionRound(roomCode, io, rooms);
    }
  }, waitTime + 3000);
};

function nextReactionRound(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.gameState.round >= 5) {
    const winner = room.players.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins!` });
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
  module.exports(roomCode, io, rooms);
}
