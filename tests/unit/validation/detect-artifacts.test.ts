import { describe, test, expect, beforeAll } from "bun:test";
import { detectDataArtifacts, type ArtifactReport } from "./detect-artifacts";
import { createConnection } from "../../db/connection";
import * as path from "node:path";

describe("Artifact Detection", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = path.join(import.meta.dir, "../../hyperscript.db");
  });

  describe("Database Duplication Detection", () => {
    test("should detect duplicate commands", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.duplicates.commands.length).toBeGreaterThan(0);
      
      // Verify duplicate structure
      if (report.duplicates.commands.length > 0) {
        const firstDupe = report.duplicates.commands[0];
        expect(firstDupe).toHaveProperty("name");
        expect(firstDupe).toHaveProperty("count");
        expect(firstDupe.count).toBeGreaterThan(1);
      }
    });

    test("should detect duplicate keywords", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.duplicates.keywords.length).toBeGreaterThan(0);
    });

    test("should detect duplicate expressions", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      // May or may not have duplicates, but should not error
      expect(Array.isArray(report.duplicates.expressions)).toBe(true);
    });
  });

  describe("Data Quality Issues", () => {
    test("should detect empty or malformed fields", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.qualityIssues).toBeDefined();
      expect(report.qualityIssues.emptyDescriptions).toBeGreaterThanOrEqual(0);
      expect(report.qualityIssues.missingSyntax).toBeGreaterThanOrEqual(0);
      expect(report.qualityIssues.malformedJson).toBeGreaterThanOrEqual(0);
    });

    test("should detect HTML artifacts in descriptions", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.extractionArtifacts).toBeDefined();
      expect(report.extractionArtifacts.htmlTags).toBeGreaterThanOrEqual(0);
      expect(report.extractionArtifacts.markdownArtifacts).toBeGreaterThanOrEqual(0);
    });

    test("should detect encoding issues", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.extractionArtifacts.encodingIssues).toBeGreaterThanOrEqual(0);
      expect(report.extractionArtifacts.specialCharacters).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Reference Integrity", () => {
    test("should detect orphaned relationships", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.integrityIssues).toBeDefined();
      expect(report.integrityIssues.orphanedReferences).toBeGreaterThanOrEqual(0);
      expect(report.integrityIssues.missingExamples).toBeGreaterThanOrEqual(0);
    });

    test("should detect duplicate examples", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.integrityIssues.duplicateExamples).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cleanup Recommendations", () => {
    test("should provide actionable cleanup suggestions", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Check recommendation structure
      if (report.recommendations.length > 0) {
        const firstRec = report.recommendations[0];
        expect(firstRec).toHaveProperty("type");
        expect(firstRec).toHaveProperty("description");
        expect(firstRec).toHaveProperty("severity");
        expect(["critical", "high", "medium", "low"]).toContain(firstRec.severity);
      }
    });

    test("should prioritize recommendations by severity", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      const severityOrder = ["critical", "high", "medium", "low"];
      let lastSeverityIndex = -1;
      
      for (const rec of report.recommendations) {
        const currentSeverityIndex = severityOrder.indexOf(rec.severity);
        expect(currentSeverityIndex).toBeGreaterThanOrEqual(lastSeverityIndex);
        lastSeverityIndex = currentSeverityIndex;
      }
    });
  });

  describe("Performance Metrics", () => {
    test("should provide database statistics", async () => {
      const report = await detectDataArtifacts({ databasePath: dbPath });
      
      expect(report.statistics).toBeDefined();
      expect(report.statistics.totalRecords).toBeGreaterThan(0);
      expect(report.statistics.totalDuplicates).toBeGreaterThan(0);
      expect(report.statistics.storageWasted).toBeGreaterThan(0);
    });

    test("should complete within reasonable time", async () => {
      const startTime = performance.now();
      await detectDataArtifacts({ databasePath: dbPath });
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});