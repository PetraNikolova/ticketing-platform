# syntax=docker/dockerfile:1
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Prisma needs OpenSSL to pick the right query-engine at generate/build time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). Includes the Prisma CLI
# (a devDependency) — needed both to generate the client and to run migrations
# on boot in the runtime stage.
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# OpenSSL is required by the Prisma engine at runtime too.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# NOTE: NODE_ENV is intentionally left unset (i.e. not "production"). The session
# cookie sets `secure: NODE_ENV === 'production'`; in this HTTP-only compose demo
# a Secure cookie would be dropped by the browser and login would fail. Put the
# stack behind TLS and set NODE_ENV=production for a real deployment.

# Bring over the installed modules (incl. the Prisma CLI + generated client),
# the compiled output, the schema/migrations, and the manifest.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

EXPOSE 3000

# Apply any pending migrations, then start. `migrate deploy` is idempotent and
# inserts no application rows, so a fresh DB starts with schema + migration
# metadata only (a Definition-of-Done requirement).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
