# Use Bun runtime
FROM oven/bun:1-alpine

# Install Node.js for compatibility
RUN apk add --no-cache nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Copy the database file
COPY ../src/hyperscript.db ./src/hyperscript.db

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the remote server
CMD ["node", "dist/remote-server.js"]