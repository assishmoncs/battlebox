'use strict';

const { buildScores, endGame } = require('./utils');

const SETS = [
  ['🍎','🍎','🍎','🍏','🍎','🍎','🍎','🍎','🍎'],
  ['🔵','🔵','🔵','🔵','🔵','🟢','🔵','🔵','🔵'],
  ['🐶','🐶','🐶','🐺','🐶','🐶','🐶','🐶','🐶'],
  ['⭐','⭐','⭐','⭐','🌟','⭐','⭐','⭐','⭐'],
  ['⚡','⚡','⚡','⚡','⚡','⚡','💥','⚡','⚡'],
  ['❤️','❤️','💔','❤️','❤️','❤️','❤️','❤️','❤️']
];

module.exports = function oddOneOut(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing' || room.game !== 'oddoneout') return;
  if (!room.gameState.grid) {
    room.gameState.round = 1;
    room.gameState.maxRounds = 6;
    room.gameState.currentPlayer = 0;
    room.gameState.grid = SETS[0];
    room.gameState.answer = 3;
    room.gameState.answered = false;
  }

  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { grid: room.gameState.grid, round: room.gameState.round, maxRounds: room.gameState.maxRounds, currentPlayer: room.gameState.currentPlayer, answered: room.gameState.answered },
      scores: buildScores(room),
      status: `${room.players[room.gameState.currentPlayer]?.name || 'Player'} — find the odd one out!`
    });
    return;
  }

  const playerIndex = room.players.findIndex(p => p.id === move.playerId);
  if (playerIndex < 0) return;
  if (playerIndex !== room.gameState.currentPlayer) return io.to(move.playerId).emit('error', 'It is not your turn');
  if (room.gameState.answered) return io.to(move.playerId).emit('error', 'Round already answered');
  if (!Number.isInteger(move.index) || move.index < 0 || move.index >= room.gameState.grid.length) return io.to(move.playerId).emit('error', 'Invalid tile');

  const correct = move.index === room.gameState.answer;
  const points = correct ? 25 : 0;
  room.players[playerIndex].score += points;
  room.gameState.answered = true;

  io.to(roomCode).emit('updateGameState', {
    gameState: { grid: room.gameState.grid, selected: move.index, answer: room.gameState.answer, round: room.gameState.round, currentPlayer: playerIndex, answered: true, correct },
    scores: buildScores(room),
    status: `${room.players[playerIndex].name}: ${correct ? `Found it! +${points}` : 'Missed it!'}`
  });

  setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.state !== 'playing' || r.game !== 'oddoneout') return;
    if (r.gameState.round >= r.gameState.maxRounds) return endGame(roomCode, io, rooms, 'Odd One Out');
    r.gameState.round++;
    r.gameState.currentPlayer = (r.gameState.currentPlayer + 1) % Math.min(r.players.length, 2);
    r.gameState.grid = SETS[(r.gameState.round - 1) % SETS.length];
    r.gameState.answer = r.gameState.grid.findIndex((v, i, a) => a.indexOf(v) === i && a.lastIndexOf(v) === i);
    r.gameState.answered = false;
    module.exports(roomCode, io, rooms);
  }, 1200);
};
