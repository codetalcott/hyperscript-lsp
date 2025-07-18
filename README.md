# hyperscript-lsp

⚠️ **Experimental Alpha Stage** - This project is in early development and APIs may change.

A Language Server Protocol implementation for [hyperscript](https://hyperscript.org), providing intelligent code assistance for this human-readable scripting language.

## Features

- ✨ **Autocompletion** for commands, features, and expressions
- 📚 **Hover documentation** with examples
- ✅ **Validation** and syntax checking
- 🔍 **Quick access** to cookbook examples
- 🚀 **MCP server** for AI integration
- 🤖 **Agent API** optimized for LLM integration with sub-millisecond performance
- 📊 **Confidence scoring** for uncertainty handling in AI workflows
- ⚡ **Batch processing** with intelligent caching

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

## Agent API for LLMs

The Hyperscript LSP includes a specialized Agent API designed for LLM integration with exceptional performance:

```typescript
import { HyperscriptAgentAPI } from "./src/server/agent-api";
import { createDatabaseService } from "./src/server/database-service";

// Initialize agent API
const dbService = createDatabaseService({ path: "./hyperscript.db" });
const agentAPI = new HyperscriptAgentAPI(dbService, "./hyperscript.db");

// Fast validation (sub-millisecond for cached patterns)
const result = await agentAPI.validateSyntax({
  code: "on click put 'hello' into me",
  performance_target: "fast"
});

// Confidence analysis for uncertainty handling
const confidence = await agentAPI.getValidationConfidence({
  code: "on customEvent performAction",
  uncertainty_areas: ["customEvent", "performAction"]
});

// Batch processing for large codebases
const batchResult = await agentAPI.validateBatch({
  constructs: codeSnippets.map(code => ({ code })),
  optimization: "parallel"
});
```

### Key Features:
- ⚡ **Sub-millisecond response times** for common patterns
- 🎯 **Confidence scoring** (0-1) for validation certainty
- 📦 **Batch processing** with parallel optimization
- 🏆 **Intelligent caching** with LRU eviction
- 📊 **Performance monitoring** and automatic optimization
- 🔧 **Structured error reporting** with fix suggestions

See the [Agent API Guide](docs/agent-api-guide.md) for complete documentation and examples.

## Documentation

- [Development Workflow](docs/dev/development-workflow.md) - Detailed setup and data collection pipeline
- [Agent API Guide](docs/agent-api-guide.md) - **NEW!** Complete guide for LLM integration
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
