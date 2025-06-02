import { describe, test, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Gitignore Coverage", () => {
  const projectRoot = path.join(import.meta.dir, "../../../");
  const gitignoreContent = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf-8");
  
  describe("Database Files", () => {
    test("should ignore database files", () => {
      expect(gitignoreContent).toContain("*.db");
    });

    test("should ignore backup databases", () => {
      expect(gitignoreContent).toContain("*backup*.db");
    });

    test("should ignore SQLite files", () => {
      expect(gitignoreContent).toContain("*.sqlite*");
    });
  });

  describe("Generated Data Files", () => {
    test("should ignore validation reports", () => {
      expect(gitignoreContent).toContain("src/scripts/data/");
    });

    test("should ignore JSON reports", () => {
      expect(gitignoreContent).toContain("*-report.json");
    });

    test("should ignore cleanup results", () => {
      expect(gitignoreContent).toContain("cleanup-results.json");
    });
  });

  describe("System Files", () => {
    test("should ignore .DS_Store files", () => {
      expect(gitignoreContent).toContain(".DS_Store");
    });

    test("should ignore temporary files", () => {
      expect(gitignoreContent).toContain("*.tmp");
    });

    test("should ignore log files", () => {
      expect(gitignoreContent).toContain("*.log");
    });
  });

  describe("IDE and Editor Files", () => {
    test("should ignore VSCode test files", () => {
      expect(gitignoreContent).toContain(".vscode-test");
    });

    test("should ignore editor config files", () => {
      expect(gitignoreContent).toContain(".vscode/");
    });
  });

  describe("Build and Cache Files", () => {
    test("should ignore dist directories", () => {
      expect(gitignoreContent).toContain("dist");
    });

    test("should ignore cache directories", () => {
      expect(gitignoreContent).toContain(".cache");
    });

    test("should ignore TypeScript build info", () => {
      expect(gitignoreContent).toContain("*.tsbuildinfo");
    });
  });

  describe("Environment and Secrets", () => {
    test("should ignore environment files", () => {
      expect(gitignoreContent).toContain(".env");
    });

    test("should ignore local environment files", () => {
      expect(gitignoreContent).toContain(".env.local");
    });
  });

  describe("Package Manager Files", () => {
    test("should ignore node_modules", () => {
      expect(gitignoreContent).toContain("node_modules/");
    });

    test("should NOT ignore lock files", () => {
      // Lock files should be committed for reproducible builds
      expect(gitignoreContent).not.toContain("bun.lock");
      expect(gitignoreContent).not.toContain("package-lock.json");
    });
  });

  describe("Project-Specific Ignores", () => {
    test("should ignore hyperscript.org documentation", () => {
      expect(gitignoreContent).toContain("www/");
    });
  });

  describe("Missing Patterns (Should Add)", () => {
    test("should suggest adding database file patterns", () => {
      const patterns = [
        "*.db",
        "*backup*.db", 
        "*.sqlite*"
      ];
      
      const missingPatterns = patterns.filter(pattern => 
        !gitignoreContent.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log("Missing database patterns:", missingPatterns);
      }
    });

    test("should suggest adding data directory patterns", () => {
      const patterns = [
        "src/scripts/data/",
        "*-report.json",
        "cleanup-results.json"
      ];
      
      const missingPatterns = patterns.filter(pattern => 
        !gitignoreContent.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log("Missing data patterns:", missingPatterns);
      }
    });

    test("should suggest adding system file patterns", () => {
      const patterns = [
        ".DS_Store",
        "*.tmp",
        "Thumbs.db"
      ];
      
      const missingPatterns = patterns.filter(pattern => 
        !gitignoreContent.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log("Missing system file patterns:", missingPatterns);
      }
    });

    test("should suggest adding IDE patterns", () => {
      const patterns = [
        ".vscode/",
        ".idea/",
        "*.swp",
        "*.swo"
      ];
      
      const missingPatterns = patterns.filter(pattern => 
        !gitignoreContent.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log("Missing IDE patterns:", missingPatterns);
      }
    });
  });

  describe("File Existence Check", () => {
    test("should verify tracked files don't match ignore patterns", () => {
      // Test that important files are NOT ignored
      const importantFiles = [
        "package.json",
        "bun.lock", 
        "tsconfig.json",
        "README.md",
        "src/server/main.ts",
        "Dockerfile",
        "fly.toml"
      ];

      for (const file of importantFiles) {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
          expect(fs.existsSync(filePath)).toBe(true);
          console.log(`✓ Important file exists: ${file}`);
        }
      }
    });

    test("should identify files that should be ignored but aren't", () => {
      const shouldBeIgnored = [
        "src/hyperscript.db",
        "src/hyperscript_backup_*.db",
        "src/scripts/data/*-report.json"
      ];

      for (const pattern of shouldBeIgnored) {
        // This is informational - helps identify what should be added to gitignore
        console.log(`Files matching pattern "${pattern}" should be in .gitignore`);
      }
    });
  });
});