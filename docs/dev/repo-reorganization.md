# Repository Reorganization Proposal

## Executive Summary

This proposal outlines a comprehensive reorganization of the hyperscript-lsp repository to improve maintainability, clarity, and developer experience. The current structure has grown organically and now exhibits issues with mixed concerns, scattered documentation, and unclear boundaries between sub-projects.

## Current Issues

### 1. Mixed Concerns
- Tests co-located with source files (`*.test.ts` scattered throughout)
- Scripts mixed with application code in `/src/scripts/`
- Generated files mixed with source files

### 2. Documentation Chaos
- 9+ documentation files cluttering the root directory
- No clear hierarchy or categorization
- Mix of setup guides, implementation notes, and summaries

### 3. Multi-Project Confusion
- Three sub-projects (LSP server, MCP server, VSCode extension) with inconsistent organization
- Duplicate configurations and deployment files
- No clear workspace management

### 4. Data Management
- Database files in source directory (`src/hyperscript.db`)
- External documentation (`/www/`) included in main repo
- Generated reports mixed with configuration data

## Proposed New Structure

```
hyperscript-lsp/
├── .github/                    # GitHub-specific files
│   ├── workflows/             # CI/CD workflows
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   └── pull_request_template.md
│
├── docs/                      # Consolidated documentation
│   ├── setup/                # Setup and installation guides
│   │   ├── vscode-setup.md
│   │   ├── deployment.md
│   │   └── development.md
│   ├── architecture/         # Technical documentation
│   │   ├── lsp-implementation.md
│   │   ├── mcp-integration.md
│   │   └── data-pipeline.md
│   ├── guides/              # User guides
│   │   ├── demo-script.md
│   │   └── troubleshooting.md
│   └── dev/                 # Development notes
│       ├── artifact-cleanup.md
│       ├── test-summary.md
│       └── roadmap.md
│
├── packages/                  # Monorepo structure
│   ├── lsp-server/           # Main LSP server
│   │   ├── src/
│   │   │   ├── handlers/    # LSP protocol handlers
│   │   │   ├── services/    # Business logic services
│   │   │   ├── database/    # Database connection layer
│   │   │   ├── types/       # TypeScript types
│   │   │   └── index.ts     # Main entry point
│   │   ├── tests/           # Separated test files
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   ├── dist/            # Build output (gitignored)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp-server/          # MCP server package
│   │   ├── src/
│   │   ├── tests/
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── vscode-extension/    # VSCode extension
│   │   ├── src/
│   │   ├── tests/
│   │   ├── out/            # Build output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/              # Shared code between packages
│       ├── src/
│       │   ├── schemas/     # Language schemas
│       │   ├── types/       # Shared types
│       │   └── utils/       # Shared utilities
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/                  # Development and build scripts
│   ├── data-collection/     # Data extraction scripts
│   │   ├── scrape-docs.ts
│   │   ├── parse-examples.ts
│   │   └── validate-data.ts
│   ├── database/            # Database management
│   │   ├── init-db.ts
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── deployment/          # Deployment scripts
│   │   ├── deploy-lsp.sh
│   │   ├── deploy-mcp.sh
│   │   └── docker-build.sh
│   └── validation/          # Validation and cleanup tools
│       ├── detect-artifacts.ts
│       ├── cleanup-db.ts
│       └── verify-integrity.ts
│
├── data/                    # Runtime data (gitignored)
│   ├── database/           # Database files
│   │   ├── hyperscript.db
│   │   └── backups/
│   ├── extracted/          # Extracted documentation data
│   │   └── json/
│   └── reports/            # Generated reports
│       ├── validation/
│       └── artifacts/
│
├── config/                  # Configuration files
│   ├── docker/             # Docker configurations
│   │   ├── lsp.Dockerfile
│   │   └── mcp.Dockerfile
│   ├── deployment/         # Deployment configs
│   │   ├── fly-lsp.toml
│   │   └── fly-mcp.toml
│   └── development/        # Dev environment configs
│
├── tests/                   # Root-level test organization
│   ├── e2e/                # End-to-end tests
│   ├── performance/        # Performance tests
│   └── helpers/            # Test utilities
│
├── .vscode/                # VSCode workspace settings
│   ├── settings.json
│   ├── launch.json
│   └── extensions.json
│
├── package.json            # Root package.json for workspaces
├── pnpm-workspace.yaml     # Workspace configuration
├── turbo.json             # Turborepo configuration
├── tsconfig.json          # Root TypeScript config
├── .gitignore
├── .gitmodules            # For external dependencies
├── README.md              # Main project README
├── LICENSE
└── CONTRIBUTING.md        # Contribution guidelines
```

