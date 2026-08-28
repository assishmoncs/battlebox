# Game Development Guide

Every game must be server-authoritative and registered in `games/registry.js`.

## Contract

A game module exports:

```js
module.exports = function game(roomCode, io, rooms, move) { ... };
```

The module must:

1. Validate its own game-specific rules in addition to transport validation.
2. Keep hidden answers/targets server-side.
3. Store every timer handle in `room.timers`.
4. Reject duplicate, out-of-turn, out-of-range, or post-game moves.
5. Emit `updateGameState` with only client-safe state and `scores` from `buildScores(room)`.
6. End through `endGame(roomCode, io, rooms, 'Human Game Name')`.

## Registration

Add one definition to `games/registry.js` containing:

- `id`
- `name` and `shortName`
- `category`
- `icon`
- `minPlayers` / `maxPlayers`
- `length`
- module path
- initial-state factory

The frontend game catalog is generated from `/api/games`, so adding metadata to the registry automatically makes the game selectable.

## Testing checklist

Each game should have tests for initial state, valid moves, invalid moves, wrong turns, scoring, completion, ties where applicable, timer cleanup, and rematch safety.
