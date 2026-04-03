module.exports = function(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  const waitTime = Math.random() * 3000 + 2000;
  room.gameState.waiting = true;
  room.gameState.canClick = false;
  room.gameState.round = (room.gameState.round || 0) + 1;

  const currentRound = room.gameState.round;

  io.to(roomCode).emit('updateGameState', {
    scores: room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
    status: `Round ${currentRound}/5 — Get ready…`,
    gameState: room.gameState
  });

  const goTimeout = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing' || r.gameState.round !== currentRound) return;
    r.gameState.waiting = false;
    r.gameState.canClick = true;
    r.gameState.clickTime = Date.now();
    io.to(roomCode).emit('updateGameState', {
      scores: r.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
      status: 'GO! Click now! 🎯',
      gameState: r.gameState
    });

    // Miss timeout — nobody clicked
    setTimeout(() => {
      const r2 = rooms[roomCode];
      if (!r2 || !r2.gameState.canClick || r2.gameState.round !== currentRound) return;
      r2.gameState.canClick = false;
      io.to(roomCode).emit('updateGameState', {
        scores: r2.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {}),
        status: 'Too slow! Nobody clicked in time.',
        gameState: r2.gameState
      });
      nextReactionRound(roomCode, io, rooms);
    }, 3000);
  }, waitTime);

  // Store timeout reference for potential cleanup
  room.gameState.goTimeoutRef = goTimeout;
};

function nextReactionRound(roomCode, io, rooms) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (room.gameState.round >= 5) {
    const winner = room.players.reduce((prev, curr) => prev.score > curr.score ? prev : curr);
    const scores = room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {});
    io.to(roomCode).emit('updateGameState', {
      scores,
      status: `Game over! ${winner.name} wins with ${winner.score} points!`,
      gameState: room.gameState
    });
    io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Reaction Battle!` });
    io.to(roomCode).emit('updatePlayers', room.players);
    room.gameState = {};
    room.state = 'lobby';
    return;
  }

  module.exports(roomCode, io, rooms);
}

