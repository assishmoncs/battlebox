'use strict';

const oddOneOut = require('../../games/oddoneout');

jest.useFakeTimers();

afterEach(() => jest.clearAllTimers());

describe('Odd One Out', () => {
  test('broadcasts a nine-tile puzzle and current player', () => {
    const events = [];
    const io = { to: () => ({ emit: (...args) => events.push(args) }) };
    const rooms = { AB12: { game:'oddoneout', state:'playing', players:[{id:'p1',name:'A',score:0},{id:'p2',name:'B',score:0}], gameState:{}, timers:{} } };
    oddOneOut('AB12', io, rooms);
    expect(events[0][1].gameState.grid).toHaveLength(9);
    expect(events[0][1].currentPlayerId).toBe('p1');
    expect(events[0][1].gameState.answer).toBeUndefined();
  });

  test('awards points only for the correct tile', () => {
    const events = [];
    const io = { to: () => ({ emit: (...args) => events.push(args) }) };
    const rooms = { AB12: { game:'oddoneout', state:'playing', players:[{id:'p1',name:'A',score:0},{id:'p2',name:'B',score:0}], gameState:{}, timers:{} } };
    oddOneOut('AB12', io, rooms);
    oddOneOut('AB12', io, rooms, { playerId:'p1', index:3 });
    expect(rooms.AB12.players[0].score).toBe(25);
    expect(rooms.AB12.gameState.answered).toBe(true);
  });
});
