# syntax=docker/dockerfile:1
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# The SPA talks to a relative /api, reverse-proxied by nginx, so there is no
# build-time API URL to inject — a single static build serves every environment.
RUN npm run build

# ── Runtime stage (nginx serves the static SPA + proxies /api) ────────────────
# Pinned to the nginx stable branch that carries the nginx2root fixes
# (CVE-2026-123007 and the four related flaws). 1.27 is an EOL mainline
# release and will never receive them, so don't float this back.
FROM nginx:1.30.7-alpine AS runtime

# Replace the default server with our SPA + reverse-proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
