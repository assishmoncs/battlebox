'use strict';

const { buildScores, endGame, clearAllGameTimers } = require('./utils');

function nextValue() { return Math.floor(Math.random() * 100) + 1; }

module.exports = function higherLower(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing' || room.game !== 'higherlower') return;
  if (!room.timers) room.timers = {};
  if (!room.gameState.current) {
    room.gameState.current = nextValue();
    room.gameState.round = 1;
    room.gameState.maxRounds = 10;
    room.gameState.currentPlayer = 0;
    room.gameState.answered = false;
  }

  if (!move) {
    const current = room.players[room.gameState.currentPlayer];
    io.to(roomCode).emit('updateGameState', {
      gameState: { current: room.gameState.current, round: room.gameState.round, maxRounds: room.gameState.maxRounds, currentPlayer: room.gameState.currentPlayer, answered: room.gameState.answered },
      scores: buildScores(room),
      status: `${current?.name || 'Player'}: will the next number be HIGHER or LOWER?`,
      currentPlayerId: current?.id || null
    });
    return;
  }

  const playerIndex = room.players.findIndex(p => p.id === move.playerId);
  if (playerIndex < 0) return;
  if (playerIndex !== room.gameState.currentPlayer) return io.to(move.playerId).emit('error', 'It is not your turn');
  if (room.gameState.answered) return io.to(move.playerId).emit('error', 'Round already answered');
  if (!['higher', 'lower'].includes(move.choice)) return io.to(move.playerId).emit('error', 'Invalid choice');

  const oldValue = room.gameState.current;
  const newValue = nextValue();
  const correct = move.choice === 'higher' ? newValue > oldValue : newValue < oldValue;
  const points = correct && newValue !== oldValue ? 20 : 0;
  room.players[playerIndex].score += points;
  room.gameState.answered = true;

  io.to(roomCode).emit('updateGameState', {
    gameState: { current: oldValue, next: newValue, round: room.gameState.round, currentPlayer: playerIndex, currentPlayerId: room.players[playerIndex].id, answered: true, correct },
    scores: buildScores(room),
    status: `${room.players[playerIndex].name} chose ${move.choice.toUpperCase()} — ${correct ? `Correct! +${points}` : 'Wrong!'}`
  });

  clearTimeout(room.timers.higherLowerNext);
  room.timers.higherLowerNext = setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing' || r.game !== 'higherlower') return;
    if (r.gameState.round >= r.gameState.maxRounds) return endGame(roomCode, io, rooms, 'Higher or Lower');
    r.gameState.round++;
    r.gameState.currentPlayer = (r.gameState.currentPlayer + 1) % 2;
    r.gameState.current = newValue;
    r.gameState.answered = false;
    module.exports(roomCode, io, rooms);
  }, 1200);
};
