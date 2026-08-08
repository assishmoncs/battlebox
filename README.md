# BattleBox 🎮

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-black.svg)](https://socket.io/)
[![Express](https://img.shields.io/badge/Express.js-v5.0-lightgrey.svg)](https://expressjs.com/)

**BattleBox** is a real-time multiplayer gaming arena featuring **12 competitive mini-games** powered by Node.js, Express, and Socket.IO. Designed with a sleek cyberpunk aesthetic, BattleBox delivers fast-paced, low-latency battles for desktop and mobile browsers.

---

## 🌟 Key Features

- ⚡ **12 Real-Time Multiplayer Mini-Games**: Across Speed, Strategy, Word, Math, Classic, and Trivia categories.
- 🔄 **Real-Time Synchronization**: Instant state sync powered by Socket.IO with automatic reconnection grace handling.
- 🎨 **Modern Cyberpunk UI**: Built with a vibrant dark-mode design system, smooth CSS animations, dynamic scoreboards, and responsive layouts.
- 💬 **Lobby & In-Game Chat**: Real-time room chat system with server-sanitized player identification.
- 🎯 **Host Controls & Rematch System**: Coordination tools including player ready states, host delegation, and one-click rematch functionality.
- 🛡️ **Hardened Security**: Server-side secret isolation, Helmet security headers, rate limiting, and privacy-preserving player list broadcasts.

---

## 🎮 Game Library

| Game | Category | Description | Players | Rounds / Length |
| :--- | :--- | :--- | :---: | :---: |
| **Reaction Battle** ⚡ | Speed | Reflex test — tap the target the instant it turns GREEN! | 2–8 | 5 Rounds |
| **Speed Typing** ⌨️ | Speed | Type displayed words accurately under time pressure. | 2–8 | 10 Words |
| **Color Match** 🎨 | Speed | Stroop effect challenge! Select the text COLOR, not the word. | 2–8 | 10 Rounds |
| **Tic Tac Toe** ⭕ | Strategy | Classic 1v1 turn-based grid battle. | 2 | 1 Game |
| **Memory Match** 🧩 | Strategy | Flip and match hidden emoji card pairs on a 4x4 grid. | 2–8 | 8 Pairs |
| **Simon Says** 🎵 | Strategy | Memorize and repeat color sequences that grow each round. | 2–8 | Up to 8 Rounds |
| **Word Chain** 🔗 | Word | Chain words where each word starts with the previous word's final letter. | 2–8 | 5 Turns / Player |
| **Anagram Sprint** 🔤 | Word | Unscramble scrambled words under tight time limits. | 2–8 | 10 Puzzles |
| **Math Duel** 🔢 | Math | Race to solve mental arithmetic challenges correctly. | 2–8 | 12 Turns |
| **Number Hunt** 🎯 | Math | Submit secret guesses closest to the target number (10–30). | 2–8 | 6 Rounds |
| **RPS Arena** ✊ | Classic | Multi-round Rock-Paper-Scissors arena with simultaneous reveals. | 2 | 5 Rounds |
| **Trivia Challenge** ❓ | Trivia | 15 timed trivia questions with speed-weighted scoring. | 2–8 | 15 Questions |

---

## 🏗️ Architecture & Project Structure

```text
battlebox/
├── backend/
│   ├── server.js          # Express server & Socket.IO event orchestrator
│   ├── package.json       # Backend dependencies & test script runner
│   └── tests/             # Comprehensive Jest test suite (71 unit tests)
├── frontend/
│   ├── index.html         # Landing page & game selection grid
│   ├── lobby.html         # Multiplayer lobby, room code sharing, chat & ready system
│   ├── game.html          # Dynamic game view & victory/defeat modal
│   ├── games.js           # Client-side renderer & Socket.IO event listeners
│   ├── script.js          # Landing page interaction & validation logic
│   └── style.css          # Cyberpunk design system stylesheet
├── games/                 # Isolated server-side game modules
│   ├── utils.js           # Shared game helpers (scoring, timers, winner determination)
│   ├── reaction.js
│   ├── tictactoe.js
│   ├── wordchain.js
│   ├── mathduel.js
│   ├── rpsarena.js
│   ├── anagram.js
│   ├── numberhunt.js
│   ├── memorymatch.js
│   ├── speedtyping.js
│   ├── colormatch.js
│   ├── simonsays.js
│   └── trivia.js
├── SECURITY.md            # Security policy & responsible disclosure guidelines
├── CONTRIBUTING.md        # Developer setup & game module contribution guidelines
└── LICENSE                # MIT License
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/assishmoncs/battlebox.git
   cd battlebox
   ```

2. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp ../.env.example ../.env
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open in Browser**:
   Navigate to `http://localhost:3000` to begin playing!

---

## ⚙️ Environment Configuration

Edit `.env` to configure your deployment environment:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP & WebSocket server port |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | CORS allowed origin (set to production domain in production) |
| `NODE_ENV` | `development` | Environment mode (`development` \| `production`) |

---

## 🧪 Testing

BattleBox features an extensive Jest test suite covering all 12 mini-games, server security, and utility functions:

```bash
cd backend
npm test
```

---

## 🔍 Health Monitoring

The server exposes a lightweight health check endpoint for uptime monitoring:

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "activeRooms": 3,
  "uptime": 1420.85
}
```

---

## 🛡️ Security & Privacy Features

- **Helmet Protection**: CSP, frame-guard, and XSS protection headers pre-configured.
- **Server Secret Isolation**: Target answers, trivia keys, and color solutions remain strictly server-side.
- **Socket ID Stripping**: Player lists strip internal socket connection IDs before room broadcasts.
- **Rate Limiting**: IP-keyed rate limiting protects socket channels against event flooding.

For detailed information, view our [Security Policy](SECURITY.md).

---

## 🤝 Contributing

We welcome community contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to learn about codebase standards, how to add a new game module, and pull request workflows.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
