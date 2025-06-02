# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscript-LSP is a Language Server Protocol implementation for [hyperscript](https://hyperscript.org), providing intelligent code assistance through autocompletion, hover documentation, validation, and more.

## Key Context for AI Assistance

### Current Project State
- The LSP server is functional with basic features implemented
- Data collection pipeline is complete with all language elements extracted
- MCP server provides AI integration capabilities
- VS Code extension is in development

### Important File Locations
- Language schemas: `src/schemas.ts`
- LSP handlers: `src/server/lsp-handlers.ts`
- Database queries: `src/db/query.ts`
- MCP tools: `mcp-server/src/tools/`

### When Working on This Project
1. **Always check existing patterns** before implementing new features
2. **Use the database** for language element data - don't hardcode
3. **Follow TypeScript conventions** with proper typing
4. **Run tests** after making changes: `bun test`
5. **Validate data** when modifying extraction scripts

For detailed development workflow, see [docs/dev/development-workflow.md](docs/dev/development-workflow.md).

## Technical Details

### Language Elements
The project uses a data-driven approach with five primary hyperscript language elements stored in SQLite:
- **Commands**: Actions (e.g., `put`, `fetch`, `toggle`)
- **Expressions**: Values/formulas (e.g., arithmetic, object references)
- **Features**: Top-level constructs (e.g., `on`, `init`, `behavior`)
- **Keywords**: Reserved words (e.g., `in`, `to`, `with`)
- **Special Symbols**: Context references (e.g., `me`, `it`, `you`)

### Common Tasks

#### Adding New Language Features
1. Update the schema in `src/schemas.ts`
2. Modify extraction scripts in `scripts/data-collection/`
3. Run validation: `bun run scripts/validation/unified-validation.ts`
4. Update database: `bun run scripts/database/ingest.ts`

#### Implementing LSP Features
1. Check `src/server/lsp-handlers.ts` for existing patterns
2. Use database queries from `src/db/query.ts`
3. Add tests in `tests/unit/server/`
4. Update MCP tools if needed in `mcp-server/src/tools/`

### Testing Strategy
- Unit tests for individual components
- Integration tests for LSP functionality
- Fixture-based tests using real hyperscript code
- Always run `bun test` before committing

### Known Limitations
- Partial parsing implementation (focuses on completion/hover)
- Limited diagnostic capabilities
- WebSocket transport is experimental

## Important Notes
- The `www/` folder contains cloned hyperscript documentation - do not modify
- Database is generated from JSON files in `data/extracted/json/`
- All language data must come from the database, not hardcoded values