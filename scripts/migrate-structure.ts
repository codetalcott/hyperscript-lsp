#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

interface MigrationPlan {
  phase: string;
  description: string;
  risk: "low" | "medium" | "high";
  actions: MigrationAction[];
}

interface MigrationAction {
  type: "move" | "create" | "update" | "delete";
  source?: string;
  destination?: string;
  content?: string;
  description: string;
}

interface MigrationResult {
  phase: string;
  success: boolean;
  actionsCompleted: number;
  actionsFailed: number;
  errors: string[];
  rollbackPath?: string;
}

// Define migration phases
const MIGRATION_PLANS: MigrationPlan[] = [
  {
    phase: "docs-consolidation",
    description: "Consolidate documentation into /docs directory",
    risk: "low",
    actions: [
      { type: "create", destination: "docs", description: "Create docs directory" },
      { type: "create", destination: "docs/setup", description: "Create setup docs directory" },
      { type: "create", destination: "docs/architecture", description: "Create architecture docs directory" },
      { type: "create", destination: "docs/guides", description: "Create guides directory" },
      { type: "create", destination: "docs/dev", description: "Create development docs directory" },
      { type: "move", source: "VSCODE-SETUP.md", destination: "docs/setup/vscode-setup.md", description: "Move VSCode setup guide" },
      { type: "move", source: "DEPLOYMENT.md", destination: "docs/setup/deployment.md", description: "Move deployment guide" },
      { type: "move", source: "LSP-IMPLEMENTATION-SUMMARY.md", destination: "docs/architecture/lsp-implementation.md", description: "Move LSP implementation docs" },
      { type: "move", source: "MCP-INTEGRATION.md", destination: "docs/architecture/mcp-integration.md", description: "Move MCP integration docs" },
      { type: "move", source: "ARTIFACT-CLEANUP-SUMMARY.md", destination: "docs/architecture/artifact-cleanup.md", description: "Move artifact cleanup docs" },
      { type: "move", source: "DEMO-SCRIPT.md", destination: "docs/guides/demo-script.md", description: "Move demo script" },
      { type: "move", source: "TEST-SUMMARY.md", destination: "docs/dev/test-summary.md", description: "Move test summary" },
      { type: "move", source: "GITIGNORE-SUMMARY.md", destination: "docs/dev/gitignore-guide.md", description: "Move gitignore guide" },
      { type: "move", source: "roadmap/index.md", destination: "docs/dev/roadmap.md", description: "Move roadmap" },
      { type: "move", source: "REPO-REORGANIZATION-PROPOSAL.md", destination: "docs/dev/repo-reorganization.md", description: "Move reorg proposal" },
      { type: "delete", source: "roadmap", description: "Remove empty roadmap directory" }
    ]
  },
  {
    phase: "test-separation",
    description: "Separate test files from source code",
    risk: "medium",
    actions: [
      { type: "create", destination: "tests", description: "Create root tests directory" },
      { type: "create", destination: "tests/unit", description: "Create unit tests directory" },
      { type: "create", destination: "tests/integration", description: "Create integration tests directory" },
      { type: "create", destination: "tests/e2e", description: "Create e2e tests directory" },
      { type: "create", destination: "tests/fixtures", description: "Create test fixtures directory" },
      { type: "create", destination: "tests/helpers", description: "Create test helpers directory" },
      { type: "move", source: "src/server/test-fixtures", destination: "tests/fixtures/server", description: "Move server test fixtures" },
      // Server tests
      { type: "move", source: "src/server/*.test.ts", destination: "tests/unit/server/", description: "Move server unit tests" },
      { type: "move", source: "src/server/test-server.ts", destination: "tests/helpers/test-server.ts", description: "Move test server helper" },
      // Database tests
      { type: "move", source: "src/db/*.test.ts", destination: "tests/unit/db/", description: "Move database unit tests" },
      // Script tests
      { type: "move", source: "src/scripts/validation/*.test.ts", destination: "tests/unit/validation/", description: "Move validation tests" },
      { type: "move", source: "src/scripts/test-*.ts", destination: "tests/helpers/", description: "Move test helpers" },
      // MCP server tests
      { type: "move", source: "mcp-server/src/*.test.ts", destination: "tests/unit/mcp/", description: "Move MCP tests" }
    ]
  },
  {
    phase: "data-directory",
    description: "Create data directory for runtime files",
    risk: "low",
    actions: [
      { type: "create", destination: "data", description: "Create data directory" },
      { type: "create", destination: "data/database", description: "Create database directory" },
      { type: "create", destination: "data/database/backups", description: "Create database backups directory" },
      { type: "create", destination: "data/extracted", description: "Create extracted data directory" },
      { type: "create", destination: "data/extracted/json", description: "Create JSON data directory" },
      { type: "create", destination: "data/reports", description: "Create reports directory" },
      { type: "create", destination: "data/reports/validation", description: "Create validation reports directory" },
      { type: "create", destination: "data/reports/artifacts", description: "Create artifact reports directory" },
      { type: "move", source: "src/hyperscript.db", destination: "data/database/hyperscript.db", description: "Move main database" },
      { type: "move", source: "src/hyperscript_backup*.db", destination: "data/database/backups/", description: "Move database backups" },
      { type: "move", source: "src/scripts/data/collected_json", destination: "data/extracted/json", description: "Move extracted JSON data" },
      { type: "move", source: "src/scripts/data/*-report.json", destination: "data/reports/", description: "Move generated reports" }
    ]
  },
  {
    phase: "script-reorganization", 
    description: "Reorganize scripts to root level",
    risk: "low",
    actions: [
      { type: "create", destination: "scripts/data-collection", description: "Create data collection scripts dir" },
      { type: "create", destination: "scripts/database", description: "Create database scripts dir" },
      { type: "create", destination: "scripts/deployment", description: "Create deployment scripts dir" },
      { type: "create", destination: "scripts/validation", description: "Create validation scripts dir" },
      // Data collection scripts
      { type: "move", source: "src/scripts/scrape-cheerio.ts", destination: "scripts/data-collection/scrape-docs.ts", description: "Move doc scraper" },
      { type: "move", source: "src/scripts/extract-*.ts", destination: "scripts/data-collection/", description: "Move extraction scripts" },
      { type: "move", source: "src/scripts/enhanced-cookbook-parser.ts", destination: "scripts/data-collection/", description: "Move cookbook parser" },
      // Database scripts
      { type: "move", source: "src/scripts/db-*.ts", destination: "scripts/database/", description: "Move database scripts" },
      { type: "move", source: "src/db/schema.ts", destination: "scripts/database/schema.ts", description: "Move schema script" },
      { type: "move", source: "src/db/ingest.ts", destination: "scripts/database/ingest.ts", description: "Move ingest script" },
      // Validation scripts
      { type: "move", source: "src/scripts/validation/*.ts", destination: "scripts/validation/", description: "Move validation scripts" },
      // Deployment scripts
      { type: "move", source: "scripts/deploy.sh", destination: "scripts/deployment/deploy-lsp.sh", description: "Move LSP deploy script" },
      { type: "move", source: "scripts/test-docker.sh", destination: "scripts/deployment/test-docker.sh", description: "Move docker test script" }
    ]
  },
  {
    phase: "config-consolidation",
    description: "Consolidate configuration files",
    risk: "low", 
    actions: [
      { type: "create", destination: "config", description: "Create config directory" },
      { type: "create", destination: "config/docker", description: "Create docker config directory" },
      { type: "create", destination: "config/deployment", description: "Create deployment config directory" },
      { type: "create", destination: "config/development", description: "Create development config directory" },
      { type: "move", source: "Dockerfile", destination: "config/docker/lsp.Dockerfile", description: "Move LSP Dockerfile" },
      { type: "move", source: "mcp-server/Dockerfile", destination: "config/docker/mcp.Dockerfile", description: "Move MCP Dockerfile" },
      { type: "move", source: "fly.toml", destination: "config/deployment/fly-lsp.toml", description: "Move LSP Fly config" },
      { type: "move", source: "mcp-server/fly.toml", destination: "config/deployment/fly-mcp.toml", description: "Move MCP Fly config" }
    ]
  }
];

