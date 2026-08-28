# BattleBox Deployment

## Local development

```bash
cd backend
npm ci
npm start
```

Open `http://localhost:3000`.

## Docker

```bash
docker compose up --build -d
```

The image uses Node 20 Alpine, installs production dependencies only, runs as a non-root user, exposes port 3000, and checks `/health`.

## Production environment

Set:

```text
NODE_ENV=production
PORT=3000
ALLOWED_ORIGIN=https://yourdomain.com
TRUST_PROXY=true
```

Terminate TLS at a reverse proxy/load balancer and forward WebSocket upgrades. Only the production origin should be allowed for Socket.IO.

## PM2

For a single-VPS deployment without Docker:

```bash
cd backend
npm ci --omit=dev
pm2 start server2.js --name battlebox
pm2 save
pm2 startup
```

## Nginx WebSocket proxy

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;
}
```

## Health endpoints

```text
GET /health
GET /ready
GET /api/games
```

## Scaling

The current room state is process-local. Use one app instance for the simplest deployment. Before horizontal scaling, add Redis for Socket.IO coordination and shared rate limiting/session state. Add a persistent database only for durable accounts, ratings, match history, or analytics.
