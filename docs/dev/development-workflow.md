# Development Workflow

This document describes the development workflow for the Hyperscript LSP project.

## Data Collection Pipeline

The project follows a data-driven approach, where language elements are first extracted from the hyperscript documentation:

1. Clone the hyperscript documentation repository (www folder)
2. Run extraction scripts to collect language elements from markdown documentation
3. Validate the extracted data using validation scripts
4. Import the data into SQLite database
5. Use the database to power the LSP features

### Prerequisites

- Clone the hyperscript documentation:
  ```bash
  git clone https://github.com/bigskysoftware/_hyperscript.git www
  ```

### Running the Data Collection Pipeline

```bash
# Run the scraping script to extract hyperscript documentation
cd src/scripts
bun run scrape-cheerio.ts

# Validate the data
bun run validation/unified-validation.ts
bun run validation/completeness-check.ts

# Import data into SQLite database
cd ../db
bun run ingest.ts

# Query examples
cd ../scripts
bun run db-query.ts
bun run lsp-query-example.ts
```

### Cookbook Example Extraction

The project includes a comprehensive pipeline for extracting and analyzing cookbook examples:

```bash
# Run the complete cookbook extraction pipeline
cd src/scripts
bun run run-cookbook-extraction.ts
```

This script will:
1. Extract cookbook examples from the hyperscript documentation
2. Validate the extracted examples
3. Enrich examples with detected grammar elements
4. Import everything into the database

## Data Schema

The project defines five primary hyperscript language elements:

1. **Commands**: Actions that perform operations (e.g., `put`, `fetch`, `toggle`)
2. **Expressions**: Values or formulas (e.g., arithmetic expressions, object references)
3. **Features**: Top-level language constructs (e.g., `on`, `init`, `behavior`)
4. **Keywords**: Reserved words with special meaning (e.g., `in`, `to`, `with`)
5. **Special Symbols**: Context-sensitive references (e.g., `me`, `it`, `you`)

Each element type has a defined Zod schema in `src/schemas.ts` and corresponding tables in the SQLite database.

## Development Commands

### Database Management

```bash
# Initialize the database
bun run src/scripts/db-init.ts

# Query the database
bun run src/scripts/db-query.ts
```

### Validation

```bash
# Run all validation tests
bun run src/scripts/validation/unified-validation.ts
bun run src/scripts/validation/completeness-check.ts

# Check for artifacts
bun run scripts/validation/detect-artifacts.ts
bun run scripts/validation/cleanup-artifacts.ts
```

### Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun test tests/unit/server/
bun test tests/unit/db/
bun test tests/unit/mcp/
```

### LSP Server

```bash
# Run the LSP server locally
bun run src/server/main.ts

# Run the WebSocket server
bun run src/server/websocket-main.ts
```

### MCP Server

```bash
# Run the MCP server
cd mcp-server
bun run src/index.ts

# Run the remote MCP server
bun run src/remote-server.ts
```

## Contribution Guidelines

When contributing to this project:

1. **Maintain consistency** with the defined schemas for language elements
2. **Update validation tests** when adding new data extraction features
3. **Run validation scripts** after any data collection to ensure integrity
4. **Use the existing database structure** for storage and retrieval
5. **Follow the roadmap priorities** for implementing new features
6. **Write tests** for new functionality
7. **Run linting and type checking** before committing:
   ```bash
   bun run lint
   bun run typecheck
   ```

## Known Issues and Limitations

- The extraction of code examples from the cookbook is not fully implemented
- Some keywords are missing from the extracted data and need manual identification
- The LSP implementation is in early stages

## Debugging

For debugging the LSP server:

1. Use the VS Code extension development host
2. Enable verbose logging in the server
3. Check the output channel in VS Code for logs

For debugging data collection:

1. Run validation scripts to check data integrity
2. Use the db-query.ts script to inspect database contents
3. Check the generated JSON files in `data/extracted/json/`