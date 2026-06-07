'use strict';

describe('rpsarena', () => {
  let rooms, mockIo, emitted;

  function makeRoom(playerCount = 2) {
    return {
      state: 'playing',
      game: 'rpsarena',
      timers: {},
      gameState: { round: 1, maxRounds: 1, choices: {} },
      players: Array.from({ length: playerCount }, (_, i) => ({
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

  const rpsarena = require('../../games/rpsarena');

  it('BUG-01: rejects rooms with ≠2 players', () => {
    rooms.ROOM = makeRoom(3);
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'rock' });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('rock beats scissors', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'rock' });
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p1', choice: 'scissors' });
    expect(rooms.ROOM.players[0].score).toBeGreaterThan(rooms.ROOM.players[1].score);
  });

  it('paper beats rock', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'paper' });
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p1', choice: 'rock' });
    expect(rooms.ROOM.players[0].score).toBeGreaterThan(rooms.ROOM.players[1].score);
  });

  it('scissors beats paper', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'scissors' });
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p1', choice: 'paper' });
    expect(rooms.ROOM.players[0].score).toBeGreaterThan(rooms.ROOM.players[1].score);
  });

  it('tie awards both players a point', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'rock' });
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p1', choice: 'rock' });
    expect(rooms.ROOM.players[0].score).toBe(1);
    expect(rooms.ROOM.players[1].score).toBe(1);
  });

  it('prevents double-submission', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'rock' });
    emitted = [];
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'paper' });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });

  it('rejects invalid choice', () => {
    rpsarena('ROOM', mockIo, rooms, { playerId: 'p0', choice: 'fire' });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });
});
