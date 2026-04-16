const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_NAMES = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

function buildScores(room) {
  return room.players.reduce((acc, p) => ({ ...acc, [p.name]: p.score || 0 }), {});
}

function generateSequence(length) {
  const seq = [];
  for (let i = 0; i < length; i++) {
    seq.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  return seq;
}

module.exports = function(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Initialize game state
  if (!room.gameState.sequence || room.gameState.sequence.length === 0) {
    room.gameState.sequence = generateSequence(3);
    room.gameState.playerIndex = 0;
    room.gameState.playerSequence = {};
    room.gameState.showingSequence = true;
    room.gameState.round = 1;
    room.players.forEach(p => {
      room.gameState.playerSequence[p.id] = [];
    });

    // Show sequence to all players
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Watch the pattern! Round ${room.gameState.round}`,
      currentPlayerId: null
    });

    // After showing sequence, let players repeat
    setTimeout(() => {
      room.gameState.showingSequence = false;
      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `Repeat the pattern! All players must match`,
        currentPlayerId: null
      });
    }, 2000 + room.gameState.sequence.length * 600);
    return;
  }

  // If no move, just send state
  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: room.gameState.showingSequence 
        ? `Watch the pattern!` 
        : `Repeat the pattern!`,
      currentPlayerId: null
    });
    return;
  }

  const { playerId, sequence } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Don't accept input while showing sequence
  if (room.gameState.showingSequence) {
    io.to(playerId).emit('error', 'Wait for the pattern to finish');
    return;
  }

  // Get the color from the sequence (should be single color)
  const color = sequence[0];
  const playerSeq = room.gameState.playerSequence[playerId];
  const expectedColor = room.gameState.sequence[playerSeq.length];

  if (color !== expectedColor) {
    // Wrong color - player is eliminated
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${player.name} made a mistake! Expected ${COLOR_NAMES[expectedColor]}`,
      currentPlayerId: null
    });

    // Mark player as eliminated (negative score)
    player.score = -1;
    room.gameState.playerSequence[playerId] = null; // Mark as eliminated

    io.to(roomCode).emit('updatePlayers', room.players);

    // Check if only one player remains
    const activePlayers = room.players.filter(p => p.score >= 0);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.score = Math.max(1, room.gameState.round * 5);
      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `${winner.name} wins Simon Says!`
      });
      io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Simon Says!` });
      room.gameState = {};
      room.state = 'lobby';
      return;
    }

    // Check if all active players completed the sequence
    checkAllCompleted();
    return;
  }

  // Correct color
  playerSeq.push(color);

  // Check if player completed the full sequence
  if (playerSeq.length === room.gameState.sequence.length) {
    player.score += room.gameState.round * 2;
    checkAllCompleted();
  } else {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${player.name} got it right! Continue the pattern...`,
      currentPlayerId: null
    });
  }

  function checkAllCompleted() {
    const activePlayers = room.players.filter(p => p.score >= 0);
    const allCompleted = activePlayers.every(p => {
      const seq = room.gameState.playerSequence[p.id];
      return seq && seq.length === room.gameState.sequence.length;
    });

    if (allCompleted) {
      // Next round with longer sequence
      room.gameState.round++;
      room.gameState.sequence = generateSequence(2 + room.gameState.round);
      room.gameState.showingSequence = true;
      activePlayers.forEach(p => {
        room.gameState.playerSequence[p.id] = [];
      });

      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `Round ${room.gameState.round}! Watch the new pattern...`,
        currentPlayerId: null
      });

      setTimeout(() => {
        room.gameState.showingSequence = false;
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `Repeat the pattern!`,
          currentPlayerId: null
        });
      }, 2000 + room.gameState.sequence.length * 600);
    }
  }

  io.to(roomCode).emit('updatePlayers', room.players);
};
