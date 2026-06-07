'use strict';

describe('trivia - BUG-02 & SEC-05', () => {
  let rooms, mockIo, emitted;

  function makeRoom() {
    return {
      state: 'playing',
      game: 'trivia',
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

  afterEach(() => {
    // Clean up any lingering intervals
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const trivia = require('../../games/trivia');

  it('SEC-05: never broadcasts the answer index in updateGameState', () => {
    trivia('ROOM', mockIo, rooms, null);
    const updates = emitted.filter(e => e.event === 'updateGameState');
    updates.forEach(u => {
      if (u.data.gameState) {
        // The answer 'a' must never appear in broadcast gameState
        expect(u.data.gameState).not.toHaveProperty('a');
        if (u.data.gameState.question && typeof u.data.gameState.question === 'object') {
          expect(u.data.gameState.question).not.toHaveProperty('a');
        }
      }
    });
  });

  it('BUG-02: calling trivia again clears the previous timer', () => {
    trivia('ROOM', mockIo, rooms, null);
    const firstTimerRef = rooms.ROOM.timers.triviaTimer;
    expect(firstTimerRef).toBeDefined();

    // Simulate a second call (rematch scenario) — should clear first timer
    trivia('ROOM', mockIo, rooms, null);
    // Only one active timer should exist
    expect(rooms.ROOM.timers.triviaTimer).toBeDefined();
    // The reference should have changed (old one cleared)
    expect(rooms.ROOM.timers.triviaTimer).not.toBe(firstTimerRef);
  });

  it('awards points for correct answer', () => {
    trivia('ROOM', mockIo, rooms, null);
    const correctIdx = rooms.ROOM.gameState.questions[0].a;
    trivia('ROOM', mockIo, rooms, { playerId: 'p0', option: correctIdx });
    expect(rooms.ROOM.players[0].score).toBeGreaterThan(0);
  });

  it('does not award points for wrong answer', () => {
    trivia('ROOM', mockIo, rooms, null);
    const correctIdx = rooms.ROOM.gameState.questions[0].a;
    const wrongIdx   = (correctIdx + 1) % 4;
    trivia('ROOM', mockIo, rooms, { playerId: 'p0', option: wrongIdx });
    expect(rooms.ROOM.players[0].score).toBe(0);
  });

  it('prevents double-answering the same question', () => {
    trivia('ROOM', mockIo, rooms, null);
    const correctIdx = rooms.ROOM.gameState.questions[0].a;
    trivia('ROOM', mockIo, rooms, { playerId: 'p0', option: correctIdx });
    const scoreBefore = rooms.ROOM.players[0].score;
    emitted = [];
    trivia('ROOM', mockIo, rooms, { playerId: 'p0', option: correctIdx });
    expect(emitted.some(e => e.event === 'error')).toBe(true);
    expect(rooms.ROOM.players[0].score).toBe(scoreBefore);
  });
});
