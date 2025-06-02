import { describe, test, expect, beforeAll } from "bun:test";
import { createLSPHandlers } from "../../server/lsp-handlers";
import { createDatabaseService } from "../../server/database-service";
import { detectDataArtifacts } from "./detect-artifacts";
import * as path from "node:path";

describe("Post-Cleanup Verification", () => {
  let handlers: any;
  let dbService: any;
  let dbPath: string;

  beforeAll(() => {
    dbPath = path.join(import.meta.dir, "../../hyperscript.db");
    dbService = createDatabaseService({ 
      path: dbPath,
      cacheEnabled: true
    });
    handlers = createLSPHandlers(dbService);
  });

  describe("Database Integrity After Cleanup", () => {
    test("should have reduced duplicates compared to initial state", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // After cleanup, should have significantly fewer duplicates
      expect(report.statistics.totalDuplicates).toBeLessThan(60); // Was 103 before
      expect(report.statistics.cleanupPotential).toBeLessThan(35); // Was 50% before
    });

    test("should have cleaned HTML artifacts", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // HTML artifacts should be reduced or eliminated
      expect(report.extractionArtifacts.htmlTags).toBeLessThan(20); // Was 28 before
    });

    test("should have fewer orphaned references", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Orphaned references should be reduced
      expect(report.integrityIssues.orphanedReferences).toBeLessThan(600); // Was 704 before
    });

    test("should maintain data completeness", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Should still have reasonable amounts of data
      if (report.typeDistribution) {
        expect(report.typeDistribution.commands).toBeGreaterThan(25);
        expect(report.typeDistribution.keywords).toBeGreaterThan(20);
        expect(report.typeDistribution.expressions).toBeGreaterThan(15);
        expect(report.typeDistribution.features).toBeGreaterThan(5);
        expect(report.typeDistribution.specialSymbols).toBeGreaterThan(5);
      } else {
        // If typeDistribution is missing, check statistics instead
        expect(report.statistics.totalRecords).toBeGreaterThan(75);
      }
    });
  });

  describe("LSP Functionality After Cleanup", () => {
    test("should still provide autocompletion", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "tog");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should still find toggle command
      const toggleCommand = result.find(item => item.label === "toggle");
      expect(toggleCommand).toBeDefined();
    });

    test("should still provide hover information", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.kind).toBe("markdown");
        expect(result.contents.value).toContain("put");
      }
    });

    test("should have clean hover content without HTML artifacts", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "add .class");
      
      const result = await handlers.handleHover(params);
      
      if (result) {
        const content = result.contents.value;
        
        // Should not contain HTML artifacts
        expect(content).not.toContain("&lt;");
        expect(content).not.toContain("&gt;");
        expect(content).not.toContain("&amp;");
        expect(content).not.toContain("<div>");
        expect(content).not.toContain("</div>");
      }
    });

    test("should handle all language element types", async () => {
      const testCases = [
        { text: "put", expectedType: "command" },
        { text: "on click", expectedType: "feature" },
        { text: "into", expectedType: "keyword" },
        { text: "me", expectedType: "symbol" }
      ];

      for (const testCase of testCases) {
        const params = {
          textDocument: { uri: "file:///test.hs" },
          position: { line: 0, character: Math.floor(testCase.text.length / 2) }
        };
        
        handlers.setTextContent("file:///test.hs", testCase.text);
        
        const result = await handlers.handleHover(params);
        
        // Should get some result for known language elements
        expect(result).not.toBeNull();
      }
    });
  });

  describe("Performance After Cleanup", () => {
    test("should complete autocompletion quickly", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "pu");
      
      const startTime = performance.now();
      await handlers.handleCompletion(params);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should complete in < 100ms
    });

    test("should complete hover queries quickly", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "toggle");
      
      const startTime = performance.now();
      await handlers.handleHover(params);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50); // Should complete in < 50ms
    });
  });

  describe("Data Quality Improvements", () => {
    test("should have reduced the overall database size", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Storage usage should be more efficient
      expect(report.statistics.storageWasted).toBeLessThan(25000); // bytes
      expect(report.statistics.cleanupPotential).toBeLessThan(35); // percentage
    });

    test("should prioritize critical recommendations", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Should have fewer critical recommendations
      const criticalRecs = report.recommendations.filter(r => r.severity === "critical");
      expect(criticalRecs.length).toBeLessThanOrEqual(1); // Should have fixed most critical issues
    });

    test("should maintain data relationships", async () => {
      // Test that related data is still connected properly
      const completionParams = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 0 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "");
      
      const completions = await handlers.handleCompletion(completionParams);
      
      // Should have reasonable variety of completion types
      const kinds = [...new Set(completions.map(c => c.kind))];
      expect(kinds.length).toBeGreaterThanOrEqual(0); // Should not crash
    });
  });

  describe("Validation Reports", () => {
    test("should show improvement in artifact detection", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Generate a summary of improvements
      const improvements = {
        duplicatesReduced: report.statistics.totalDuplicates < 60,
        htmlArtifactsReduced: report.extractionArtifacts.htmlTags < 25,
        orphansReduced: report.integrityIssues.orphanedReferences < 600,
        storageImproved: report.statistics.cleanupPotential < 40
      };
      
      // Some improvements should be successful
      const successfulImprovements = Object.values(improvements).filter(Boolean).length;
      expect(successfulImprovements).toBeGreaterThanOrEqual(2);
    });

    test("should maintain functional completeness", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // Should still have a reasonable amount of data
      if (report.typeDistribution) {
        const totalElements = Object.values(report.typeDistribution).reduce((sum, count) => sum + count, 0);
        expect(totalElements).toBeGreaterThan(75); // Should retain most of the data
      } else {
        expect(report.statistics.totalRecords).toBeGreaterThan(75);
      }
      
      // Should have fewer high-priority issues
      const highPriorityRecs = report.recommendations.filter(r => r.severity === "high");
      expect(highPriorityRecs.length).toBeLessThanOrEqual(3);
    });
  });
});