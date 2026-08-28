'use strict';

const { definitions, getGame, getAllGames, modules, initialGameStates } = require('../../games/registry');

describe('game registry', () => {
  test('contains 15 unique playable games', () => {
    expect(definitions).toHaveLength(15);
    expect(new Set(definitions.map(g => g.id)).size).toBe(15);
    expect(Object.keys(modules)).toHaveLength(15);
  });

  test('every definition has valid metadata and an initial state factory', () => {
    for (const game of definitions) {
      expect(game.minPlayers).toBeGreaterThanOrEqual(2);
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
      expect(typeof initialGameStates[game.id]).toBe('function');
      expect(typeof modules[game.id]).toBe('function');
      expect(getGame(game.id)).toBeTruthy();
    }
  });

  test('public catalog excludes executable internals', () => {
    const publicGames = getAllGames();
    expect(publicGames[0]).not.toHaveProperty('module');
    expect(publicGames[0]).not.toHaveProperty('initialState');
  });
});
