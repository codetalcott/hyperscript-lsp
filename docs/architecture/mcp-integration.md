# Hyperscript LSP - MCP Integration

## Overview

The Model Context Protocol (MCP) integration allows Claude and other AI assistants to directly interact with the Hyperscript LSP server, providing real-time code analysis, completion suggestions, and documentation lookups.

## Available Tools

### 1. `analyze_hyperscript`
Analyzes hyperscript code for syntax errors and potential issues.

**Example:**
```
Tool: analyze_hyperscript
Input: {
  "code": "on click\n  toggle .active\n-- missing end"
}
Output: Found 1 issue(s):
- Line 1: Missing 'end' for 'on' event handler (error)
```

### 2. `get_completion`
Provides code completion suggestions at a specific position.

**Example:**
```
Tool: get_completion
Input: {
  "code": "pu",
  "line": 0,
  "character": 2
}
Output: Found 3 completion(s):
- put: Puts content into an element
- publish: Publishes an event
- pick: Picks random elements
```

### 3. `get_hover_info`
Gets detailed documentation for a hyperscript element.

**Example:**
```
Tool: get_hover_info
Input: {
  "element": "toggle"
}
Output: **toggle** (command)

The toggle command allows you to toggle classes, attributes, or properties on elements.

Syntax: `toggle [class-ref | attribute-ref | property-ref] [on <target>]`

Examples:
```hyperscript
toggle .active on me
```
```

### 4. `search_language_elements`
Searches the hyperscript language database for elements.

**Example:**
```
Tool: search_language_elements
Input: {
  "query": "event",
  "type": "feature"
}
Output: Search results for "event":

**Features:**
- on: Event handlers for DOM events
- every: Repeated event handlers
```

### 5. `generate_hyperscript`
Generates common hyperscript code patterns.

**Example:**
```
Tool: generate_hyperscript
Input: {
  "pattern": "form-validation"
}
Output: Generated form-validation pattern:

```hyperscript
on submit
  prevent default
  if #email.value is empty
    add .error to #email
    put "Email is required" into #email-error
  else
    remove .error from #email
    put "" into #email-error
  end
end
```
```

## Installation

### For Claude Desktop

1. Install dependencies:
```bash
cd src/mcp
bun install
```

2. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "hyperscript-lsp": {
      "command": "bun",
      "args": ["run", "/path/to/hyperscript-lsp/src/mcp/hyperscript-mcp-server.ts"],
      "env": {}
    }
  }
}
```

3. Restart Claude Desktop

### For Other MCP Clients

Run the server directly:
```bash
bun run src/mcp/hyperscript-mcp-server.ts
```

## Use Cases

### 1. **Code Review**
Use `analyze_hyperscript` to check code snippets for syntax errors before implementing them.

### 2. **Learning Hyperscript**
Use `get_hover_info` and `search_language_elements` to explore the language and understand how different elements work.

### 3. **Code Generation**
Use `generate_hyperscript` to quickly create boilerplate code for common patterns.

### 4. **Interactive Development**
Combine tools to:
- Generate a pattern
- Analyze it for correctness
- Get completions for modifications
- Look up documentation for unfamiliar elements

## Benefits

1. **Real-time Validation**: Get immediate feedback on hyperscript syntax
2. **Context-Aware Suggestions**: Completions based on cursor position
3. **Rich Documentation**: Access full language documentation inline
4. **Pattern Library**: Generate tested patterns for common use cases
5. **Learning Aid**: Explore the language interactively

## Future Enhancements

- Add more code generation patterns
- Support for hyperscript-to-JavaScript conversion
- Integration with live hyperscript playground
- Code formatting and refactoring tools
- Performance profiling for hyperscript code