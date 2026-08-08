'use strict';

describe('wordchain', () => {
  let rooms, mockIo, emitted;

  function makeRoom() {
    return {
      state: 'playing',
      game: 'wordchain',
      timers: {},
      gameState: { chain: [], currentPlayer: 0, lastLetter: 'a', usedWords: [] },
      players: [
        { id: 'p0', name: 'Alice', score: 0, ready: false },
        { id: 'p1', name: 'Bob',   score: 0, ready: false }
      ]
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

  const wordchain = require('../../games/wordchain');

  it('accepts a valid dictionary word starting with the correct letter', () => {
    // 'a' is the starting letter; 'apple' is valid and starts with 'a'
    wordchain('ROOM', 'apple', mockIo, rooms);
    expect(rooms.ROOM.gameState.chain).toContain('apple');
    expect(rooms.ROOM.players[0].score).toBe('apple'.length);
  });

  it('BUG-05: rejects nonsense words not in dictionary', () => {
    wordchain('ROOM', 'axxzqq', mockIo, rooms);
    expect(rooms.ROOM.gameState.chain).toHaveLength(0);
    const update = emitted.find(e => e.event === 'updateGameState');
    expect(update.data.status).toMatch(/not a valid word/i);
  });

  it('rejects words starting with wrong letter', () => {
    wordchain('ROOM', 'ball', mockIo, rooms); // must start with 'a'
    expect(rooms.ROOM.gameState.chain).toHaveLength(0);
    const update = emitted.find(e => e.event === 'updateGameState');
    expect(update.data.status).toMatch(/must start with/i);
  });

  it('rejects duplicate words', () => {
    wordchain('ROOM', 'apple', mockIo, rooms); // accepted, lastLetter becomes 'e'
    emitted = [];
    // Switch back for test: manually reset to replay 'apple' from p1
    rooms.ROOM.gameState.lastLetter = 'a';
    rooms.ROOM.gameState.currentPlayer = 1;
    wordchain('ROOM', 'apple', mockIo, rooms);
    const update = emitted.find(e => e.event === 'updateGameState');
    expect(update.data.status).toMatch(/already used/i);
  });

  it('rejects non-alphabetic input', () => {
    wordchain('ROOM', 'abc123', mockIo, rooms);
    // Server emits 'error' for non-alpha input (contains digits)
    expect(emitted.some(e => e.event === 'error')).toBe(true);
    expect(rooms.ROOM.gameState.chain).toHaveLength(0);
  });

  it('rejects single-char words', () => {
    wordchain('ROOM', 'a', mockIo, rooms);
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });
});
