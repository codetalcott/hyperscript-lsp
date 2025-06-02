# Use Bun runtime
FROM oven/bun:1.2-alpine AS base

# Install system dependencies
RUN apk add --no-cache sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN bun build --target=bun --outdir=dist src/server/main.ts

# Copy the database (if it exists)
COPY src/hyperscript.db ./src/hyperscript.db 2>/dev/null || echo "Database not found, will be created at runtime"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version && curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["bun", "run", "src/server/main.ts"]