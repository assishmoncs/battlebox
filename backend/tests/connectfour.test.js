'use strict';

const connectFour = require('../../games/connectfour');

function setup() {
  const events = [];
  const io = { to: () => ({ emit: (...args) => events.push(args) }) };
  const rooms = { AB12: {
    game: 'connectfour', state: 'playing',
    players: [
      { id: 'p1', name: 'Alice', score: 0 },
      { id: 'p2', name: 'Bob', score: 0 }
    ],
    gameState: { board: Array(42).fill(null), currentPlayer: 0, moves: 0 }, timers: {}
  }};
  return { events, io, rooms };
}

describe('Connect Four', () => {
  test('initializes and broadcasts board with current player', () => {
    const { events, io, rooms } = setup();
    connectFour('AB12', io, rooms);
    expect(events[0][0]).toBe('updateGameState');
    expect(events[0][1].gameState.board).toHaveLength(42);
    expect(events[0][1].currentPlayerId).toBe('p1');
  });

  test('rejects a move from the wrong player', () => {
    const { events, io, rooms } = setup();
    connectFour('AB12', io, rooms, { playerId: 'p2', column: 0 });
    expect(events.at(-1)[1]).toContain('It is not your turn');
  });

  test('places discs and changes turns', () => {
    const { events, io, rooms } = setup();
    connectFour('AB12', io, rooms, { playerId: 'p1', column: 3 });
    expect(rooms.AB12.gameState.board[38]).toBe('R');
    expect(rooms.AB12.gameState.currentPlayer).toBe(1);
    expect(events.at(-1)[1].currentPlayerId).toBe('p2');
  });

  test('awards the winner for four in a row', () => {
    const { events, io, rooms } = setup();
    rooms.AB12.gameState.board = Array(42).fill(null);
    // Bottom row: R R R, then the winning fourth R.
    rooms.AB12.gameState.board[38] = 'R';
    rooms.AB12.gameState.board[39] = 'R';
    rooms.AB12.gameState.board[40] = 'R';
    rooms.AB12.gameState.currentPlayer = 0;
    connectFour('AB12', io, rooms, { playerId: 'p1', column: 6 });
    expect(rooms.AB12.players[0].score).toBe(100);
    expect(rooms.AB12.gameState.winner).toBe(0);
  });
});
