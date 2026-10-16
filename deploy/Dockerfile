# Hydria OS single-owner production runtime (separate from CRM).
FROM node:22-bookworm AS dependencies
WORKDIR /build
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
# Optional PostgreSQL Flow Manager connector uses the system psql client.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates postgresql-client \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3001 \
    HYDRIA_OS_DATA_DIR=/app/data
WORKDIR /app
COPY --from=dependencies /build/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "const h='Basic '+Buffer.from(process.env.HYDRIA_OS_ACCESS_USERNAME+':'+process.env.HYDRIA_OS_ACCESS_PASSWORD).toString('base64'); fetch('http://127.0.0.1:3001/api/health/ready',{headers:{authorization:h}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]
