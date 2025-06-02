# hyperscript-lsp

A Language Server Protocol implementation for [hyperscript](https://hyperscript.org), providing intelligent code assistance for this human-readable scripting language.

## Features

- ✨ **Autocompletion** for commands, features, and expressions
- 📚 **Hover documentation** with examples
- ✅ **Validation** and syntax checking
- 🔍 **Quick access** to cookbook examples
- 🚀 **MCP server** for AI integration

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/hyperscript-lsp.git
cd hyperscript-lsp

# Install dependencies
bun install

# Set up the database
bun run scripts/database/db-init.ts

# Run the LSP server
bun run src/server/main.ts
```

## Documentation

- [Development Workflow](docs/dev/development-workflow.md) - Detailed setup and data collection pipeline
- [Architecture](docs/architecture/) - System design and implementation details
- [Setup Guides](docs/setup/) - VS Code extension and deployment
- [Roadmap](docs/dev/roadmap.md) - Project phases and future plans

## Project Structure

```plaintext
hyperscript-lsp/
├── src/               # Core source code
│   ├── server/        # LSP server implementation
│   ├── db/            # Database utilities
│   └── schemas.ts     # Language element schemas
├── mcp-server/        # MCP server for AI integration
├── vscode-extension/  # VS Code extension
├── docs/              # Project documentation
└── tests/             # Test suites
```

## Development

For detailed development instructions, see [Development Workflow](docs/dev/development-workflow.md).

### Quick Commands

```bash
# Run tests
bun test

# Validate data
bun run scripts/validation/unified-validation.ts

# Run MCP server
cd mcp-server && bun run src/index.ts
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
