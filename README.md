# BattleBox 🎮

[![CI](https://github.com/assishmoncs/battlebox/actions/workflows/ci.yml/badge.svg)](https://github.com/assishmoncs/battlebox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black.svg)](https://socket.io/)

BattleBox is a real-time multiplayer browser gaming arena built with Node.js, Express and Socket.IO. Players create a room, invite friends with a short code, and compete in fast mini-games with server-authoritative rules and synchronized scoring.

## 🎮 Game library

BattleBox currently ships with 15 games across speed, strategy, word, math, classic and trivia categories.

| Game | Players | Format |
|---|---:|---|
| Reaction Battle ⚡ | 2–8 | 5 rounds |
| Speed Typing ⌨️ | 2–8 | 10 words |
| Color Match 🎨 | 2–8 | 10 rounds |
| Tic Tac Toe ⭕ | 2 | 1 game |
| Memory Match 🧩 | 2–8 | 8 pairs |
| Simon Says 🎵 | 2–8 | 8 rounds |
| Word Chain 🔗 | 2–8 | 5 turns/player |
| Anagram Sprint 🔤 | 2–8 | 10 puzzles |
| Math Duel 🔢 | 2–8 | 12 turns |
| Number Hunt 🎯 | 2–8 | 6 rounds |
| RPS Arena ✊ | 2 | 5 rounds |
| Trivia Challenge ❓ | 2–8 | 15 questions |
| Connect Four 🔴 | 2 | 1 game |
| Higher or Lower ↕️ | 2 | 10 rounds |
| Odd One Out 👀 | 2 | 6 rounds |

The game catalog is generated from `games/registry.js` and exposed to the browser through `/api/games`, so metadata is not duplicated across the UI and server.

## 🏗️ Architecture

```text
Browser
  │
  ├── index.html / lobby.html / game.html
  │
  └── Socket.IO
          │
          ▼
     backend/server2.js
          │
     ┌────┴────┐
     │         │
RoomManager  Validation + Rate Limits
     │
     ▼
Game Registry
     │
     ▼
Game Modules (`games/*.js`)
```

### Design principles

- **Server authoritative:** clients send intents; the server validates turns, bounds and scoring.
- **Hidden-state protection:** answers, targets and unrevealed Memory Match cards stay server-side.
- **Central registry:** one game definition controls metadata, limits, modules and initial state.
- **Lifecycle safety:** all game timers are stored under `room.timers` and cleaned during rematches/disconnects.
- **Reconnect grace:** disconnected players can reclaim their room slot during the grace period.
- **Production-ready baseline:** Helmet, CORS restrictions, payload limits, layered rate limiting, `/health`, `/ready`, Docker and CI are included.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/GAME_DEVELOPMENT.md](docs/GAME_DEVELOPMENT.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 🚀 Quick start

Prerequisites: Node.js 20+ and npm.

```bash
git clone https://github.com/assishmoncs/battlebox.git
cd battlebox/backend
npm ci
npm start
```

Open `http://localhost:3000`.

### Docker

```bash
docker compose up --build
```

## 🧪 Quality checks

```bash
cd backend
npm test
npm run test:coverage
npm run syntax
```

GitHub Actions runs dependency installation, repository-wide JavaScript syntax validation, the Jest suite, and a production dependency audit on pushes and pull requests.

## 🔐 Security

BattleBox uses Helmet security headers, configurable Socket.IO origin restrictions, server-side room-code generation, validated payloads, rate limiting, authoritative player identity, and explicit protection for hidden game state. See [SECURITY.md](SECURITY.md).

## 📁 Repository structure

```text
backend/
  server.js                 legacy implementation retained for reference
  server2.js                modular production-oriented server
  room-manager.js           room lifecycle abstraction
  validation.js             shared payload validation
  tests/                    Jest tests
frontend/
  index.html                dynamic game catalog
  lobby.html                multiplayer lobby
  game.html                 game shell
  games.js                  existing game UI implementations
  extended-games.js         new game UI implementations
games/
  registry.js               single source of truth for game metadata
  utils.js                  shared game helpers
  *.js                      server-authoritative game rules
docs/
  ARCHITECTURE.md
  GAME_DEVELOPMENT.md
  DEPLOYMENT.md
.github/workflows/
  ci.yml
Dockerfile
docker-compose.yml
```

## 🤝 Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Every new game must be registered, validate moves, protect hidden state, clean up timers, and include tests.

## 📄 License

MIT — see [LICENSE](LICENSE).
