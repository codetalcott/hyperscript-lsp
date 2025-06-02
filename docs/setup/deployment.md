# Hyperscript LSP Deployment Guide

This guide covers how to deploy the Hyperscript LSP server to Fly.io.

## Prerequisites

1. **Fly.io Account**: Sign up at [fly.io](https://fly.io)
2. **Flyctl CLI**: Install the Fly.io CLI tool
   ```bash
   brew install flyctl
   # or visit: https://fly.io/docs/getting-started/installing-flyctl/
   ```
3. **Docker**: For local testing (optional)
4. **Bun**: For running tests and scripts

## Quick Deploy

The fastest way to deploy:

```bash
# Run all tests and deploy
bun run deploy:check
```

Or just deploy (skipping tests):

```bash
bun run deploy
```

## Step-by-Step Deployment

### 1. Login to Fly.io

```bash
flyctl auth login
```

### 2. Prepare the Database

Ensure the database is created and populated with language data:

```bash
# Initialize database (if needed)
bun run db:init

# Populate with language data (if needed)  
bun run db:ingest

# Validate data
bun run validate
```

### 3. Test Locally (Optional)

Test the Docker build locally:

```bash
bun run docker:test
```

### 4. Deploy to Fly.io

```bash
bun run deploy
```

This script will:
- Check if you're logged in to Fly.io
- Create the app if it doesn't exist
- Verify database is ready
- Run tests
- Deploy to Fly.io
- Check deployment status

## Configuration Files

- **`Dockerfile`**: Container configuration for Bun runtime
- **`fly.toml`**: Fly.io app configuration
- **`scripts/deploy.sh`**: Automated deployment script
- **`scripts/test-docker.sh`**: Docker build testing

## Environment Variables

The app uses these environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (production/development)

## Health Checks

The server provides a health check endpoint at `/health` that returns:

```json
{
  "status": "ok",
  "server": "hyperscript-lsp"
}
```

Fly.io automatically monitors this endpoint and restarts the service if needed.

## Monitoring

After deployment, monitor your app:

```bash
# View logs
flyctl logs

# Check status
flyctl status

# Scale if needed
flyctl scale count 2
```

## Using the Deployed LSP

Once deployed, your LSP server will be available at:
```
https://hyperscript-lsp.fly.dev
```

Configure your editor to use this URL as the LSP server endpoint.

## Troubleshooting

### Database Issues

If the database is missing or empty:

```bash
# Check database size
ls -la src/hyperscript.db

# Recreate if needed
rm src/hyperscript.db
bun run db:init
bun run db:ingest
```

### Deployment Failures

Check logs for errors:

```bash
flyctl logs --app hyperscript-lsp
```

Common issues:
- **Out of memory**: Increase memory in `fly.toml`
- **Database missing**: Ensure `src/hyperscript.db` exists
- **Build errors**: Check Dockerfile and dependencies

### Local Testing

Test the server locally before deploying:

```bash
# Start server locally
bun run server

# Test health endpoint
curl http://localhost:3000/health

# Test LSP functionality
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

## Cost Optimization

- **Free tier**: Fly.io offers generous free tier for small apps
- **Auto-stop**: App stops when not in use (configured in `fly.toml`)
- **Memory**: App uses 512MB memory (adjust in `fly.toml` if needed)

## Updates

To update the deployed app:

```bash
# Deploy latest code
bun run deploy

# Or with tests
bun run deploy:check
```

## Support

For issues:
1. Check the logs: `flyctl logs`
2. Verify health check: `https://hyperscript-lsp.fly.dev/health`
3. Test locally first with `bun run server`