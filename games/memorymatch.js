'use strict';

const { buildScores, shuffleArray, endGame } = require('./utils');

const EMOJIS = ['🎮', '🎯', '🎲', '🎸', '🎨', '🎭', '🎪', '🎬'];

function createCardPairs() {
  return shuffleArray([...EMOJIS, ...EMOJIS]);
}

/**
 * Memory Match
 * BUG-03 fix: lockBoard flag prevents 3-card illegal state.
 */
module.exports = function memorymatch(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.timers) room.timers = {};

  // Initialise
  if (!room.gameState.cards || room.gameState.cards.length === 0) {
    room.gameState.cards = createCardPairs();
    room.gameState.flipped = [];
    room.gameState.matched = [];
    room.gameState.currentPlayer = 0;
    room.gameState.matches = {};
    room.gameState.totalMatches = 0;
    room.gameState.lockBoard = false;
    room.players.forEach(p => { room.gameState.matches[p.id] = 0; });
  }

  const currentIdx = room.gameState.currentPlayer;
  const currentPlayer = room.players[currentIdx];

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

  if (playerId !== currentPlayer.id) {
    io.to(playerId).emit('error', 'Not your turn');
    return;
  }

  // BUG-03 fix: reject input while board is locked (processing mismatch animation)
  if (room.gameState.lockBoard) {
    io.to(playerId).emit('error', 'Wait for cards to flip back');
    return;
  }

  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= room.gameState.cards.length) {
    io.to(playerId).emit('error', 'Invalid card index');
    return;
  }

  if (room.gameState.flipped.includes(cardIndex) || room.gameState.matched.includes(cardIndex)) {
    io.to(playerId).emit('error', 'Card already revealed');
    return;
  }

  room.gameState.flipped.push(cardIndex);

  if (room.gameState.flipped.length === 2) {
    // Lock board immediately so no third card can be clicked
    room.gameState.lockBoard = true;

    const [idx1, idx2] = room.gameState.flipped;
    const isMatch = room.gameState.cards[idx1] === room.gameState.cards[idx2];

    if (isMatch) {
      room.gameState.matched.push(idx1, idx2);
      room.gameState.matches[playerId]++;
      currentPlayer.score += 10;
      room.gameState.totalMatches++;
      room.gameState.flipped = [];
      room.gameState.lockBoard = false;

      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `Match! ${currentPlayer.name} found ${room.gameState.cards[idx1]} (+10 pts)`,
        currentPlayerId: currentPlayer.id
      });

      if (room.gameState.totalMatches >= EMOJIS.length) {
        setTimeout(() => endGame(roomCode, io, rooms, 'Memory Match'), 1000);
      }
    } else {
      // Mismatch — show for 1 second then flip back
      io.to(roomCode).emit('updateGameState', {
        gameState: room.gameState,
        scores: buildScores(room),
        status: `No match! Cards will flip back...`,
        currentPlayerId: currentPlayer.id
      });

      room.timers.memoryFlip = setTimeout(() => {
        const r = rooms[roomCode];
        if (!r || r.state !== 'playing') return;
        r.gameState.flipped = [];
        r.gameState.lockBoard = false;
        // Advance to next player
        r.gameState.currentPlayer = (currentIdx + 1) % r.players.length;
        const next = r.players[r.gameState.currentPlayer];
        io.to(roomCode).emit('updateGameState', {
          gameState: r.gameState,
          scores: buildScores(r),
          status: `${next.name}'s turn - Flip a card`,
          currentPlayerId: next.id
        });
      }, 1000);
    }
  } else {
    // First card flipped
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `${currentPlayer.name} flipped a card — pick a second`,
      currentPlayerId: currentPlayer.id
    });
  }
};
