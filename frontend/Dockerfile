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
FROM nginx:1.27-alpine AS runtime

# Replace the default server with our SPA + reverse-proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
