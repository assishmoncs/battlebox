'use strict';

const http = require('http');
const { io: connectClient } = require('socket.io-client');
const runtime = require('../server2');

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (...args) => { clearTimeout(timer); resolve(args); });
  });
}

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ port, path }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

describe('server2 integration', () => {
  let port;
  let host;
  let guest;

  beforeAll(async () => {
    await new Promise(resolve => runtime.server.listen(0, resolve));
    port = runtime.server.address().port;
  });

  afterAll(async () => {
    host?.disconnect();
    guest?.disconnect();
    runtime.roomManager.rooms = Object.create(null);
    await new Promise(resolve => runtime.server.close(resolve));
  });

  test('serves health and a 15-game public catalog', async () => {
    const health = await getJson(port, '/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const games = await getJson(port, '/api/games');
    expect(games.status).toBe(200);
    expect(games.body.games).toHaveLength(15);
    expect(games.body.games.map(g => g.id)).toContain('connectfour');
    expect(games.body.games[0].module).toBeUndefined();
  });

  test('creates a room, joins a second client and starts Connect Four', async () => {
    host = connectClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await waitFor(host, 'connect');

    const created = await new Promise(resolve => host.emit('createRoom', { game: 'connectfour', playerName: 'Alice' }, resolve));
    expect(created.ok).toBe(true);
    expect(created.room).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);

    guest = connectClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await waitFor(guest, 'connect');
    const roomInfo = waitFor(guest, 'roomInfo');
    guest.emit('joinRoom', { room: created.room, playerName: 'Bob' });
    await roomInfo;

    const started = waitFor(guest, 'gameStarted');
    host.emit('startGame', created.room);
    await started;

    const state = waitFor(guest, 'updateGameState');
    host.emit('gameMove', { room: created.room, column: 3 });
    const [payload] = await state;
    expect(payload.gameState.currentPlayer).toBe(1);
    expect(payload.gameState.board).toHaveLength(42);
    expect(payload.gameState.board.filter(Boolean)).toHaveLength(1);
  });
});
