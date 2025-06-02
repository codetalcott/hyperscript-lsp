#!/bin/bash

# Hyperscript LSP Deployment Script for Fly.io

set -e

echo "🚀 Deploying Hyperscript LSP to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first:"
    echo "   brew install flyctl"
    echo "   or visit: https://fly.io/docs/getting-started/installing-flyctl/"
    exit 1
fi

# Check if user is logged in
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run:"
    echo "   flyctl auth login"
    exit 1
fi

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Check if app exists
APP_NAME="hyperscript-lsp"
if ! flyctl apps list | grep -q "$APP_NAME"; then
    echo "📦 Creating new Fly.io app: $APP_NAME"
    flyctl apps create "$APP_NAME"
else
    echo "✅ App $APP_NAME already exists"
fi

# Check if database exists and is populated
if [ ! -f "src/hyperscript.db" ]; then
    echo "⚠️  Database not found. Creating and populating database..."
    cd src/scripts
    bun run db-init.ts
    cd ../..
fi

# Verify database has data
DB_SIZE=$(wc -c < src/hyperscript.db)
if [ "$DB_SIZE" -lt 1000 ]; then
    echo "⚠️  Database seems empty. Running data ingestion..."
    cd src/db
    bun run ingest.ts
    cd ../..
fi

echo "📊 Database size: $(du -h src/hyperscript.db | cut -f1)"

# Run tests before deployment
echo "🧪 Running tests..."
if ! bun test; then
    echo "❌ Tests failed. Aborting deployment."
    exit 1
fi

echo "✅ All tests passed"

# Deploy to Fly.io
echo "🚀 Deploying to Fly.io..."
flyctl deploy

# Check deployment status
echo "📋 Checking deployment status..."
flyctl status

# Show logs
echo "📝 Recent logs:"
flyctl logs --app "$APP_NAME" -n 50

echo "✅ Deployment complete!"
echo "🌐 Your LSP server is available at: https://$APP_NAME.fly.dev"
echo "🏥 Health check: https://$APP_NAME.fly.dev/health"

# Test the health endpoint
echo "🔍 Testing health endpoint..."
if curl -f "https://$APP_NAME.fly.dev/health" > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed - check logs with: flyctl logs"
fi

echo ""
echo "📚 Next steps:"
echo "  - Monitor with: flyctl logs"
echo "  - Scale with: flyctl scale count 2"
echo "  - Update with: flyctl deploy"
echo "  - Configure your editor to use: https://$APP_NAME.fly.dev"