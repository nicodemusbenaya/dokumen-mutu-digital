# Multi-stage Dockerfile khusus untuk deployment ringan di QNAP NAS (hemat memori)
FROM node:20-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build aplikasi
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment build-time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Runner (Production runtime dengan Chromium untuk PDF generation)
FROM base AS runner
WORKDIR /app

# Install Chromium untuk Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

# Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Puppeteer harus tahu path Chromium di Alpine
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
# Suppress Chromium sandbox warnings di container
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# User non-root untuk keamanan
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy hasil standalone build yang hemat memori
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pastikan nextjs user bisa akses Chromium
RUN chmod -R 755 /usr/bin/chromium-browser 2>/dev/null || true

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