## Implementation Plan

### Phase 1: Documentation Consolidation (Low Risk)
1. Create `/docs/` directory structure
2. Move and organize all documentation files
3. Update references in code and README
4. Add proper navigation/index to docs

### Phase 2: Test Separation (Medium Risk)
1. Create `tests/` directories in each package
2. Move all `*.test.ts` files to appropriate test directories
3. Update test scripts and configurations
4. Ensure all tests still pass

### Phase 3: Script Reorganization (Low Risk)
1. Create `/scripts/` directory at root
2. Move data collection scripts from `/src/scripts/`
3. Organize by purpose (data-collection, database, deployment, validation)
4. Update package.json scripts

### Phase 4: Data Directory Setup (Low Risk)
1. Create `/data/` directory structure
2. Move database files from `/src/`
3. Move generated JSON data
4. Update all database path references
5. Update .gitignore patterns

### Phase 5: Monorepo Structure (High Risk)
1. Set up pnpm workspaces or similar
2. Create `/packages/` directory
3. Separate LSP server into its own package
4. Extract shared code into shared package
5. Update import paths and dependencies

### Phase 6: External Dependencies (Medium Risk)
1. Remove `/www/` from main repository
2. Set up as git submodule or separate dependency
3. Update data extraction scripts to reference new location

### Phase 7: Configuration Consolidation (Low Risk)
1. Create `/config/` directory
2. Consolidate Docker and deployment configurations
3. Remove duplicate files
4. Update CI/CD references

## Benefits

### 1. Improved Developer Experience
- Clear separation of concerns
- Easy to navigate structure
- Standard conventions followed
- Better IDE support with workspaces

### 2. Better Build Process
- Clean separation of source and tests
- Easier to create production builds
- No test files in production bundles
- Clear build output locations

### 3. Scalability
- Monorepo structure supports growth
- Easy to add new packages
- Shared code properly managed
- Independent deployment of services

### 4. Maintainability
- Organized documentation
- Clear data management
- Standardized testing approach
- Consistent configuration

### 5. Collaboration
- Clearer project structure for new contributors
- Standard patterns that developers expect
- Better separation allows parallel development
- Reduced merge conflicts

## Migration Strategy

### 1. Gradual Migration
- Implement one phase at a time
- Ensure all tests pass after each phase
- Update documentation as we go
- Keep the old structure working during transition

### 2. Automation Support
Create migration scripts to:
- Move files while preserving git history
- Update import paths automatically
- Verify no broken references
- Generate migration report

### 3. Rollback Plan
- Tag repository before each phase
- Document all changes made
- Keep migration scripts reversible
- Test rollback procedure

## Considerations

### 1. Git History
- Use `git mv` to preserve file history
- Consider creating a migration branch
- Document mapping of old to new paths

### 2. CI/CD Updates
- Update all workflow files
- Modify build scripts
- Update deployment configurations
- Test all pipelines thoroughly

### 3. Developer Communication
- Announce changes in advance
- Provide migration guide
- Update all documentation
- Support team during transition

### 4. Breaking Changes
- Update all import paths
- Modify package.json scripts
- Change configuration references
- Update deployment procedures

## Alternative Approaches

### 1. Minimal Reorganization
Just address the most critical issues:
- Move tests to separate directories
- Consolidate documentation
- Create data directory
- Leave monorepo conversion for later

### 2. Fresh Start
- Create new repository with ideal structure
- Migrate code piece by piece
- Maintains clean history
- More disruptive to development

### 3. Gradual Evolution
- Fix issues as they arise
- No major reorganization
- Lower risk but problems persist
- Technical debt continues to grow

## Recommendation

Proceed with the full reorganization plan, implementing it in phases over 2-4 weeks. Start with low-risk changes (documentation, scripts, data) before tackling the monorepo structure. This approach balances the need for improvement with development continuity.

The investment in proper organization will pay dividends in:
- Faster onboarding of new developers
- Easier maintenance and debugging
- Cleaner deployments
- Better testing practices
- Improved collaboration

## Next Steps

1. Review and approve this proposal
2. Create detailed migration scripts
3. Set up new directory structure in a branch
4. Begin Phase 1 implementation
5. Monitor and adjust based on team feedback