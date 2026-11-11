# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root configs & package definitions
COPY package*.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

# Install dependencies and build shared-types then backend
RUN npm install
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=apps/backend

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl for container health check
RUN apk add --no-cache curl

# Copy compiled artifacts & production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared-types/package*.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/apps/backend/package*.json ./apps/backend/
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Install production dependencies only
RUN npm install --omit=dev --workspace=packages/shared-types --workspace=apps/backend

# Non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/backend/dist/server.js"]
