# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Nota: usamos `npm install` en lugar de `npm ci` por un bug conocido con
# bundleDependencies optionals cross-plataforma (Tailwind v4 oxide-wasm32-wasi
# referencia @emnapi/* que npm no registra como entries propias del lockfile
# al instalar en Mac ARM). `npm install` resuelve las entries faltantes en el
# contenedor sin alterar versiones dentro de los rangos del lockfile.
RUN npm install --no-audit --no-fund

# ---------- builder ----------
FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` importa lib/db al recolectar page data y ese módulo valida
# DATABASE_URL en tiempo de carga. En build no hay DB (todas las páginas que la
# usan son force-dynamic, así que no se ejecuta ninguna query) — este placeholder
# solo satisface la validación de import. El valor real lo inyecta Kamal en
# runtime; la stage `runner` no define DATABASE_URL, así que no se filtra nada.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-prod.mjs ./scripts/migrate-prod.mjs
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
