'use strict';

const { buildScores, endGame } = require('./utils');

const ROWS = 6;
const COLS = 7;
const WIN = 4;

function checkWinner(board, row, col, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= WIN) return true;
  }
  return false;
}

module.exports = function connectFour(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing' || room.game !== 'connectfour') return;
  if (!room.gameState.board) {
    room.gameState.board = Array(ROWS * COLS).fill(null);
    room.gameState.currentPlayer = 0;
    room.gameState.moves = 0;
  }

  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { board: room.gameState.board, currentPlayer: room.gameState.currentPlayer },
      scores: buildScores(room),
      status: `${room.players[room.gameState.currentPlayer]?.name || 'Player'}'s turn`
    });
    return;
  }

  const playerIndex = room.players.findIndex(p => p.id === move.playerId);
  if (playerIndex < 0) return;
  if (playerIndex !== room.gameState.currentPlayer) {
    io.to(move.playerId).emit('error', 'It is not your turn');
    return;
  }
  if (!Number.isInteger(move.column) || move.column < 0 || move.column >= COLS) {
    io.to(move.playerId).emit('error', 'Invalid column');
    return;
  }

  let targetRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (room.gameState.board[r * COLS + move.column] === null) {
      targetRow = r;
      break;
    }
  }
  if (targetRow < 0) {
    io.to(move.playerId).emit('error', 'Column is full');
    return;
  }

  const token = playerIndex === 0 ? 'R' : 'Y';
  room.gameState.board[targetRow * COLS + move.column] = token;
  room.gameState.moves++;

  if (checkWinner(room.gameState.board, targetRow, move.column, token)) {
    room.players[playerIndex].score += 100;
    io.to(roomCode).emit('updateGameState', {
      gameState: { board: room.gameState.board, currentPlayer: playerIndex, winner: playerIndex },
      scores: buildScores(room),
      status: `${room.players[playerIndex].name} wins Connect Four! +100`
    });
    setTimeout(() => endGame(roomCode, io, rooms, 'Connect Four'), 1200);
    return;
  }

  if (room.gameState.moves >= ROWS * COLS) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { board: room.gameState.board, currentPlayer: playerIndex, draw: true },
      scores: buildScores(room),
      status: 'Board full — draw!'
    });
    setTimeout(() => endGame(roomCode, io, rooms, 'Connect Four'), 1200);
    return;
  }

  room.gameState.currentPlayer = (playerIndex + 1) % Math.min(room.players.length, 2);
  io.to(roomCode).emit('updateGameState', {
    gameState: { board: room.gameState.board, currentPlayer: room.gameState.currentPlayer },
    scores: buildScores(room),
    status: `${room.players[room.gameState.currentPlayer]?.name || 'Player'}'s turn`
  });
};
