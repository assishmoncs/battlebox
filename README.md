# BattleBox

BattleBox is a lightweight multiplayer mini-game platform using Socket.IO.

Players can create or join rooms and play a growing set of multiplayer mini-games:
- Reaction Battle
- Tic Tac Toe
- Word Chain
- Math Duel
- RPS Arena
- Anagram Sprint
- Number Hunt

## Project Structure

- `backend/` - Express + Socket.IO server
- `frontend/` - Static client pages and scripts
- `games/` - Game logic modules used by the server

## Requirements

- Node.js 18+ (recommended)
- npm

## Setup

1. Open a terminal in the `backend/` directory.
2. Install dependencies:

```bash
npm install
```

## Run

From `backend/`:

```bash
node server.js
```

Server starts at:

- http://localhost:3000

The server serves the frontend files automatically.

## How To Play

1. Open http://localhost:3000 in your browser.
2. Select a game.
3. Create a room or join with a room code.
4. Start the game when at least 2 players are in the room.

## Included Mini-Games

- **Reaction Battle**: Fast click-timing rounds.
- **Tic Tac Toe**: Classic 1v1 strategy.
- **Word Chain**: Build a valid chain of words.
- **Math Duel**: Turn-based quick arithmetic challenges.
- **RPS Arena**: Best-of-rounds Rock Paper Scissors.
- **Anagram Sprint**: Unscramble words under turn pressure.
- **Number Hunt**: Closest-guess number challenge by rounds.

## Notes

- Room and player state is in-memory (resets on server restart).
- No database is required for local testing.
