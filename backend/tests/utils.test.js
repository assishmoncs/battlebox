'use strict';

const { buildScores, shuffleArray, clearAllGameTimers, determineWinner } = require('../../games/utils');

describe('buildScores', () => {
  it('maps player names to scores', () => {
    const room = { players: [{ name: 'Alice', score: 10 }, { name: 'Bob', score: 5 }] };
    expect(buildScores(room)).toEqual({ Alice: 10, Bob: 5 });
  });

  it('defaults missing scores to 0', () => {
    const room = { players: [{ name: 'Alice' }] };
    expect(buildScores(room)).toEqual({ Alice: 0 });
  });

  it('returns {} for empty players', () => {
    expect(buildScores({ players: [] })).toEqual({});
  });
});

describe('shuffleArray', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(arr.length);
  });

  it('contains the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr).sort()).toEqual([...arr].sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    shuffleArray(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('clearAllGameTimers', () => {
  it('clears all timeout/interval references', () => {
    jest.useFakeTimers();
    let fired = false;
    const room = { timers: { t1: setTimeout(() => { fired = true; }, 5000) } };
    clearAllGameTimers(room);
    jest.runAllTimers();
    expect(fired).toBe(false);
    expect(room.timers).toEqual({});
    jest.useRealTimers();
  });

  it('handles missing timers object gracefully', () => {
    expect(() => clearAllGameTimers({ players: [] })).not.toThrow();
  });
});

describe('determineWinner', () => {
  it('finds a clear winner', () => {
    const room = { players: [{ name: 'Alice', score: 20 }, { name: 'Bob', score: 10 }] };
    const { winner, isTie } = determineWinner(room);
    expect(isTie).toBe(false);
    expect(winner.name).toBe('Alice');
  });

  it('detects a tie correctly (BUG-08 fix)', () => {
    const room = { players: [{ name: 'Alice', score: 10 }, { name: 'Bob', score: 10 }] };
    const { winner, isTie } = determineWinner(room);
    expect(isTie).toBe(true);
    expect(winner).toBeNull();
  });

  it('handles empty player list', () => {
    const { winner, isTie } = determineWinner({ players: [] });
    expect(winner).toBeNull();
    expect(isTie).toBe(false);
  });
});
