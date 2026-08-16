# syntax=docker/dockerfile:1
# MANEXA — multi-stage production image (Next.js standalone + Prisma)

# ---- deps: install with a clean lockfile ----
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma's query engine needs openssl + libc compat on Alpine.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- builder: generate client + build (also used as the migrate/seed image) ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---- runner: minimal standalone server, non-root ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S manexa && adduser -S manexa -G manexa
# Standalone server + static assets + Prisma client engine.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
USER manexa
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
