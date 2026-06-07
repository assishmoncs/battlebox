'use strict';

describe('tictactoe', () => {
  let rooms, mockIo, emitted;

  function makeRoom(players = 2) {
    return {
      state: 'playing',
      game: 'tictactoe',
      timers: {},
      gameState: { board: Array(9).fill(null), currentTurn: 0 },
      players: Array.from({ length: players }, (_, i) => ({
        id: `p${i}`, name: `Player${i}`, score: 0, ready: false
      }))
    };
  }

  beforeEach(() => {
    emitted = [];
    rooms = { ROOM: makeRoom() };
    mockIo = {
      to: () => ({
        emit: (event, data) => emitted.push({ event, data })
      })
    };
  });

  const tictactoe = require('../../games/tictactoe');

  it('rejects float positions (SEC-04 fix)', () => {
    tictactoe('ROOM', 2.7, mockIo, rooms);
    expect(emitted.some(e => e.event === 'error')).toBe(true);
    expect(rooms.ROOM.gameState.board[2]).toBeNull();
  });

  it('rejects out-of-range positions', () => {
    tictactoe('ROOM', 9, mockIo, rooms);
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('rejects negative positions', () => {
    tictactoe('ROOM', -1, mockIo, rooms);
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('places a mark and switches turns', () => {
    tictactoe('ROOM', 0, mockIo, rooms);
    expect(rooms.ROOM.gameState.board[0]).toBe('X');
    const stateUpdate = emitted.find(e => e.event === 'updateGameState');
    expect(stateUpdate).toBeDefined();
    expect(rooms.ROOM.gameState.currentTurn).toBe(1);
  });

  it('rejects already-taken cell', () => {
    rooms.ROOM.gameState.board[0] = 'X';
    tictactoe('ROOM', 0, mockIo, rooms);
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('detects a win', () => {
    rooms.ROOM.gameState.board = ['X', 'X', null, null, null, null, null, null, null];
    tictactoe('ROOM', 2, mockIo, rooms);
    expect(emitted.some(e => e.event === 'gameOver')).toBe(true);
    expect(rooms.ROOM.players[0].score).toBe(10);
  });

  it('detects a draw (board full, no winner)', () => {
    // X O X / O O X / X X O — verified no 3-in-a-row for either mark
    // Preset 8 cells, then place final cell via tictactoe()
    rooms.ROOM.gameState.board = ['X','O','X','O','O','X','X','X',null];
    rooms.ROOM.gameState.currentTurn = 1; // O's turn — placing O at index 8
    tictactoe('ROOM', 8, mockIo, rooms);
    const gameOver = emitted.find(e => e.event === 'gameOver');
    expect(gameOver).toBeDefined();
    expect(gameOver.data.winner).toBeNull();
  });
});
