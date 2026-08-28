'use strict';

const { RoomManager, ROOM_STATES } = require('../room-manager');

jest.useFakeTimers();

afterEach(() => jest.clearAllTimers());

describe('RoomManager', () => {
  test('creates unique four-character rooms', () => {
    const manager = new RoomManager();
    const room = manager.create('reaction', { id: 'a', sessionId: 's1', name: 'Alice', score: 0, ready: false });
    expect(room).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(manager.get(room).state).toBe(ROOM_STATES.LOBBY);
  });

  test('rejects duplicate names and room overflow', () => {
    const manager = new RoomManager({ maxPlayers: 2 });
    const code = manager.create('reaction', { id: 'a', sessionId: 's1', name: 'Alice', score: 0, ready: false });
    expect(manager.addPlayer(code, { id: 'b', sessionId: 's2', name: 'Alice', score: 0, ready: false }).ok).toBe(false);
    expect(manager.addPlayer(code, { id: 'b', sessionId: 's2', name: 'Bob', score: 0, ready: false }).ok).toBe(true);
    expect(manager.addPlayer(code, { id: 'c', sessionId: 's3', name: 'Carol', score: 0, ready: false }).ok).toBe(false);
  });

  test('supports reconnect within the grace period', () => {
    const manager = new RoomManager({ reconnectGraceMs: 15000 });
    const code = manager.create('reaction', { id: 'old', sessionId: 'stable', name: 'Alice', score: 12, ready: true });
    manager.removeSocket('old');
    jest.advanceTimersByTime(5000);
    const result = manager.rejoin(code, 'Alice', 'new');
    expect(result.ok).toBe(true);
    expect(manager.get(code).players[0].id).toBe('new');
    expect(manager.get(code).players[0].score).toBe(12);
  });

  test('transfers host when host leaves after grace period', () => {
    const manager = new RoomManager({ reconnectGraceMs: 1000 });
    const code = manager.create('reaction', { id: 'a', sessionId: 's1', name: 'Alice', score: 0, ready: false });
    manager.addPlayer(code, { id: 'b', sessionId: 's2', name: 'Bob', score: 0, ready: false });
    const events = [];
    manager.removeSocket('a', event => events.push(event));
    jest.advanceTimersByTime(1000);
    expect(manager.get(code).host).toBe('b');
    expect(events.some(e => e.hostChanged)).toBe(true);
  });
});
