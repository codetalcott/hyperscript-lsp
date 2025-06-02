import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

interface GitignoreReport {
  timestamp: Date;
  coverage: {
    databaseFiles: boolean;
    reportFiles: boolean;
    systemFiles: boolean;
    ideFiles: boolean;
    cacheFiles: boolean;
  };
  ignoredFiles: string[];
  trackedFilesCount: number;
  untrackedFilesCount: number;
  recommendations: string[];
}

/**
 * Check gitignore coverage and generate report
 */
export function verifyGitignoreCoverage(): GitignoreReport {
  const projectRoot = process.cwd();
  const gitignorePath = path.join(projectRoot, ".gitignore");
  
  if (!fs.existsSync(gitignorePath)) {
    throw new Error(".gitignore file not found");
  }
  
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
  
  // Check coverage
  const coverage = {
    databaseFiles: gitignoreContent.includes("*.db") && gitignoreContent.includes("*.sqlite*"),
    reportFiles: gitignoreContent.includes("*-report.json") && gitignoreContent.includes("cleanup-results.json"),
    systemFiles: gitignoreContent.includes(".DS_Store") && gitignoreContent.includes("*.tmp"),
    ideFiles: gitignoreContent.includes(".vscode/") && gitignoreContent.includes(".idea/"),
    cacheFiles: gitignoreContent.includes(".cache") && gitignoreContent.includes("dist")
  };
  
  // Get list of files that should be ignored
  const ignoredFiles: string[] = [];
  
  try {
    // Find database files
    const dbFiles = execSync("find . -name '*.db' -o -name '*backup*.db' | grep -v node_modules", 
      { encoding: "utf-8", cwd: projectRoot }).trim().split("\n").filter(Boolean);
    ignoredFiles.push(...dbFiles);
    
    // Find report files
    const reportFiles = execSync("find . -name '*-report.json' -o -name 'cleanup-results.json' | grep -v node_modules", 
      { encoding: "utf-8", cwd: projectRoot }).trim().split("\n").filter(Boolean);
    ignoredFiles.push(...reportFiles);
    
    // Find system files
    const systemFiles = execSync("find . -name '.DS_Store' -o -name '*.tmp' | grep -v node_modules", 
      { encoding: "utf-8", cwd: projectRoot }).trim().split("\n").filter(Boolean);
    ignoredFiles.push(...systemFiles);
    
  } catch (error) {
    // Some commands might fail if no files found, that's okay
  }
  
  // Get git status counts
  let trackedFilesCount = 0;
  let untrackedFilesCount = 0;
  
  try {
    const gitStatus = execSync("git status --porcelain", 
      { encoding: "utf-8", cwd: projectRoot }).trim();
    
    if (gitStatus) {
      const lines = gitStatus.split("\n");
      trackedFilesCount = lines.filter(line => line.startsWith(" ") || line.startsWith("M") || line.startsWith("A")).length;
      untrackedFilesCount = lines.filter(line => line.startsWith("??")).length;
    }
  } catch (error) {
    // Not a git repository or git not available
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!coverage.databaseFiles) {
    recommendations.push("Add database file patterns: *.db, *.sqlite*, *backup*.db");
  }
  
  if (!coverage.reportFiles) {
    recommendations.push("Add report file patterns: *-report.json, cleanup-results.json");
  }
  
  if (!coverage.systemFiles) {
    recommendations.push("Add system file patterns: .DS_Store, *.tmp, Thumbs.db");
  }
  
  if (!coverage.ideFiles) {
    recommendations.push("Add IDE file patterns: .vscode/, .idea/, *.swp, *.swo");
  }
  
  if (ignoredFiles.length > 10) {
    recommendations.push("Consider adding src/scripts/data/ directory pattern to ignore all data files");
  }
  
  return {
    timestamp: new Date(),
    coverage,
    ignoredFiles,
    trackedFilesCount,
    untrackedFilesCount,
    recommendations
  };
}

/**
 * CLI interface
 */
async function main() {
  console.log("🔍 Verifying .gitignore coverage...");
  
  try {
    const report = verifyGitignoreCoverage();
    
    console.log("\n===== GITIGNORE COVERAGE REPORT =====");
    console.log(`Generated: ${report.timestamp.toISOString()}`);
    
    console.log("\n--- COVERAGE STATUS ---");
    console.log(`Database files: ${report.coverage.databaseFiles ? "✅" : "❌"}`);
    console.log(`Report files: ${report.coverage.reportFiles ? "✅" : "❌"}`);
    console.log(`System files: ${report.coverage.systemFiles ? "✅" : "❌"}`);
    console.log(`IDE files: ${report.coverage.ideFiles ? "✅" : "❌"}`);
    console.log(`Cache files: ${report.coverage.cacheFiles ? "✅" : "❌"}`);
    
    const coverageScore = Object.values(report.coverage).filter(Boolean).length / Object.values(report.coverage).length * 100;
    console.log(`\nOverall coverage: ${coverageScore.toFixed(1)}%`);
    
    console.log("\n--- FILE STATISTICS ---");
    console.log(`Files being ignored: ${report.ignoredFiles.length}`);
    console.log(`Tracked files (modified): ${report.trackedFilesCount}`);
    console.log(`Untracked files: ${report.untrackedFilesCount}`);
    
    if (report.ignoredFiles.length > 0) {
      console.log("\n--- IGNORED FILES (sample) ---");
      report.ignoredFiles.slice(0, 10).forEach(file => {
        console.log(`  ${file}`);
      });
      if (report.ignoredFiles.length > 10) {
        console.log(`  ... and ${report.ignoredFiles.length - 10} more`);
      }
    }
    
    if (report.recommendations.length > 0) {
      console.log("\n--- RECOMMENDATIONS ---");
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    } else {
      console.log("\n✅ .gitignore coverage is complete!");
    }
    
    // Save report
    const reportPath = path.join(__dirname, "../data/gitignore-report.json");
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error("❌ Error verifying gitignore coverage:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}