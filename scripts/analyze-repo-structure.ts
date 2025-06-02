import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

interface FileStats {
  totalFiles: number;
  byExtension: Record<string, number>;
  byDirectory: Record<string, number>;
}

interface RepoAnalysis {
  timestamp: Date;
  issues: {
    testsWithSource: string[];
    docsInRoot: string[];
    generatedInSource: string[];
    duplicateConfigs: string[];
    mixedConcerns: Record<string, string[]>;
  };
  statistics: {
    totalFiles: number;
    sourceFiles: number;
    testFiles: number;
    docFiles: number;
    configFiles: number;
    dataFiles: number;
  };
  recommendations: string[];
  complexity: {
    nestingDepth: number;
    averagePathLength: number;
    directoriesWithMixedContent: number;
  };
}

function walkDirectory(dir: string, baseDir: string = ""): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    
    // Skip node_modules and .git
    if (item === "node_modules" || item === ".git" || item === "dist" || item === "out") {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkDirectory(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

function analyzeRepository(rootPath: string): RepoAnalysis {
  const files = walkDirectory(rootPath);
  
  const analysis: RepoAnalysis = {
    timestamp: new Date(),
    issues: {
      testsWithSource: [],
      docsInRoot: [],
      generatedInSource: [],
      duplicateConfigs: [],
      mixedConcerns: {}
    },
    statistics: {
      totalFiles: files.length,
      sourceFiles: 0,
      testFiles: 0,
      docFiles: 0,
      configFiles: 0,
      dataFiles: 0
    },
    recommendations: [],
    complexity: {
      nestingDepth: 0,
      averagePathLength: 0,
      directoriesWithMixedContent: 0
    }
  };
  
  // Analyze each file
  let totalPathLength = 0;
  let maxDepth = 0;
  const directoriesWithTests = new Set<string>();
  const directoriesWithSource = new Set<string>();
  
  for (const file of files) {
    const ext = path.extname(file);
    const dir = path.dirname(file);
    const basename = path.basename(file);
    const depth = file.split(path.sep).length;
    
    totalPathLength += file.length;
    maxDepth = Math.max(maxDepth, depth);
    
    // Categorize files
    if (file.includes(".test.") || file.includes(".spec.")) {
      analysis.statistics.testFiles++;
      analysis.issues.testsWithSource.push(file);
      directoriesWithTests.add(dir);
    } else if (ext === ".ts" || ext === ".js") {
      analysis.statistics.sourceFiles++;
      directoriesWithSource.add(dir);
    }
    
    if (ext === ".md") {
      analysis.statistics.docFiles++;
      if (dir === "." && !["README.md", "LICENSE", "CONTRIBUTING.md"].includes(basename)) {
        analysis.issues.docsInRoot.push(file);
      }
    }
    
    if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) {
      analysis.statistics.configFiles++;
      
      // Check for duplicate configs
      if (basename === "package.json" || basename === "tsconfig.json" || 
          basename === "Dockerfile" || basename.endsWith(".toml")) {
        const existing = analysis.issues.duplicateConfigs.find(f => 
          path.basename(f) === basename
        );
        if (existing) {
          analysis.issues.duplicateConfigs.push(file);
        }
        analysis.issues.duplicateConfigs.push(file);
      }
    }
    
    if (ext === ".db" || ext === ".sqlite" || file.includes("backup")) {
      analysis.statistics.dataFiles++;
      if (file.startsWith("src/")) {
        analysis.issues.generatedInSource.push(file);
      }
    }
    
    // Check for mixed concerns
    if (file.startsWith("src/scripts/")) {
      if (!analysis.issues.mixedConcerns["scripts"]) {
        analysis.issues.mixedConcerns["scripts"] = [];
      }
      analysis.issues.mixedConcerns["scripts"].push(file);
    }
  }
  
  // Calculate complexity metrics
  analysis.complexity.nestingDepth = maxDepth;
  analysis.complexity.averagePathLength = totalPathLength / files.length;
  
  // Count directories with mixed content
  for (const dir of directoriesWithTests) {
    if (directoriesWithSource.has(dir)) {
      analysis.complexity.directoriesWithMixedContent++;
    }
  }
  
  // Generate recommendations
  if (analysis.issues.testsWithSource.length > 10) {
    analysis.recommendations.push(
      `Separate ${analysis.issues.testsWithSource.length} test files into dedicated test directories`
    );
  }
  
  if (analysis.issues.docsInRoot.length > 5) {
    analysis.recommendations.push(
      `Move ${analysis.issues.docsInRoot.length} documentation files from root to /docs directory`
    );
  }
  
  if (analysis.issues.generatedInSource.length > 0) {
    analysis.recommendations.push(
      `Move ${analysis.issues.generatedInSource.length} generated/data files out of source directory`
    );
  }
  
  if (analysis.complexity.directoriesWithMixedContent > 5) {
    analysis.recommendations.push(
      `${analysis.complexity.directoriesWithMixedContent} directories have mixed test and source files`
    );
  }
  
  const duplicateTypes = new Set(
    analysis.issues.duplicateConfigs.map(f => path.basename(f))
  );
  if (duplicateTypes.size > 0) {
    analysis.recommendations.push(
      `Consolidate duplicate configuration files: ${Array.from(duplicateTypes).join(", ")}`
    );
  }
  
  if (analysis.complexity.nestingDepth > 6) {
    analysis.recommendations.push(
      `Reduce directory nesting depth (current max: ${analysis.complexity.nestingDepth} levels)`
    );
  }
  
  return analysis;
}

function generateOrganizationScore(analysis: RepoAnalysis): number {
  let score = 100;
  
  // Deduct points for issues
  score -= analysis.issues.testsWithSource.length * 0.5;
  score -= analysis.issues.docsInRoot.length * 2;
  score -= analysis.issues.generatedInSource.length * 3;
  score -= analysis.complexity.directoriesWithMixedContent * 2;
  score -= Math.max(0, (analysis.complexity.nestingDepth - 4) * 5);
  
  // Bonus for good practices
  if (fs.existsSync(path.join(process.cwd(), "docs"))) score += 5;
  if (fs.existsSync(path.join(process.cwd(), "tests"))) score += 5;
  if (fs.existsSync(path.join(process.cwd(), ".github"))) score += 3;
  
  return Math.max(0, Math.min(100, score));
}

// Main execution
async function main() {
  console.log("🔍 Analyzing Repository Structure...\n");
  
  const rootPath = process.cwd();
  const analysis = analyzeRepository(rootPath);
  const score = generateOrganizationScore(analysis);
  
  console.log("===== REPOSITORY STRUCTURE ANALYSIS =====");
  console.log(`Generated: ${analysis.timestamp.toISOString()}`);
  console.log(`Organization Score: ${score.toFixed(1)}/100`);
  
  console.log("\n--- FILE STATISTICS ---");
  console.log(`Total Files: ${analysis.statistics.totalFiles}`);
  console.log(`Source Files: ${analysis.statistics.sourceFiles}`);
  console.log(`Test Files: ${analysis.statistics.testFiles}`);
  console.log(`Documentation: ${analysis.statistics.docFiles}`);
  console.log(`Configuration: ${analysis.statistics.configFiles}`);
  console.log(`Data Files: ${analysis.statistics.dataFiles}`);
  
  console.log("\n--- STRUCTURAL ISSUES ---");
  console.log(`Tests Mixed with Source: ${analysis.issues.testsWithSource.length} files`);
  console.log(`Docs in Root Directory: ${analysis.issues.docsInRoot.length} files`);
  console.log(`Generated Files in /src: ${analysis.issues.generatedInSource.length} files`);
  console.log(`Directories with Mixed Content: ${analysis.complexity.directoriesWithMixedContent}`);
  
  console.log("\n--- COMPLEXITY METRICS ---");
  console.log(`Maximum Nesting Depth: ${analysis.complexity.nestingDepth} levels`);
  console.log(`Average Path Length: ${analysis.complexity.averagePathLength.toFixed(1)} characters`);
  
  if (analysis.issues.docsInRoot.length > 0) {
    console.log("\n--- DOCUMENTATION IN ROOT ---");
    analysis.issues.docsInRoot.forEach(doc => {
      console.log(`  - ${doc}`);
    });
  }
  
  if (analysis.issues.duplicateConfigs.length > 0) {
    console.log("\n--- DUPLICATE CONFIGURATIONS ---");
    const grouped = analysis.issues.duplicateConfigs.reduce((acc, file) => {
      const basename = path.basename(file);
      if (!acc[basename]) acc[basename] = [];
      acc[basename].push(file);
      return acc;
    }, {} as Record<string, string[]>);
    
    Object.entries(grouped).forEach(([name, paths]) => {
      if (paths.length > 1) {
        console.log(`  ${name}:`);
        paths.forEach(p => console.log(`    - ${p}`));
      }
    });
  }
  
  if (analysis.recommendations.length > 0) {
    console.log("\n--- RECOMMENDATIONS ---");
    analysis.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
  
  // Save detailed report
  const reportPath = path.join(rootPath, "repo-structure-analysis.json");
  await fs.promises.writeFile(reportPath, JSON.stringify(analysis, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  // Provide actionable summary
  console.log("\n--- PRIORITY ACTIONS ---");
  if (score < 50) {
    console.log("⚠️  Major reorganization recommended!");
  } else if (score < 75) {
    console.log("⚡ Moderate improvements needed");
  } else {
    console.log("✅ Repository is well organized");
  }
  
  const topIssues = [
    { issue: "Tests mixed with source", count: analysis.issues.testsWithSource.length, threshold: 10 },
    { issue: "Docs cluttering root", count: analysis.issues.docsInRoot.length, threshold: 3 },
    { issue: "Data files in source", count: analysis.issues.generatedInSource.length, threshold: 1 }
  ].filter(i => i.count > i.threshold)
   .sort((a, b) => b.count - a.count);
  
  if (topIssues.length > 0) {
    console.log("\nTop issues to address:");
    topIssues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.issue}: ${issue.count} occurrences`);
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}