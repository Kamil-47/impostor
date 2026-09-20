# ---------- Stage 1: install deps + build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json shared/
COPY server/package.json server/tsconfig.json server/
COPY client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/

RUN npm ci

COPY shared/src/ shared/src/
COPY server/src/ server/src/
COPY client/src/ client/src/

RUN npm run build
RUN npm prune --omit=dev

# ---------- Stage 2a: server runtime ----------
FROM node:20-alpine AS server

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/client/package.json client/
COPY --from=builder /app/shared/dist/ shared/dist/
COPY --from=builder /app/server/dist/ server/dist/
COPY --from=builder /app/server/src/data/ server/dist/data/
COPY --from=builder /app/node_modules/ node_modules/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/dist/index.js"]

# ---------- Stage 2b: client runtime ----------
FROM nginx:alpine AS client

COPY --from=builder /app/client/dist/ /usr/share/nginx/html/
COPY docker/client.nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
