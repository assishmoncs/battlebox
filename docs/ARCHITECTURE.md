# BattleBox Architecture

BattleBox is a server-authoritative real-time multiplayer platform. Browser clients send intents; the server validates and applies moves, owns secrets, updates scores, and broadcasts public state.

## Runtime flow

```text
Browser A ─┐
           ├─ Socket.IO ─> RoomManager ─> Game Registry ─> Game Module
Browser B ─┘                    │               │
                                ├─ validation   ├─ rules
                                ├─ rate limits  └─ scoring
                                └─ lifecycle
```

## Core boundaries

- `backend/server2.js` owns transport, authentication-by-room-membership, validation, rate limits, health endpoints, and dispatch.
- `backend/room-manager.js` owns room lifecycle, reconnect grace periods, host transfer, and cleanup.
- `backend/validation.js` owns reusable payload validation primitives.
- `games/registry.js` is the single source of truth for game IDs, labels, categories, limits, modules, and initial state.
- `games/*.js` contains server-authoritative game rules.
- `frontend/games.js` contains the legacy game UI implementations; `frontend/extended-games.js` adds the registry extensions without duplicating the legacy renderer.

## State safety

Never broadcast the raw server game state. Hidden solutions, targets, answer keys, and unrevealed memory cards must stay server-side. Reconnection uses a sanitized public projection.

## Scalability path

The current process keeps transient rooms in memory, which is appropriate for a single-server deployment. For horizontal scaling, introduce Redis as the Socket.IO adapter and shared coordination layer before adding multiple app instances. Persistent match history belongs in a database, not in the room object.

## State lifecycle

```text
LOBBY -> PLAYING -> GAME OVER -> LOBBY
              \-> PLAYER DISCONNECT -> grace -> reconnect/remove
```

All timers must live under `room.timers` so rematches and cleanup can cancel them deterministically.
