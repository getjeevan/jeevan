# Stage 1: Build
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-bullseye-slim AS runtime

WORKDIR /app

# Copy package files for production install
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3225

# Expose the application port
EXPOSE 3225

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3225/api/stats', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run the application
CMD ["node", "dist/index.cjs"]
