'use strict';

describe('numberhunt - SEC-05: target never broadcast', () => {
  let rooms, mockIo, emitted;

  function makeRoom() {
    return {
      state: 'playing',
      game: 'numberhunt',
      timers: {},
      gameState: {},
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

  const numberhunt = require('../../games/numberhunt');

  it('initialises without exposing target in broadcast', () => {
    numberhunt('ROOM', mockIo, rooms, null);
    const updates = emitted.filter(e => e.event === 'updateGameState');
    updates.forEach(u => {
      expect(u.data.gameState).not.toHaveProperty('target');
    });
    // But target IS stored server-side
    expect(rooms.ROOM.gameState.target).toBeGreaterThanOrEqual(10);
    expect(rooms.ROOM.gameState.target).toBeLessThanOrEqual(30);
  });

  it('rejects out-of-range guesses', () => {
    numberhunt('ROOM', mockIo, rooms, null);
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p0', guess: 5 });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('rejects non-integer guesses', () => {
    numberhunt('ROOM', mockIo, rooms, null);
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p0', guess: 15.5 });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('awards points to the closest guesser', () => {
    numberhunt('ROOM', mockIo, rooms, null);
    rooms.ROOM.gameState.target = 20;
    rooms.ROOM.gameState.maxRounds = 1;
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p0', guess: 21 }); // off by 1
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p1', guess: 28 }); // off by 8
    expect(rooms.ROOM.players[0].score).toBeGreaterThan(rooms.ROOM.players[1].score);
  });

  it('prevents double-submission', () => {
    numberhunt('ROOM', mockIo, rooms, null);
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p0', guess: 15 });
    emitted = [];
    numberhunt('ROOM', mockIo, rooms, { playerId: 'p0', guess: 20 });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });
});
