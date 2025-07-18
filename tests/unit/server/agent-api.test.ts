import { describe, expect, test, beforeAll, beforeEach } from "bun:test";
import type { DatabaseService } from "../../../src/server/database-service";
import type { 
  ValidationRequest, 
  ValidationResult, 
  SyntaxRequest, 
  SyntaxResponse,
  BatchValidationRequest,
  ConfidenceRequest
} from "../../../src/server/agent-types";

describe("Hyperscript Agent API", () => {
  let agentAPI: any; // Will be typed once we implement HyperscriptAgentAPI
  let mockDbService: DatabaseService;
  
  beforeAll(() => {
    // Create mock database service optimized for agent testing
    mockDbService = {
      isReady: () => true,
      close: () => {},
      getCompletionItems: async () => [],
      getHoverInfo: async (name: string) => {
        const knownElements = {
          "put": {
            name: "put",
            type: "command", 
            description: "Puts content into an element",
            syntax: "put <expression> into <target>",
            examples: []
          },
          "on": {
            name: "on",
            type: "feature",
            description: "Event handlers are used to handle events with hyperscript",
            syntax: "on [every] <event-name>[(<param-list>)] [<count>] [from <expr>] {<command>} [end]",
            examples: []
          },
          "toggle": {
            name: "toggle",
            type: "command",
            description: "Toggles classes or attributes",
            syntax: "toggle <class-or-attribute> [on <target>]",
            examples: []
          }
        };
        
        return knownElements[name as keyof typeof knownElements] || null;
      },
      findDefinition: async () => null
    };
  });

  beforeEach(() => {
    // Reset any caches between tests
    if (agentAPI && agentAPI.clearCache) {
      agentAPI.clearCache();
    }
  });

  describe("Phase 1: Fast Validation API", () => {
    test("should validate basic hyperscript syntax with performance metrics", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ValidationRequest = {
        code: "on click put 'hello' into me",
        validation_level: "syntax",
        performance_target: "fast"
      };
      
      const start = Date.now();
      const result: ValidationResult = await agentAPI.validateSyntax(request);
      const duration = Date.now() - start;
      
      expect(result.valid).toBe(true);
      expect(result.confidence_score).toBeGreaterThan(0.8);
      expect(result.errors).toHaveLength(0);
      expect(result.performance_metrics.validation_time_ms).toBeLessThan(50); // Fast target
      expect(duration).toBeLessThan(100); // End-to-end should be fast
    });

    test("should detect syntax errors with precise error information", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ValidationRequest = {
        code: "unknowncommand 'test'",
        validation_level: "syntax"
      };
      
      const result: ValidationResult = await agentAPI.validateSyntax(request);
      
      expect(result.valid).toBe(false);
      expect(result.confidence_score).toBeGreaterThan(0.7); // High confidence in error detection
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe("unknown-command");
      expect(result.errors[0].message).toContain("Unknown command");
      expect(result.errors[0].range.start.character).toBe(0);
      expect(result.errors[0].fix_suggestions).toBeDefined();
    });

    test("should handle semantic validation separately", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ValidationRequest = {
        code: "set unusedVar to 'value'\\nput 'hello' into me",
        validation_level: "semantic"
      };
      
      const result: ValidationResult = await agentAPI.validateSyntax(request);
      
      expect(result.valid).toBe(true); // Syntactically valid
      expect(result.warnings.length).toBeGreaterThan(0); // But has semantic warnings
      expect(result.warnings[0].code).toBe("unused-variable");
      expect(result.confidence_score).toBeGreaterThan(0.6);
    });

    test("should provide comprehensive validation when requested", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ValidationRequest = {
        code: "on click\\n  put 'hello' into me\\nend",
        validation_level: "both", // Both syntax and semantic
        performance_target: "comprehensive"
      };
      
      const result: ValidationResult = await agentAPI.validateSyntax(request);
      
      expect(result.valid).toBe(true);
      expect(result.confidence_score).toBeGreaterThan(0.9);
      expect(result.performance_metrics.database_queries).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0); // May have style suggestions
    });
  });

  describe("Phase 2: Caching and Performance", () => {
    test("should use cache for repeated validation requests", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ValidationRequest = {
        code: "on click put 'test' into me",
        performance_target: "fast"
      };
      
      // First request - should not be cached
      const result1 = await agentAPI.validateSyntax(request);
      expect(result1.performance_metrics.cache_hit).toBe(false);
      
      // Second identical request - should be cached
      const result2 = await agentAPI.validateSyntax(request);
      expect(result2.performance_metrics.cache_hit).toBe(true);
      expect(result2.performance_metrics.validation_time_ms).toBeLessThan(5); // Cache should be very fast
      
      // Results should be identical
      expect(result1.valid).toBe(result2.valid);
      expect(result1.confidence_score).toBe(result2.confidence_score);
    });

    test("should handle cache performance targets", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      // Prime the cache with common patterns
      const commonPatterns = [
        "on click put 'hello' into me",
        "on load set my.value to 'test'",
        "put 'data' into #element"
      ];
      
      for (const pattern of commonPatterns) {
        await agentAPI.validateSyntax({ code: pattern, performance_target: "fast" });
      }
      
      // All subsequent requests should be very fast
      for (const pattern of commonPatterns) {
        const start = Date.now();
        const result = await agentAPI.validateSyntax({ code: pattern, performance_target: "fast" });
        const duration = Date.now() - start;
        
        expect(result.performance_metrics.cache_hit).toBe(true);
        expect(duration).toBeLessThan(10); // Sub-10ms for cached patterns
      }
    });

    test("should provide cache metrics for monitoring", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      // Perform several validation requests
      await agentAPI.validateSyntax({ code: "on click put 'a' into me" });
      await agentAPI.validateSyntax({ code: "on click put 'a' into me" }); // Duplicate
      await agentAPI.validateSyntax({ code: "on load set x to 'b'" });
      
      const metrics = agentAPI.getCacheMetrics();
      
      expect(metrics.hit_rate).toBeGreaterThan(0);
      expect(metrics.total_entries).toBeGreaterThan(0);
      expect(metrics.memory_usage_mb).toBeGreaterThan(0);
      expect(metrics.average_lookup_time_ms).toBeLessThan(50);
    });
  });

  describe("Phase 3: Structured Syntax Information", () => {
    test("should provide detailed syntax patterns for features", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: SyntaxRequest = {
        feature: "on",
        include_examples: true,
        include_usage_patterns: true
      };
      
      const response: SyntaxResponse = await agentAPI.getSyntaxHelp(request);
      
      expect(response.feature).toBe("on");
      expect(response.syntax_pattern).toBeDefined();
      expect(response.required_parts).toBeDefined();
      expect(response.optional_parts).toBeDefined();
      expect(response.examples.length).toBeGreaterThan(0);
      expect(response.usage_patterns.length).toBeGreaterThan(0);
      expect(response.common_errors.length).toBeGreaterThan(0);
    });

    test("should identify required vs optional syntax parts", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const response = await agentAPI.getSyntaxHelp({ feature: "on" });
      
      // Based on: on [every] <event-name> ... [end]
      expect(response.required_parts).toContain("event-name");
      expect(response.optional_parts).toContain("end");
      expect(response.optional_parts).toContain("every");
    });

    test("should provide usage frequency data", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const response = await agentAPI.getSyntaxHelp({ 
        feature: "on", 
        include_usage_patterns: true 
      });
      
      expect(response.usage_patterns.length).toBeGreaterThan(0);
      
      // Should include frequency data from our database analysis
      const clickPattern = response.usage_patterns.find(p => p.pattern.includes("click"));
      expect(clickPattern).toBeDefined();
      expect(clickPattern!.frequency).toBeGreaterThan(0);
    });
  });

  describe("Phase 4: Batch Operations", () => {
    test("should handle batch validation efficiently", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: BatchValidationRequest = {
        constructs: [
          { code: "on click put 'a' into me" },
          { code: "on load set x to 'b'" },
          { code: "unknowncommand 'error'" }
        ],
        optimization: "parallel"
      };
      
      const start = Date.now();
      const response = await agentAPI.validateBatch(request);
      const duration = Date.now() - start;
      
      expect(response.results).toHaveLength(3);
      expect(response.results[0].valid).toBe(true);
      expect(response.results[1].valid).toBe(true);
      expect(response.results[2].valid).toBe(false);
      
      expect(response.batch_metrics.parallel_processing).toBe(true);
      expect(response.batch_metrics.total_time_ms).toBeLessThan(duration + 10); // Should be efficient
      expect(response.batch_metrics.cache_hit_rate).toBeGreaterThanOrEqual(0);
    });

    test("should optimize batch requests with deduplication", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: BatchValidationRequest = {
        constructs: [
          { code: "on click put 'hello' into me" },
          { code: "on click put 'hello' into me" }, // Duplicate
          { code: "on click put 'hello' into me" }  // Duplicate
        ]
      };
      
      const response = await agentAPI.validateBatch(request);
      
      expect(response.results).toHaveLength(3);
      expect(response.batch_metrics.cache_hit_rate).toBeGreaterThan(0.5); // Should deduplicate
      
      // All results should be identical
      expect(response.results[0].valid).toBe(response.results[1].valid);
      expect(response.results[1].valid).toBe(response.results[2].valid);
    });
  });

  describe("Phase 5: Confidence Scoring for LLM Uncertainty", () => {
    test("should provide confidence scores for validation results", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const highConfidenceRequest: ConfidenceRequest = {
        code: "on click put 'hello' into me" // Very standard pattern
      };
      
      const lowConfidenceRequest: ConfidenceRequest = {
        code: "someRareCommand with unusual-syntax",
        uncertainty_areas: ["someRareCommand", "unusual-syntax"]
      };
      
      const highConfResult = await agentAPI.getValidationConfidence(highConfidenceRequest);
      const lowConfResult = await agentAPI.getValidationConfidence(lowConfidenceRequest);
      
      expect(highConfResult.overall_confidence).toBeGreaterThan(0.8);
      expect(lowConfResult.overall_confidence).toBeLessThan(0.6);
      
      expect(highConfResult.area_confidence.syntax).toBeGreaterThan(0.8);
      expect(lowConfResult.uncertainty_analysis.unclear_constructs.length).toBeGreaterThan(0);
    });

    test("should analyze uncertainty in specific areas", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      const request: ConfidenceRequest = {
        code: "on someCustomEvent\\n  performComplexOperation\\n  with unknownParameter\\nend",
        uncertainty_areas: ["someCustomEvent", "performComplexOperation", "unknownParameter"]
      };
      
      const result = await agentAPI.getValidationConfidence(request);
      
      expect(result.area_confidence.syntax).toBeDefined();
      expect(result.area_confidence.semantics).toBeDefined();
      expect(result.uncertainty_analysis.unclear_constructs.length).toBeGreaterThan(0);
      expect(result.uncertainty_analysis.suggested_verification.length).toBeGreaterThan(0);
    });
  });

  describe("Phase 6: Performance Monitoring and Optimization", () => {
    test("should track performance against targets", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      // Set performance targets
      const targets = {
        max_validation_time_ms: 50,
        target_cache_hit_rate: 0.7,
        max_memory_usage_mb: 100
      };
      
      agentAPI.setPerformanceTargets(targets);
      
      // Perform several validation operations
      for (let i = 0; i < 10; i++) {
        await agentAPI.validateSyntax({ 
          code: `on click put 'test${i}' into me`,
          performance_target: "fast"
        });
      }
      
      const report = agentAPI.getPerformanceReport();
      
      expect(report.current_metrics).toBeDefined();
      expect(report.targets).toEqual(targets);
      expect(report.meets_targets).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test("should provide optimization recommendations", async () => {
      const { HyperscriptAgentAPI } = require("../../../src/server/agent-api");
      agentAPI = new HyperscriptAgentAPI(mockDbService);
      
      // Create a scenario with poor cache performance
      agentAPI.setPerformanceTargets({
        max_validation_time_ms: 10, // Very aggressive target
        target_cache_hit_rate: 0.9,  // High cache target
        max_memory_usage_mb: 50
      });
      
      // Generate unique requests (no cache hits)
      for (let i = 0; i < 5; i++) {
        await agentAPI.validateSyntax({ 
          code: `on uniqueEvent${i} put 'data${i}' into #element${i}` 
        });
      }
      
      const report = agentAPI.getPerformanceReport();
      
      expect(report.meets_targets).toBe(false);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes("cache"))).toBe(true);
    });
  });
});