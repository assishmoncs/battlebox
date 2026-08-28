FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force

COPY backend ./backend
COPY games ./games
COPY frontend ./frontend
COPY .env.example ./.env.example

RUN addgroup -S battlebox && adduser -S battlebox -G battlebox \
  && chown -R battlebox:battlebox /app
USER battlebox

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "backend/server2.js"]
