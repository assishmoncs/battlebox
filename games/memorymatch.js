'use strict';

const { buildScores, shuffleArray, endGame } = require('./utils');

const EMOJIS = ['🎮', '🎯', '🎲', '🎸', '🎨', '🎭', '🎪', '🎬'];

function createCardPairs() {
  return shuffleArray([...EMOJIS, ...EMOJIS]);
}

function publicState(state) {
  const visible = new Set([...(state.flipped || []), ...(state.matched || [])]);
  return {
    ...state,
    cards: Array.isArray(state.cards) ? state.cards.map((card, index) => visible.has(index) ? card : null) : []
  };
}

/** Memory Match with server-authoritative hidden-card state. */
module.exports = function memorymatch(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;
  if (!room.timers) room.timers = {};

  if (!Array.isArray(room.gameState.cards) || room.gameState.cards.length === 0) {
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
  if (!currentPlayer) return;

  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: publicState(room.gameState),
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn - Flip a card`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  const { playerId, cardIndex } = move;
  if (playerId !== currentPlayer.id) return io.to(playerId).emit('error', 'Not your turn');
  if (room.gameState.lockBoard) return io.to(playerId).emit('error', 'Wait for cards to flip back');
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= room.gameState.cards.length) return io.to(playerId).emit('error', 'Invalid card index');
  if (room.gameState.flipped.includes(cardIndex) || room.gameState.matched.includes(cardIndex)) return io.to(playerId).emit('error', 'Card already revealed');

  room.gameState.flipped.push(cardIndex);

  if (room.gameState.flipped.length === 2) {
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
        gameState: publicState(room.gameState),
        scores: buildScores(room),
        status: `Match! ${currentPlayer.name} found ${room.gameState.cards[idx1]} (+10 pts)`,
        currentPlayerId: currentPlayer.id
      });
      if (room.gameState.totalMatches >= EMOJIS.length) room.timers.memoryEnd = setTimeout(() => endGame(roomCode, io, rooms, 'Memory Match'), 1000);
    } else {
      io.to(roomCode).emit('updateGameState', {
        gameState: publicState(room.gameState),
        scores: buildScores(room),
        status: 'No match! Cards will flip back...',
        currentPlayerId: currentPlayer.id
      });
      room.timers.memoryFlip = setTimeout(() => {
        const r = rooms[roomCode];
        if (!r || r.state !== 'playing') return;
        r.gameState.flipped = [];
        r.gameState.lockBoard = false;
        r.gameState.currentPlayer = (currentIdx + 1) % r.players.length;
        const next = r.players[r.gameState.currentPlayer];
        io.to(roomCode).emit('updateGameState', {
          gameState: publicState(r.gameState),
          scores: buildScores(r),
          status: `${next.name}'s turn - Flip a card`,
          currentPlayerId: next.id
        });
      }, 1000);
    }
  } else {
    io.to(roomCode).emit('updateGameState', {
      gameState: publicState(room.gameState),
      scores: buildScores(room),
      status: `${currentPlayer.name} flipped a card — pick a second`,
      currentPlayerId: currentPlayer.id
    });
  }
};
