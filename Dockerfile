# SSI Voting Backend - Fly.io Production Image
# better-sqlite3 native bindings için Debian-based slim image kullanıyoruz.

FROM node:18-bullseye-slim AS builder

WORKDIR /app

# better-sqlite3 derlemek için build araçları
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./

# --- Runtime stage (daha küçük image) ---
FROM node:18-bullseye-slim AS runtime

WORKDIR /app

# better-sqlite3 .node binding'i çalışsın diye libstdc++ kalmalı (slim'de zaten var)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app -d /app -s /bin/bash app

COPY --from=builder --chown=app:app /app /app

# Persistent volume mount point (fly volume buraya bağlanır)
RUN mkdir -p /var/data && chown -R app:app /var/data

USER app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DB_PATH=/var/data/database.db

EXPOSE 8080

# tini = düzgün signal handling (fly suspend/resume için)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
