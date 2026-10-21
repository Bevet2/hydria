# Hydria OS single-owner production runtime (separate from CRM).
FROM node:22-bookworm AS dependencies
WORKDIR /build
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --no-audit --no-fund
COPY frontend/ ./frontend/
COPY backend/scripts/buildFrontend.mjs backend/scripts/patchHydriaFigCraft.mjs backend/scripts/prepareHydriaFigCraftBuild.mjs backend/scripts/installArtCraftWeb.mjs backend/scripts/installPdfCraft.mjs ./backend/scripts/
# Optional official-source, MIT/Apache-2.0 FigCraft v0.8.0 build with the
# explicit Hydria native file-open/save Rust patch. Never use an unverified
# binary replacement: pin git SHA and compile the actual full-fidelity engine.
# Build toolchain stays in this discarded build stage, not the runtime image.
ARG INSTALL_FIGCRAFT_NATIVE=false
RUN if [ "$INSTALL_FIGCRAFT_NATIVE" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl git build-essential pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*; \
      curl --fail --silent --show-error --location https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.95.0; \
      export PATH="/root/.cargo/bin:$PATH"; \
      rustup target add wasm32-unknown-unknown; \
      cargo install trunk --locked --version 0.21.14; \
      git clone --depth 1 --branch v0.8.0 https://github.com/storytold/figcraft.git /tmp/hydria-native-figcraft; \
      test "$(git -C /tmp/hydria-native-figcraft rev-parse HEAD)" = "594dc8c6cf50a03b6d88abce877794f286f759b9"; \
      node backend/scripts/patchHydriaFigCraft.mjs /tmp/hydria-native-figcraft; \
      (cd /tmp/hydria-native-figcraft/apps/figcraft-web && trunk build --release); \
      node backend/scripts/prepareHydriaFigCraftBuild.mjs /tmp/hydria-native-figcraft /build/frontend/vendor/figcraft; \
      rm -rf /tmp/hydria-native-figcraft; \
    fi
RUN node backend/scripts/buildFrontend.mjs && npm prune --prefix backend --omit=dev --no-audit --no-fund

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
COPY --from=dependencies --chown=node:node /build/frontend-dist/ ./frontend/
COPY --chown=node:node crm/apps/api/crm-workspace-tools.json ./crm/apps/api/crm-workspace-tools.json
# Optional, integrity-verified ArtCraft PdfCraft v0.9.0 WebAssembly.
# Opt-in until isolation and multi-user permissions are hardened.
ARG INSTALL_PDFCRAFT=false
RUN if [ "$INSTALL_PDFCRAFT" = "true" ]; then node backend/scripts/installPdfCraft.mjs; fi
ARG INSTALL_PHOTOCRAFT=false
ARG INSTALL_FIGCRAFT=false
ARG INSTALL_FIGCRAFT_NATIVE=false
RUN if [ "$INSTALL_PHOTOCRAFT" = "true" ]; then node backend/scripts/installArtCraftWeb.mjs photo; fi
# A verified native build was copied from dependencies via frontend-dist.
# Never overwrite it with upstream WASM, where pathless Save is unsupported.
RUN if [ "$INSTALL_FIGCRAFT" = "true" ] && [ "$INSTALL_FIGCRAFT_NATIVE" != "true" ]; then node backend/scripts/installArtCraftWeb.mjs fig; fi
RUN if [ "$INSTALL_FIGCRAFT_NATIVE" = "true" ]; then test -f frontend/vendor/figcraft/index.html && grep -q 'data-hydria-fig-native="1"' frontend/vendor/figcraft/index.html; fi
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "const h='Basic '+Buffer.from(process.env.HYDRIA_OS_ACCESS_USERNAME+':'+process.env.HYDRIA_OS_ACCESS_PASSWORD).toString('base64'); fetch('http://127.0.0.1:3001/api/health/ready',{headers:{authorization:h}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]
