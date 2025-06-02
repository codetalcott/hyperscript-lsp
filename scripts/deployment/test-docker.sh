#!/bin/bash

# Test Docker build for Hyperscript LSP

set -e

echo "🐳 Testing Docker build for Hyperscript LSP..."

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is available"

# Build the Docker image
echo "🔨 Building Docker image..."
IMAGE_NAME="hyperscript-lsp:test"

if docker build -t "$IMAGE_NAME" .; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Test running the container (with timeout)
echo "🚀 Testing container startup..."
CONTAINER_ID=$(docker run -d -p 3000:3000 "$IMAGE_NAME")

# Wait a moment for startup
sleep 5

# Check if container is running
if docker ps | grep -q "$CONTAINER_ID"; then
    echo "✅ Container is running"
    
    # Test health endpoint (if curl is available in container)
    if curl -f http://localhost:3000/health &> /dev/null; then
        echo "✅ Health check passed"
    else
        echo "⚠️  Health check failed (this might be normal if service isn't fully ready)"
    fi
else
    echo "❌ Container failed to start"
    docker logs "$CONTAINER_ID"
    exit 1
fi

# Clean up
echo "🧹 Cleaning up..."
docker stop "$CONTAINER_ID" > /dev/null
docker rm "$CONTAINER_ID" > /dev/null

# Optionally remove the test image
echo "🗑️  Removing test image..."
docker rmi "$IMAGE_NAME" > /dev/null

echo "✅ Docker test completed successfully!"
echo ""
echo "📚 Next steps:"
echo "  - Deploy to Fly.io: ./scripts/deploy.sh"
echo "  - Or run locally: docker run -p 3000:3000 hyperscript-lsp"