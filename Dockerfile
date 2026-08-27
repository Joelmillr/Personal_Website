# ============================================
# personal-website — Dockerfile
# Mirrors render.yaml: Node 18.17.0, npm install + preprocess at build,
# node --max-old-space-size=512 server.js at runtime.
# ============================================
FROM node:18.17.0-bookworm-slim AS base

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy application source
COPY . .

# Preprocess flight data (matches Render buildCommand: npm run preprocess)
RUN node flight-display/server/preprocessData.js

# Non-root user for safety
RUN useradd --create-home --uid 1001 appuser \
    && chown -R appuser:appuser /app
USER appuser

# Health check — same port as Render's healthCheckPath but /health is the real endpoint
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(d=>{if(d.status!=='OK')process.exit(1);console.log('healthy')}).catch(()=>process.exit(1))"

CMD ["node", "--max-old-space-size=512", "server.js"]
