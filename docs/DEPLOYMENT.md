# Deployment Guide

## Prerequisites
- Node.js 18+ 
- npm 9+
- A server / VPS (Ubuntu 22.04 recommended)

## Local Development

```bash
git clone https://github.com/assishmoncs/battlebox.git
cd battlebox/backend
npm install
cp ../.env.example ../.env   # edit as needed
node server.js
# → http://localhost:3000
```

## Production with PM2

```bash
npm install -g pm2
cd battlebox/backend
npm install --omit=dev
pm2 start server.js --name battlebox
pm2 save
pm2 startup          # follow the printed command to enable on reboot
```

## Docker

```dockerfile
# Dockerfile (place in repo root)
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY . .
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "backend/server.js"]
```

```bash
docker build -t battlebox .
docker run -d -p 3000:3000 \
  -e ALLOWED_ORIGIN=https://yourdomain.com \
  --name battlebox battlebox
```

## Nginx Reverse Proxy (HTTPS)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        # Required for Socket.IO WebSocket upgrades
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port to listen on |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for Socket.IO |
| `NODE_ENV` | `development` | `production` disables verbose logging |

## Health Check

```bash
curl http://localhost:3000/health
# → {"status":"ok","activeRooms":0,"uptime":42.1}
```
