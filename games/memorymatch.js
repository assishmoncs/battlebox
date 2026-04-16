const EMOJIS = ['🎮', '🎯', '🎲', '🎸', '🎨', '🎭', '🎪', '🎬'];

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

function createCardPairs() {
  const pairs = [...EMOJIS, ...EMOJIS];
  return shuffleArray(pairs);
}

module.exports = function(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Initialize game state
  if (!room.gameState.cards || room.gameState.cards.length === 0) {
    room.gameState.cards = createCardPairs();
    room.gameState.flipped = [];
    room.gameState.matched = [];
    room.gameState.currentPlayer = 0;
    room.gameState.matches = {};
    room.gameState.totalMatches = 0;
    room.players.forEach(p => {
      room.gameState.matches[p.id] = 0;
    });
  }

  const currentIdx = room.gameState.currentPlayer;
  const currentPlayer = room.players[currentIdx];

  // If no move, just send current state
  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn - Flip a card`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  const { playerId, cardIndex } = move;
  
  // Validate move
  if (playerId !== currentPlayer.id) {
    io.to(playerId).emit('error', 'Not your turn');
    return;
  }

  // Check if card is already flipped or matched
  if (room.gameState.flipped.includes(cardIndex) || room.gameState.matched.includes(cardIndex)) {
    io.to(playerId).emit('error', 'Card already revealed');
    return;
  }

  // Flip the card
  room.gameState.flipped.push(cardIndex);

  // If 2 cards flipped, check for match
  if (room.gameState.flipped.length === 2) {
    const [idx1, idx2] = room.gameState.flipped;
    const card1 = room.gameState.cards[idx1];
    const card2 = room.gameState.cards[idx2];

    if (card1 === card2) {
      // Match found!
      room.gameState.matched.push(idx1, idx2);
      room.gameState.matches[playerId]++;
      currentPlayer.score += 10;
      room.gameState.totalMatches++;

      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `Match! ${currentPlayer.name} found ${card1} (+10 pts)`,
        currentPlayerId: currentPlayer.id
      });

      // Clear flipped after delay
      setTimeout(() => {
        room.gameState.flipped = [];
        
        // Check if game is over (all matches found)
        if (room.gameState.totalMatches >= 8) {
          const winner = room.players.reduce((best, p) => 
            (room.gameState.matches[p.id] || 0) > (room.gameState.matches[best.id] || 0) ? p : best
          , room.players[0]);
          
          io.to(roomCode).emit('updateGameState', {
            gameState: room.gameState,
            scores: buildScores(room),
            status: `Game Over! ${winner.name} wins with ${room.gameState.matches[winner.id]} matches!`
          });
          io.to(roomCode).emit('gameOver', { winner: `${winner.name} wins Memory Match!` });
          room.gameState = {};
          room.state = 'lobby';
          return;
        }

        // Same player gets another turn
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `${currentPlayer.name}'s turn again - Flip a card`,
          currentPlayerId: currentPlayer.id
        });
      }, 1500);
    } else {
      // No match
      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `No match! ${card1} ≠ ${card2}`,
        currentPlayerId: currentPlayer.id
      });

      // Clear flipped and switch player after delay
      setTimeout(() => {
        room.gameState.flipped = [];
        room.gameState.currentPlayer = (currentIdx + 1) % room.players.length;
        const nextPlayer = room.players[room.gameState.currentPlayer];
        
        io.to(roomCode).emit('updateGameState', {
          gameState: room.gameState,
          scores: buildScores(room),
          status: `${nextPlayer.name}'s turn - Flip a card`,
          currentPlayerId: nextPlayer.id
        });
      }, 1500);
    }
  } else {
    // Only 1 card flipped, waiting for second
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${currentPlayer.name} flipped a card - Flip another`,
      currentPlayerId: currentPlayer.id
    });
  }

  io.to(roomCode).emit('updatePlayers', room.players);
};
