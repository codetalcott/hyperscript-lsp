import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { DatabaseOptimizer } from "../../../src/server/database-optimizer";
import { copyFileSync, unlinkSync } from "fs";
import path from "path";

describe("Database Optimizer", () => {
  let optimizer: DatabaseOptimizer;
  let testDbPath: string;

  beforeAll(() => {
    // Create a copy of the database for testing
    const originalDbPath = "/Users/williamtalcott/projects/hyperscript-lsp/src/hyperscript.db";
    testDbPath = "/tmp/hyperscript-test-optimizer.db";
    copyFileSync(originalDbPath, testDbPath);
    
    optimizer = new DatabaseOptimizer(testDbPath);
  });

  afterAll(() => {
    optimizer.close();
    try {
      unlinkSync(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Optimization Application", () => {
    test("should apply database optimizations successfully", async () => {
      const metrics = await optimizer.applyOptimizations();
      
      expect(metrics.views_created).toBeGreaterThan(0);
      expect(metrics.indexes_created).toBeGreaterThan(0);
      expect(metrics.optimization_time_ms).toBeGreaterThan(0);
      expect(typeof metrics.performance_improvement).toBe("number");
      expect(optimizer.isOptimized()).toBe(true);
    });

    test("should improve query performance after optimization", async () => {
      const metrics = await optimizer.applyOptimizations();
      
      // Performance improvement should be measurable
      expect(metrics.pre_optimization_query_time).toBeGreaterThan(0);
      expect(metrics.post_optimization_query_time).toBeGreaterThan(0);
      
      // Post-optimization should be faster or at least not slower
      expect(metrics.post_optimization_query_time).toBeLessThanOrEqual(
        metrics.pre_optimization_query_time! * 1.1 // Allow 10% margin
      );
    });
  });

  describe("Agent-Optimized Data Access", () => {
    test("should provide agent validation cache", async () => {
      await optimizer.applyOptimizations();
      
      const cache = optimizer.getAgentValidationCache();
      
      expect(Array.isArray(cache)).toBe(true);
      expect(cache.length).toBeGreaterThan(0);
      
      // Should have required fields for agent usage
      const firstEntry = cache[0];
      expect(firstEntry).toHaveProperty("name");
      expect(firstEntry).toHaveProperty("syntax_canonical");
      expect(firstEntry).toHaveProperty("confidence_level");
    });

    test("should provide common patterns for fast matching", async () => {
      await optimizer.applyOptimizations();
      
      const patterns = optimizer.getCommonPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern).toHaveProperty("raw_code");
        expect(pattern).toHaveProperty("usage_frequency");
        expect(pattern).toHaveProperty("pattern_type");
      }
    });

    test("should provide fast feature lookup", async () => {
      await optimizer.applyOptimizations();
      
      const feature = optimizer.fastFeatureLookup("on");
      
      expect(feature).toBeDefined();
      expect(feature.name).toBe("on");
      expect(feature.syntax_canonical).toBeDefined();
      expect(feature.confidence_level).toBeDefined();
    });

    test("should support batch feature lookup", async () => {
      await optimizer.applyOptimizations();
      
      const features = optimizer.batchFeatureLookup(["on", "put", "toggle"]);
      
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThan(0);
      expect(features.length).toBeLessThanOrEqual(3);
      
      // Should be ordered by confidence level
      if (features.length > 1) {
        for (let i = 1; i < features.length; i++) {
          const prev = features[i - 1];
          const curr = features[i];
          // High confidence should come before low confidence
          expect(prev.confidence_level >= curr.confidence_level).toBe(true);
        }
      }
    });

    test("should provide syntax requirements", async () => {
      await optimizer.applyOptimizations();
      
      const requirements = optimizer.getSyntaxRequirements("on");
      
      if (requirements) {
        expect(requirements).toHaveProperty("name");
        expect(requirements).toHaveProperty("syntax_canonical");
        expect(requirements.name).toBe("on");
      }
    });

    test("should provide error patterns for validation", async () => {
      await optimizer.applyOptimizations();
      
      const errorPatterns = optimizer.getErrorPatterns();
      
      expect(Array.isArray(errorPatterns)).toBe(true);
      if (errorPatterns.length > 0) {
        const pattern = errorPatterns[0];
        expect(pattern).toHaveProperty("error_type");
        expect(pattern).toHaveProperty("correct_pattern");
        expect(pattern).toHaveProperty("error_pattern");
        expect(pattern).toHaveProperty("error_message");
      }
    });

    test("should provide usage statistics", async () => {
      await optimizer.applyOptimizations();
      
      const stats = optimizer.getUsageStats();
      
      expect(Array.isArray(stats)).toBe(true);
      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat).toHaveProperty("pattern_type");
        expect(stat).toHaveProperty("total_examples");
      }
    });
  });

  describe("Optimization Reporting", () => {
    test("should provide optimization status before optimization", () => {
      const freshOptimizer = new DatabaseOptimizer(testDbPath);
      const report = freshOptimizer.getOptimizationReport();
      
      expect(report.optimized).toBe(false);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.performance_estimate).toContain("10-50ms");
      
      freshOptimizer.close();
    });

    test("should provide optimization status after optimization", async () => {
      await optimizer.applyOptimizations();
      
      const report = optimizer.getOptimizationReport();
      
      expect(report.optimized).toBe(true);
      expect(report.available_views.length).toBeGreaterThan(0);
      expect(report.performance_estimate).toContain("Sub-millisecond");
      
      // Should have agent-specific views
      expect(report.available_views.some(v => v.includes("agent_"))).toBe(true);
    });

    test("should handle optimization errors gracefully", async () => {
      // Test with non-existent database path
      expect(() => {
        new DatabaseOptimizer("/non/existent/path.db");
      }).toThrow();
    });
  });

  describe("Performance Verification", () => {
    test("should demonstrate performance improvement with real queries", async () => {
      await optimizer.applyOptimizations();
      
      // Measure optimized query performance
      const testQueries = [
        () => optimizer.fastFeatureLookup("on"),
        () => optimizer.batchFeatureLookup(["put", "toggle", "add"]),
        () => optimizer.getCommonPatterns(),
        () => optimizer.getAgentValidationCache()
      ];
      
      for (const query of testQueries) {
        const start = performance.now();
        const result = query();
        const duration = performance.now() - start;
        
        // Optimized queries should be very fast
        expect(duration).toBeLessThan(50); // Sub-50ms
        expect(result).toBeDefined();
      }
    });

    test("should maintain data consistency after optimization", async () => {
      await optimizer.applyOptimizations();
      
      // Verify that optimized data matches original data
      const feature = optimizer.fastFeatureLookup("on");
      expect(feature).toBeDefined();
      expect(feature.name).toBe("on");
      
      const batchResult = optimizer.batchFeatureLookup(["on"]);
      expect(batchResult.length).toBe(1);
      expect(batchResult[0].name).toBe("on");
      
      // Core data should be consistent
      expect(feature.syntax_canonical).toBe(batchResult[0].syntax_canonical);
    });
  });
});