'use strict';

const { buildScores, publicPlayers, endGame } = require('./utils');

/** Tic Tac Toe — server-authoritative 1v1 match. */
module.exports = function tictactoe(roomCode, pos, io, rooms, playerId) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  const playerIndex = room.gameState.currentTurn !== undefined ? room.gameState.currentTurn : 0;
  const player = room.players[playerIndex];
  const targetSocketId = playerId || (player ? player.id : roomCode);

  if (!Number.isInteger(pos) || pos < 0 || pos > 8) return io.to(targetSocketId).emit('error', 'Invalid position');
  if (!room.gameState.board) room.gameState.board = Array(9).fill(null);
  if (room.gameState.board[pos] !== null) return io.to(targetSocketId).emit('error', 'That cell is already taken');
  if (room.players.length < 2) return io.to(targetSocketId).emit('error', 'Need 2 players');
  if (!player || player.id !== targetSocketId) return io.to(targetSocketId).emit('error', 'Not your turn');

  const mark = playerIndex === 0 ? 'X' : 'O';
  room.gameState.board[pos] = mark;
  const winCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  if (winCombos.some(combo => combo.every(i => room.gameState.board[i] === mark))) {
    player.score += 10;
    io.to(roomCode).emit('updateGameState', { gameState: room.gameState, scores: buildScores(room), status: `${player.name} wins! 🎉` });
    io.to(roomCode).emit('gameOver', { winner: `${player.name} wins Tic Tac Toe!` });
    io.to(roomCode).emit('updatePlayers', publicPlayers(room));
    room.gameState = {};
    room.timers = {};
    room.state = 'lobby';
    return;
  }

  if (!room.gameState.board.includes(null)) {
    io.to(roomCode).emit('updateGameState', { gameState: room.gameState, scores: buildScores(room), status: "It's a draw!" });
    io.to(roomCode).emit('gameOver', { winner: null });
    io.to(roomCode).emit('updatePlayers', publicPlayers(room));
    room.gameState = {};
    room.timers = {};
    room.state = 'lobby';
    return;
  }

  const nextIndex = 1 - playerIndex;
  room.gameState.currentTurn = nextIndex;
  const nextPlayer = room.players[nextIndex];
  const nextMark = nextIndex === 0 ? 'X' : 'O';

  io.to(roomCode).emit('updatePlayers', publicPlayers(room));
  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(room),
    status: `${nextPlayer.name}'s turn (${nextMark})`,
    currentPlayerId: nextPlayer.id
  });
};
