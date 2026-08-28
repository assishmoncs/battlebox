# Contributing to BattleBox

BattleBox is a server-authoritative real-time multiplayer platform. Contributions should preserve deterministic game state, safe payload handling, accessibility, and timer cleanup.

## Development

```bash
git clone https://github.com/your-username/battlebox.git
cd battlebox/backend
npm ci
npm test
npm run syntax
npm start
```

## Adding a game

1. Add the server module under `games/`.
2. Register it in `games/registry.js` with metadata, player limits, module path, and initial state.
3. Add a client renderer when the existing renderer does not cover the game.
4. Validate all game-specific moves on the server.
5. Keep hidden answers/targets/unrevealed state off the wire.
6. Store every timer in `room.timers` so rematches and disconnect cleanup can cancel it.
7. Add unit tests for initialization, valid/invalid moves, turns, scoring, completion, and timer behavior.

## Coding standards

- Use `'use strict';`.
- Use `const`/`let`; never `var`.
- Prefer small functions with one responsibility.
- Keep identity server-authoritative.
- Reject malformed or oversized payloads early.
- Broadcast only client-safe game state.
- Interactive controls must have keyboard/focus support and accessible labels.
- Never commit secrets or `.env` files.

## Verification

Every pull request should pass:

```bash
cd backend
npm ci
npm run syntax
npm test -- --runInBand
npm audit --omit=dev --audit-level=high
```

The GitHub Actions workflow runs these checks automatically for pushes and pull requests.

## Pull request checklist

- [ ] Tests pass.
- [ ] Syntax check passes.
- [ ] No hidden game state is broadcast.
- [ ] Timer handles are cleaned up.
- [ ] New game metadata is registered.
- [ ] README/docs are updated when behavior changes.
- [ ] Mobile and keyboard behavior has been checked.
