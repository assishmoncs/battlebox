'use strict';

const higherLower = require('../../games/higherlower');

jest.useFakeTimers();

afterEach(() => jest.clearAllTimers());

function setup() {
  const events = [];
  const io = { to: () => ({ emit: (...args) => events.push(args) }) };
  const rooms = { AB12: {
    game: 'higherlower', state: 'playing',
    players: [{ id: 'p1', name: 'Alice', score: 0 }, { id: 'p2', name: 'Bob', score: 0 }],
    gameState: { current: 50, round: 1, maxRounds: 10, currentPlayer: 0, answered: false },
    timers: {}
  }};
  return { events, io, rooms };
}

describe('Higher or Lower', () => {
  test('initializes with a current value and turn', () => {
    const { events, io, rooms } = setup();
    higherLower('AB12', io, rooms);
    expect(events.at(-1)[1].gameState.current).toBe(50);
    expect(events.at(-1)[1].currentPlayerId).toBe('p1');
  });

  test('rejects invalid choices and wrong turns', () => {
    const { events, io, rooms } = setup();
    higherLower('AB12', io, rooms, { playerId: 'p2', choice: 'higher' });
    expect(events.at(-1)[1]).toContain('It is not your turn');
    higherLower('AB12', io, rooms, { playerId: 'p1', choice: 'sideways' });
    expect(events.at(-1)[1]).toContain('Invalid choice');
  });

  test('scores a correct choice and advances after the round', () => {
    const { io, rooms } = setup();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    higherLower('AB12', io, rooms, { playerId: 'p1', choice: 'higher' });
    expect(rooms.AB12.players[0].score).toBe(20);
    expect(rooms.AB12.gameState.answered).toBe(true);
    jest.advanceTimersByTime(1200);
    expect(rooms.AB12.gameState.round).toBe(2);
    expect(rooms.AB12.gameState.currentPlayer).toBe(1);
    Math.random.mockRestore();
  });
});
