# Multi-stage Dockerfile for itsmadebyhand.com on Coolify
FROM node:24-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache python3 make g++
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

# Install runtime shared libraries and set PATH
RUN apk add --no-cache libstdc++
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy pre-compiled node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built server assets, data, and scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/data ./data

# Ensure data directory exists and declare volume for persistent SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Run seed on container launch to ensure persistent volume database is synced, then start server
CMD ["sh", "-c", "tsx scripts/seed.ts && node ./dist/server/entry.mjs"]
