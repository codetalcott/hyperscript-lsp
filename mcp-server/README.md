# Hyperscript LSP MCP Server

A Model Context Protocol (MCP) server that provides Hyperscript language support for AI assistants like Claude.

## Features

- **Code Analysis**: Check hyperscript code for syntax errors
- **Completions**: Get context-aware code completion suggestions
- **Documentation**: Access comprehensive hyperscript documentation
- **Search**: Search the language database for elements
- **Code Generation**: Generate common hyperscript patterns

## Installation

```bash
cd mcp-server
bun install
```

## Usage

### With Claude Desktop

1. Build the server:
```bash
bun run build
```

2. Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "command": "node",
      "args": ["/absolute/path/to/hyperscript-lsp/mcp-server/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

### Development Mode

Run the server in development mode:
```bash
bun run dev
```

## Available Tools

### analyze_hyperscript
Analyzes hyperscript code for syntax errors.

```
Input: {
  "code": "on click\n  toggle .active"
}
```

### get_completion
Gets completion suggestions at a specific position.

```
Input: {
  "code": "pu",
  "line": 0,
  "character": 2
}
```

### get_hover_info
Gets documentation for a hyperscript element.

```
Input: {
  "element": "toggle"
}
```

### search_language_elements
Searches the hyperscript language database.

```
Input: {
  "query": "event",
  "type": "feature"  // optional: command, keyword, expression, feature, symbol, all
}
```

### generate_hyperscript
Generates hyperscript code patterns.

```
Input: {
  "pattern": "form-validation",
  "options": {
    "fields": ["email", "name", "message"]
  }
}
```

Available patterns:
- `event-handler`: Basic event handling
- `fetch-request`: AJAX requests
- `animation`: CSS animations
- `form-validation`: Form validation
- `todo-item`: Todo list functionality
- `modal`: Modal dialogs
- `drag-drop`: Drag and drop
- `infinite-scroll`: Infinite scrolling

## Examples

### Check syntax
"Can you check this hyperscript code for errors?"
```hyperscript
on click
  if condition
    toggle .active
-- missing end
```

### Get documentation
"What does the 'toggle' command do in hyperscript?"

### Generate code
"Generate a form validation handler for email and password fields"

### Search for elements
"Search for all hyperscript commands related to 'fetch'"

## License

MIT