# BattleBox Socket.IO Event Reference

All events use the default Socket.IO namespace `/`.

## Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `createRoom` | `{ game: string, playerName: string }` + ack callback | Create a new room. Server responds via ack: `{ ok: boolean, room?: string, error?: string }` |
| `joinRoom` | `{ room: string, playerName: string }` | Join an existing room (or rejoin after disconnect) |
| `playerReady` | `{ room: string, ready: boolean }` | Toggle ready state in lobby |
| `chatMessage` | `{ room: string, message: string }` | Send a lobby/game chat message |
| `startGame` | `roomCode: string` | Host starts the game (host only) |
| `reactionClick` | `roomCode: string` | Click the reaction target |
| `gameMove` | `{ room, pos?, word?, answer?, choice?, guess?, cardIndex?, typed?, color?, sequence?, option? }` | Submit a move for any game |
| `requestRematch` | `roomCode: string` | Host requests a rematch (host only) |

## Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `youAreHost` | `true` | Sent to the room host on join/reconnect |
| `roomInfo` | `{ game, hostId, hostName }` | Room metadata broadcast |
| `updatePlayers` | `Array<{ name, score, ready }>` | Sanitised player list (no socket IDs) |
| `chatMessage` | `{ playerName, message }` | Broadcast chat message |
| `gameStarted` | _(none)_ | Game has begun; clients navigate to game.html |
| `updateGameState` | `{ gameState, scores, status, currentPlayerId? }` | Game state update — answers/targets are never included |
| `gameOver` | `{ winner: string \| null }` | Game ended; `winner` is null on a tie |
| `rematchAvailable` | _(none)_ | Host requested rematch; clients return to lobby |
| `error` | `string` | Error message for the receiving client only |

## Notes

- `gameState` objects in `updateGameState` **never** contain correct answers, targets, or other secret values.
- Socket IDs are **never** broadcast to other clients via `updatePlayers`.
- Room codes are generated server-side using `crypto.randomBytes`.
