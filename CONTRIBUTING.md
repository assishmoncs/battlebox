# Contributing to BattleBox

Thank you for your interest in contributing to BattleBox! We welcome pull requests, bug reports, game suggestions, and documentation improvements.

Please take a moment to review this document before submitting your contribution.

---

## 🛠️ Development Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/battlebox.git
   cd battlebox
   ```

2. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp ../.env.example ../.env
   ```

4. **Run the Test Suite**:
   ```bash
   npm test
   ```

5. **Start the Local Development Server**:
   ```bash
   node server.js
   # Or using nodemon if installed globally: nodemon server.js
   ```

---

## 🎮 How to Add a New Mini-Game

BattleBox is built with a modular architecture that makes adding new mini-games straightforward:

### Step 1: Create the Server-Side Module (`games/yourgame.js`)
Create a new file in `games/yourgame.js` following the standard game signature:

```javascript
'use strict';

const { buildScores, endGame } = require('./utils');

module.exports = function yourgame(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.timers) room.timers = {};

  // 1. Initialize state on first invocation
  if (!room.gameState.round) {
    room.gameState.round = 1;
    room.gameState.maxRounds = 5;
  }

  // 2. Initial prompt broadcast if no move provided
  if (!move) {
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `Round ${room.gameState.round}/5 - Make your move!`,
      currentPlayerId: null
    });
    return;
  }

  // 3. Process move & validate player input
  const { playerId, choice } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // 4. Update scores & advance game state
  player.score += 10;
  io.to(roomCode).emit('updatePlayers', room.players.map(({ name, score, ready }) => ({ name, score, ready })));

  // 5. Handle game completion
  if (room.gameState.round >= room.gameState.maxRounds) {
    room.timers.gameEnd = setTimeout(() => endGame(roomCode, io, rooms, 'Your Game Name'), 1500);
    return;
  }
};
```

### Step 2: Register in `backend/server.js`
1. Require the game in `gameModules`:
   ```javascript
   const gameModules = {
     // ...
     yourgame: require('../games/yourgame')
   };
   ```
2. Define default initial state in `initialGameStates`:
   ```javascript
   const initialGameStates = {
     // ...
     yourgame: () => ({ round: 1, maxRounds: 5 })
   };
   ```
3. Add a dispatch case in `socket.on('gameMove')`:
   ```javascript
   case 'yourgame':
     gameModules.yourgame(roomCode, io, rooms, { playerId: socket.id, choice });
     break;
   ```

### Step 3: Add Client-Side UI in `frontend/games.js` & `frontend/index.html`
1. Add game card to the selection grid in `frontend/index.html`.
2. Add a rendering block in `initGameUI(gameType)` switch in `frontend/games.js`.
3. Add event handlers in `setupGameListeners()` in `frontend/games.js`.

### Step 4: Write Unit Tests (`backend/tests/yourgame.test.js`)
Add unit tests verifying move validation, scoring logic, and game completion.

---

## 📏 Coding Standards & Security Rules

- **Strict Mode**: Place `'use strict';` at the top of all JavaScript files.
- **Variable Scoping**: Use `const` and `let` exclusively (never `var`).
- **Secret Isolation**: **Never** broadcast hidden answers, target solutions, or secret keys in `updateGameState` payloads.
- **Targeted Errors**: Emit input validation errors to the specific player socket (`io.to(playerId).emit('error', ...)`), not the entire room channel.
- **Timer Safety**: Always assign `setTimeout` handles into `room.timers` so they can be cleaned up cleanly on room resets.
- **Privacy**: Strip internal socket IDs (`safePlayerList`) when broadcasting player lists to room clients.
- **Accessibility**: Ensure all interactive elements include `aria-label` attributes and keyboard event listeners (`Enter`/`Space`).

---

## 📋 Pull Request Checklist

Before submitting your pull request, please ensure:

- [ ] `npm test` passes 100% cleanly without errors.
- [ ] Code follows existing project style and structure.
- [ ] No secret values or solution keys are broadcast to clients.
- [ ] Keyboard navigation and accessibility labels are included for UI elements.
- [ ] New unit tests cover your game logic or bug fix.
- [ ] Documentation (`README.md`) is updated if a new game or feature is added.
