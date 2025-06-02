#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

interface TreeNode {
  name: string;
  type: "file" | "dir";
  children?: TreeNode[];
  issues?: string[];
}

function buildTree(dir: string, depth: number = 0, maxDepth: number = 3): TreeNode[] {
  if (depth > maxDepth) return [];
  
  const nodes: TreeNode[] = [];
  const items = fs.readdirSync(dir).sort();
  
  for (const item of items) {
    // Skip certain directories
    if (["node_modules", ".git", "dist", "out", ".cache"].includes(item)) {
      continue;
    }
    
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const children = buildTree(fullPath, depth + 1, maxDepth);
      nodes.push({
        name: item,
        type: "dir",
        children: children.length > 0 ? children : undefined
      });
    } else {
      const issues: string[] = [];
      
      // Identify issues
      if (item.includes(".test.") || item.includes(".spec.")) {
        issues.push("test-mixed");
      }
      if (item.endsWith(".db") || item.includes("backup")) {
        issues.push("data-file");
      }
      if (depth === 0 && item.endsWith(".md") && 
          !["README.md", "LICENSE", "CONTRIBUTING.md"].includes(item)) {
        issues.push("doc-in-root");
      }
      
      nodes.push({
        name: item,
        type: "file",
        issues: issues.length > 0 ? issues : undefined
      });
    }
  }
  
  return nodes;
}

function renderTree(nodes: TreeNode[], prefix: string = "", isLast: boolean = true): string {
  let output = "";
  
  nodes.forEach((node, index) => {
    const isLastNode = index === nodes.length - 1;
    const connector = isLastNode ? "└── " : "├── ";
    const extension = isLastNode ? "    " : "│   ";
    
    let nodeStr = node.name;
    if (node.type === "dir") {
      nodeStr += "/";
    }
    
    // Add issue indicators
    if (node.issues) {
      const indicators = node.issues.map(issue => {
        switch (issue) {
          case "test-mixed": return "⚠️ ";
          case "data-file": return "💾";
          case "doc-in-root": return "📄";
          default: return "";
        }
      }).join("");
      nodeStr += ` ${indicators}`;
    }
    
    output += prefix + connector + nodeStr + "\n";
    
    if (node.children) {
      output += renderTree(node.children, prefix + extension, isLastNode);
    }
  });
  
  return output;
}

function generateIdealStructure(): TreeNode[] {
  return [
    {
      name: ".github",
      type: "dir",
      children: [
        { name: "workflows", type: "dir" },
        { name: "ISSUE_TEMPLATE", type: "dir" }
      ]
    },
    {
      name: "config",
      type: "dir",
      children: [
        { name: "docker", type: "dir", children: [
          { name: "lsp.Dockerfile", type: "file" },
          { name: "mcp.Dockerfile", type: "file" }
        ]},
        { name: "deployment", type: "dir", children: [
          { name: "fly-lsp.toml", type: "file" },
          { name: "fly-mcp.toml", type: "file" }
        ]}
      ]
    },
    {
      name: "data",
      type: "dir",
      children: [
        { name: "database", type: "dir", children: [
          { name: "hyperscript.db", type: "file" },
          { name: "backups", type: "dir" }
        ]},
        { name: "extracted", type: "dir" },
        { name: "reports", type: "dir" }
      ]
    },
    {
      name: "docs",
      type: "dir",
      children: [
        { name: "setup", type: "dir" },
        { name: "architecture", type: "dir" },
        { name: "guides", type: "dir" },
        { name: "dev", type: "dir" }
      ]
    },
    {
      name: "packages",
      type: "dir",
      children: [
        { name: "lsp-server", type: "dir", children: [
          { name: "src", type: "dir" },
          { name: "tests", type: "dir" },
          { name: "package.json", type: "file" }
        ]},
        { name: "mcp-server", type: "dir", children: [
          { name: "src", type: "dir" },
          { name: "tests", type: "dir" },
          { name: "package.json", type: "file" }
        ]},
        { name: "vscode-extension", type: "dir" },
        { name: "shared", type: "dir" }
      ]
    },
    {
      name: "scripts",
      type: "dir",
      children: [
        { name: "data-collection", type: "dir" },
        { name: "database", type: "dir" },
        { name: "deployment", type: "dir" },
        { name: "validation", type: "dir" }
      ]
    },
    {
      name: "tests",
      type: "dir",
      children: [
        { name: "unit", type: "dir" },
        { name: "integration", type: "dir" },
        { name: "e2e", type: "dir" },
        { name: "fixtures", type: "dir" }
      ]
    },
    { name: "README.md", type: "file" },
    { name: "package.json", type: "file" },
    { name: "tsconfig.json", type: "file" }
  ];
}

// Main
async function main() {
  console.log("📊 Repository Structure Visualization\n");
  
  // Current structure
  console.log("=== CURRENT STRUCTURE (with issues) ===");
  console.log("Legend: ⚠️ = test file mixed with source, 💾 = data file, 📄 = doc in root\n");
  
  const currentTree = buildTree(process.cwd(), 0, 2);
  console.log(renderTree(currentTree));
  
  // Ideal structure
  console.log("\n=== PROPOSED IDEAL STRUCTURE ===\n");
  const idealTree = generateIdealStructure();
  console.log(renderTree(idealTree));
  
  // Key improvements
  console.log("\n=== KEY IMPROVEMENTS ===");
  console.log("1. ✅ Tests separated into dedicated /tests directory");
  console.log("2. ✅ Documentation consolidated in /docs with clear categories");
  console.log("3. ✅ Data files moved to /data (gitignored)");
  console.log("4. ✅ Scripts organized by purpose at root level");
  console.log("5. ✅ Configuration files consolidated in /config");
  console.log("6. ✅ Monorepo structure with /packages for sub-projects");
  console.log("7. ✅ Clean root directory with only essential files");
  
  // Migration path
  console.log("\n=== MIGRATION PATH ===");
  console.log("1. Phase 1: Move docs to /docs (Low risk)");
  console.log("2. Phase 2: Separate tests from source (Medium risk)");
  console.log("3. Phase 3: Create /data directory for runtime files (Low risk)");
  console.log("4. Phase 4: Reorganize scripts (Low risk)");
  console.log("5. Phase 5: Consolidate configs (Low risk)");
  console.log("6. Phase 6: Convert to monorepo structure (High risk)");
  
  // Save diagrams
  const output = {
    generated: new Date().toISOString(),
    currentStructure: currentTree,
    idealStructure: idealTree
  };
  
  await fs.promises.writeFile(
    "repo-structure-diagram.json",
    JSON.stringify(output, null, 2)
  );
  
  console.log("\n📄 Structure data saved to: repo-structure-diagram.json");
}

if (require.main === module) {
  main().catch(console.error);
}