// Utility functions
function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveFile(source: string, destination: string): void {
  // Handle glob patterns
  if (source.includes("*")) {
    const dir = path.dirname(source);
    const pattern = path.basename(source);
    const files = fs.readdirSync(dir).filter(f => {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(f);
    });
    
    for (const file of files) {
      const srcPath = path.join(dir, file);
      const destPath = path.join(destination, file);
      ensureDirectory(path.dirname(destPath));
      execSync(`git mv "${srcPath}" "${destPath}"`, { stdio: "pipe" });
    }
  } else {
    ensureDirectory(path.dirname(destination));
    if (fs.existsSync(source)) {
      execSync(`git mv "${source}" "${destination}"`, { stdio: "pipe" });
    }
  }
}

function updateImports(phase: string): void {
  // This would need to be implemented to update import paths
  console.log(`  ⚠️  Remember to update import paths after ${phase}`);
}

// Execute migration phase
async function executeMigrationPhase(plan: MigrationPlan, dryRun: boolean = false): Promise<MigrationResult> {
  console.log(`\n🔄 Phase: ${plan.phase}`);
  console.log(`   Description: ${plan.description}`);
  console.log(`   Risk Level: ${plan.risk}`);
  console.log(`   Actions: ${plan.actions.length}`);
  
  const result: MigrationResult = {
    phase: plan.phase,
    success: true,
    actionsCompleted: 0,
    actionsFailed: 0,
    errors: []
  };
  
  if (dryRun) {
    console.log("\n   🔍 DRY RUN - No changes will be made");
  }
  
  for (const action of plan.actions) {
    try {
      console.log(`   ${dryRun ? "Would" : "Will"} ${action.type}: ${action.description}`);
      
      if (!dryRun) {
        switch (action.type) {
          case "create":
            ensureDirectory(action.destination!);
            break;
          case "move":
            moveFile(action.source!, action.destination!);
            break;
          case "delete":
            if (fs.existsSync(action.source!)) {
              fs.rmSync(action.source!, { recursive: true });
            }
            break;
        }
      }
      
      result.actionsCompleted++;
    } catch (error) {
      result.actionsFailed++;
      result.errors.push(`Failed ${action.description}: ${error}`);
      console.error(`   ❌ Error: ${error}`);
    }
  }
  
  result.success = result.actionsFailed === 0;
  
  if (!dryRun) {
    updateImports(plan.phase);
  }
  
  return result;
}

