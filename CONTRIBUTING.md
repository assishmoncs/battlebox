# Contributing to BattleBox

Thank you for contributing! Please read this before opening a PR.

## Getting Started

```bash
git clone https://github.com/assishmoncs/battlebox.git
cd battlebox/backend
npm install
cp ../.env.example ../.env
npm test          # run test suite
node server.js    # start dev server
```

## Adding a New Game

1. Create `games/yourgame.js` using the standard module signature:
   ```js
   'use strict';
   const { buildScores, endGame } = require('./utils');
   module.exports = function yourgame(roomCode, io, rooms, move) { ... };
   ```
2. Add an entry to `initialGameStates` in `backend/server.js`.
3. Register the module in `gameModules` in `backend/server.js`.
4. Add the `gameMove` dispatch `case 'yourgame'` in the switch.
5. Add the UI in `frontend/games.js` `initGameUI` switch.
6. Write unit tests in `backend/tests/yourgame.test.js`.

## Code Style

- `'use strict'` at the top of every server-side file.
- Use `const`/`let`, never `var`.
- Name socket event handlers descriptively.
- **Never** send secret values (answers, targets) in `updateGameState` broadcasts.
- All interactive frontend elements must have `aria-label` and keyboard handlers.

## Testing

```bash
cd backend && npm test
```

All PRs must pass existing tests. New games require at least:
- A unit test for scoring logic.
- A test for win/tie/lose paths.

## Pull Request Checklist

- [ ] `npm test` passes
- [ ] No new `console.error` left unhandled
- [ ] Answers/secrets not broadcast to clients
- [ ] ARIA labels on all new interactive elements
- [ ] Entry added to `docs/SOCKET_EVENTS.md` for any new events
- [ ] README updated if a new game is added
