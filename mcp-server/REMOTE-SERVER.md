# Hyperscript MCP Remote Server

Deploy the Hyperscript LSP as a remote MCP server accessible over HTTP/HTTPS.

## Local Development

Run the remote server locally:

```bash
# Development mode (with Bun)
bun run dev:remote

# Production mode (with Node)
bun run build
bun run start:remote
```

The server will start on `http://localhost:3000` by default.

## Deployment Options

### Option 1: Deploy to Fly.io (Recommended)

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```bash
fly auth login
```

3. Deploy:
```bash
cd mcp-server
fly launch  # First time only
fly deploy  # Subsequent deployments
```

Your server will be available at `https://hyperscript-mcp.fly.dev`

### Option 2: Deploy to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Deploy:
```bash
railway login
railway init
railway up
```

### Option 3: Deploy to Render

Create a `render.yaml`:

```yaml
services:
  - type: web
    name: hyperscript-mcp
    env: node
    buildCommand: bun install && bun run build
    startCommand: node dist/remote-server.js
    envVars:
      - key: NODE_ENV
        value: production
```

### Option 4: Self-Host with Docker

1. Build the image:
```bash
docker build -t hyperscript-mcp .
```

2. Run the container:
```bash
docker run -p 3000:3000 hyperscript-mcp
```

## Configure Claude Desktop for Remote Server

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "url": "https://hyperscript-mcp.fly.dev"
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "url": "http://localhost:3000"
    }
  }
}
```

## Security Considerations

### Authentication (Optional)

Add API key authentication:

```typescript
// In remote-server.ts
const API_KEY = process.env.API_KEY;

server.setRequestHandler(CallToolRequestSchema, async (request, context) => {
  // Check authorization header
  const auth = context.headers?.authorization;
  if (API_KEY && auth !== `Bearer ${API_KEY}`) {
    throw new Error('Unauthorized');
  }
  
  // ... rest of handler
});
```

Then in Claude config:

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "url": "https://hyperscript-mcp.fly.dev",
      "headers": {
        "Authorization": "Bearer your-secret-key"
      }
    }
  }
}
```

### Rate Limiting

Consider adding rate limiting for production:

```bash
bun add express-rate-limit
```

## Monitoring

### Health Check Endpoint

The server automatically provides a health check at `/health`:

```bash
curl https://hyperscript-mcp.fly.dev/health
```

### Logging

View logs on Fly.io:

```bash
fly logs
```

## Advantages of Remote MCP

1. **No Installation** - Users don't need to install anything locally
2. **Always Updated** - Deploy updates centrally
3. **Cross-Platform** - Works on any OS
4. **Team Sharing** - One server for multiple team members
5. **Scalable** - Can handle multiple concurrent users

## Cost Considerations

- **Fly.io**: Free tier includes 3 shared VMs
- **Railway**: $5/month developer plan
- **Render**: Free tier with limitations
- **Self-hosted**: Your infrastructure costs

## Troubleshooting

1. **Connection Issues**
   - Check if the server is running: `curl <server-url>/health`
   - Verify the URL in Claude config
   - Check for CORS issues in browser console

2. **Performance**
   - The SQLite database is included in the Docker image
   - Consider using PostgreSQL for production scale
   - Enable caching headers for static responses

3. **Debugging**
   - Check server logs
   - Test with curl: 
     ```bash
     curl -X POST <server-url>/call \
       -H "Content-Type: application/json" \
       -d '{"method":"tools/list"}'
     ```