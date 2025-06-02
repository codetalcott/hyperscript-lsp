# Installing Hyperscript MCP Server for Claude Desktop

## Prerequisites

- [Bun](https://bun.sh) installed on your system
- Claude Desktop app

## Installation Steps

### 1. Build the Server

```bash
cd /Users/williamtalcott/projects/hyperscript-lsp/mcp-server
bun install
bun run build
```

### 2. Configure Claude Desktop

1. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the hyperscript-lsp server configuration:

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "command": "node",
      "args": ["/Users/williamtalcott/projects/hyperscript-lsp/mcp-server/dist/index.js"]
    }
  }
}
```

**Note**: Replace `/Users/williamtalcott/projects/hyperscript-lsp` with your actual path.

### 3. Restart Claude Desktop

Quit and restart Claude Desktop for the changes to take effect.

## Verification

Once installed, you can verify the integration is working by asking Claude:

- "Can you analyze this hyperscript code for errors?"
- "What does the toggle command do in hyperscript?"
- "Generate a form validation handler in hyperscript"

## Troubleshooting

If the integration isn't working:

1. Check the logs in Claude Desktop
2. Ensure the path in the config is absolute and correct
3. Try running the server manually to check for errors:
   ```bash
   node /path/to/mcp-server/dist/index.js
   ```

## Alternative: Development Mode

For development, you can use Bun directly:

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "command": "bun",
      "args": ["run", "/Users/williamtalcott/projects/hyperscript-lsp/mcp-server/src/index.ts"]
    }
  }
}
```