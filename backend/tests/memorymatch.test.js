'use strict';

describe('memorymatch', () => {
  let rooms, mockIo, emitted;

  function makeRoom() {
    return {
      state: 'playing',
      game: 'memorymatch',
      timers: {},
      gameState: {},
      players: [
        { id: 'p0', name: 'Alice', score: 0, ready: false },
        { id: 'p1', name: 'Bob',   score: 0, ready: false }
      ]
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    emitted = [];
    rooms = { ROOM: makeRoom() };
    mockIo = {
      to: () => ({
        emit: (event, data) => emitted.push({ event, data })
      })
    };
  });

  afterEach(() => jest.useRealTimers());

  const memorymatch = require('../../games/memorymatch');

  it('initialises game state on first call', () => {
    memorymatch('ROOM', mockIo, rooms, null);
    expect(rooms.ROOM.gameState.cards).toHaveLength(16);
    expect(rooms.ROOM.gameState.lockBoard).toBe(false);
  });

  it('BUG-03: lockBoard prevents third card from being flipped', () => {
    memorymatch('ROOM', mockIo, rooms, null);
    // Flip two mismatching cards to trigger lockBoard
    const gs = rooms.ROOM.gameState;
    // Find two cards with different values
    const first  = gs.cards.findIndex((_, i) => !gs.matched.includes(i));
    const second = gs.cards.findIndex((c, i) => i !== first && c !== gs.cards[first] && !gs.matched.includes(i));
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: first });
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: second });

    // Board should now be locked
    expect(rooms.ROOM.gameState.lockBoard).toBe(true);

    // Attempt to flip a third card while locked
    emitted = [];
    const third = gs.cards.findIndex((_, i) => i !== first && i !== second);
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: third });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
    expect(rooms.ROOM.gameState.flipped).toHaveLength(2); // still 2, not 3
  });

  it('unlocks board after mismatch timeout', () => {
    memorymatch('ROOM', mockIo, rooms, null);
    const gs = rooms.ROOM.gameState;
    const first  = gs.cards.findIndex((_, i) => !gs.matched.includes(i));
    const second = gs.cards.findIndex((c, i) => i !== first && c !== gs.cards[first]);
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: first });
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: second });

    expect(rooms.ROOM.gameState.lockBoard).toBe(true);
    jest.runAllTimers();
    expect(rooms.ROOM.gameState.lockBoard).toBe(false);
    expect(rooms.ROOM.gameState.flipped).toHaveLength(0);
  });

  it('awards points on a match', () => {
    memorymatch('ROOM', mockIo, rooms, null);
    const gs = rooms.ROOM.gameState;
    const first  = gs.cards.findIndex((_, i) => !gs.matched.includes(i));
    const second = gs.cards.findIndex((c, i) => i !== first && c === gs.cards[first]);
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: first });
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p0', cardIndex: second });
    expect(rooms.ROOM.players[0].score).toBe(10);
    expect(rooms.ROOM.gameState.matched).toContain(first);
    expect(rooms.ROOM.gameState.matched).toContain(second);
  });

  it('rejects moves from wrong player', () => {
    memorymatch('ROOM', mockIo, rooms, null);
    const idx = 0;
    emitted = [];
    memorymatch('ROOM', mockIo, rooms, { playerId: 'p1', cardIndex: idx }); // p1, but p0's turn
    expect(emitted.some(e => e.event === 'error')).toBe(true);
  });
});
