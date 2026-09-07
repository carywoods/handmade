# Multi-stage Dockerfile for itsmadebyhand.com on Coolify
FROM node:24-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Production runtime stage
FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Install tsx globally or keep dev dependencies needed for tsx workers if invoked in container
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy built server assets and scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib ./src/lib

# Ensure data directory exists and declare volume for persistent SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Run seed on initial container launch if database is absent, then start server
CMD ["sh", "-c", "if [ ! -f /app/data/handmade.db ]; then tsx scripts/seed.ts; fi && node ./dist/server/entry.mjs"]