// Main CLI
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      phase: { type: "string", short: "p" },
      "dry-run": { type: "boolean", short: "d" },
      all: { type: "boolean", short: "a" },
      list: { type: "boolean", short: "l" }
    }
  });
  
  console.log("🚀 Repository Structure Migration Tool");
  
  if (values.list) {
    console.log("\nAvailable migration phases:");
    MIGRATION_PLANS.forEach((plan, i) => {
      console.log(`${i + 1}. ${plan.phase} (${plan.risk} risk)`);
      console.log(`   ${plan.description}`);
    });
    return;
  }
  
  const isDryRun = values["dry-run"] || false;
  const results: MigrationResult[] = [];
  
  if (values.all) {
    console.log("\n⚠️  Running ALL migration phases!");
    if (!isDryRun) {
      console.log("This will make significant changes. Press Ctrl+C to cancel...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    for (const plan of MIGRATION_PLANS) {
      const result = await executeMigrationPhase(plan, isDryRun);
      results.push(result);
      
      if (!result.success && !isDryRun) {
        console.log("\n❌ Migration failed, stopping...");
        break;
      }
    }
  } else if (values.phase) {
    const plan = MIGRATION_PLANS.find(p => p.phase === values.phase);
    if (!plan) {
      console.error(`❌ Unknown phase: ${values.phase}`);
      console.log("\nUse --list to see available phases");
      process.exit(1);
    }
    
    const result = await executeMigrationPhase(plan, isDryRun);
    results.push(result);
  } else {
    console.log("\nUsage:");
    console.log("  bun run migrate-structure.ts --list              # List phases");
    console.log("  bun run migrate-structure.ts --phase <name>      # Run specific phase");
    console.log("  bun run migrate-structure.ts --all               # Run all phases");
    console.log("  bun run migrate-structure.ts --dry-run           # Preview changes");
    return;
  }
  
  // Summary
  console.log("\n===== MIGRATION SUMMARY =====");
  results.forEach(result => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.phase}: ${result.actionsCompleted}/${result.actionsCompleted + result.actionsFailed} actions`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`   - ${err}`));
    }
  });
  
  if (!isDryRun && results.every(r => r.success)) {
    console.log("\n✅ Migration completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Update import paths in affected files");
    console.log("2. Update package.json scripts");
    console.log("3. Run tests to ensure everything works");
    console.log("4. Update CI/CD configurations");
  }
}

if (require.main === module) {
  main().catch(console.error);
}