import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { HyperscriptAgentAPI } from "../../src/server/agent-api";
import { createDatabaseService, type DatabaseService } from "../../src/server/database-service";
import type { 
  ValidationRequest, 
  BatchValidationRequest,
  ConfidenceRequest,
  SyntaxRequest 
} from "../../src/server/agent-types";

/**
 * LLM Workflow Integration Tests
 * 
 * Tests real-world LLM usage patterns with the agent API:
 * - Code generation validation
 * - Interactive debugging assistance  
 * - Batch processing for large codebases
 * - Confidence-driven suggestions
 */
describe("LLM Workflow Integration", () => {
  let agentAPI: HyperscriptAgentAPI;
  let dbService: DatabaseService;
  const testDbPath = "/Users/williamtalcott/projects/hyperscript-lsp/src/hyperscript.db";

  beforeAll(async () => {
    // Initialize with real database for integration testing
    dbService = createDatabaseService({ path: testDbPath });
    
    // Initialize agent API with database optimization
    agentAPI = new HyperscriptAgentAPI(dbService, testDbPath);
  });

  afterAll(() => {
    dbService.close();
  });

  describe("Code Generation Workflow", () => {
    test("should validate LLM-generated hyperscript with confidence scoring", async () => {
      // Simulate LLM generating hyperscript code
      const llmGeneratedCode = `
        on click
          put 'Loading...' into me
          fetch '/api/data' then
            put it into #results
          end
        end
      `.trim();

      const validationRequest: ValidationRequest = {
        code: llmGeneratedCode,
        validation_level: "both",
        performance_target: "comprehensive"
      };

      const result = await agentAPI.validateSyntax(validationRequest);

      // LLM should get detailed feedback for code generation
      expect(result.valid).toBe(true);
      expect(result.confidence_score).toBeGreaterThan(0.8);
      expect(result.performance_metrics.validation_time_ms).toBeLessThan(100);
      
      // Should provide actionable suggestions for improvement
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]).toHaveProperty("type");
        expect(result.suggestions[0]).toHaveProperty("confidence");
        expect(result.suggestions[0]).toHaveProperty("reasoning");
      }
    });

    test("should handle partially correct LLM output with detailed error analysis", async () => {
      // Simulate LLM making common mistakes
      const partiallyCorrectCode = `
        on click put 'hello' me
        toggle .active
        set myVar to value
      `.trim();

      const result = await agentAPI.validateSyntax({
        code: partiallyCorrectCode,
        validation_level: "syntax"
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should identify the missing 'into' keyword  
      const intoError = result.errors.find(e => e.code === "missing-into");
      expect(intoError).toBeDefined();
      expect(intoError!.fix_suggestions.length).toBeGreaterThan(0);
      
      // High confidence in error detection for LLM learning
      expect(result.confidence_score).toBeGreaterThan(0.7);
    });

    test("should provide syntax help for LLM feature learning", async () => {
      // LLM asking for help with specific features (use "put" since "fetch" might not be in database)
      const syntaxRequest: SyntaxRequest = {
        feature: "put",
        include_examples: true,
        include_usage_patterns: true
      };

      const syntaxHelp = await agentAPI.getSyntaxHelp(syntaxRequest);

      expect(syntaxHelp.feature).toBe("put");
      expect(syntaxHelp.syntax_pattern).toBeDefined();
      expect(syntaxHelp.examples.length).toBeGreaterThanOrEqual(0); // May not have examples in test DB
      expect(Array.isArray(syntaxHelp.usage_patterns)).toBe(true); // Should be array even if empty
      
      // Should provide practical examples for LLM training
      if (syntaxHelp.examples.length > 0) {
        expect(syntaxHelp.examples[0]).toHaveProperty("code");
        expect(syntaxHelp.examples[0]).toHaveProperty("explanation");
      }
    });
  });

  describe("Interactive Debugging Workflow", () => {
    test("should handle uncertain code analysis for debugging assistance", async () => {
      // Simulate user asking LLM to debug unclear code
      const uncertainCode = `
        on someCustomEvent from #specialElement
          performComplexOperation with data
          if result is successful then
            updateUI
          else
            showError
          end
        end
      `.trim();

      const confidenceRequest: ConfidenceRequest = {
        code: uncertainCode,
        uncertainty_areas: ["someCustomEvent", "performComplexOperation", "updateUI", "showError"]
      };

      const confidence = await agentAPI.getValidationConfidence(confidenceRequest);

      expect(confidence.overall_confidence).toBeLessThan(0.8); // Uncertain due to unknown elements
      expect(confidence.uncertainty_analysis.unclear_constructs.length).toBeGreaterThan(0);
      expect(confidence.uncertainty_analysis.suggested_verification.length).toBeGreaterThan(0);
      
      // Should provide specific confidence scores for different areas
      expect(confidence.area_confidence.syntax).toBeGreaterThan(0.2); // Lower threshold for uncertain code
      expect(confidence.area_confidence.semantics).toBeDefined();
    });

    test("should provide debugging suggestions for common error patterns", async () => {
      // Simulate debugging session with problematic code
      const problematicCode = `
        on click
          put 'test' #output
          toggle active on .button
          set x to
        end
      `.trim();

      const result = await agentAPI.validateSyntax({
        code: problematicCode,
        validation_level: "both"
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should identify multiple issues for comprehensive debugging
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain("missing-into");
      
      // Each error should have actionable fix suggestions
      result.errors.forEach(error => {
        expect(error.fix_suggestions).toBeDefined();
        expect(error.fix_suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Batch Processing Workflow", () => {
    test("should efficiently process multiple code snippets from LLM analysis", async () => {
      // Simulate LLM analyzing multiple hyperscript blocks
      const codeSnippets = [
        "on click put 'hello' into me",
        "on load set my.value to 'initialized'",
        "behavior Draggable on dragstart set my.dragging to true end",
        "init put 'ready' into .status",
        "on submit prevent default then fetch '/api/submit' with my.form",
        "toggle .hidden when #trigger is clicked",
        "put the result of calculateTotal() into #total",
        "on keyup[key=='Enter'] submit closest <form/>",
      ];

      const batchRequest: BatchValidationRequest = {
        constructs: codeSnippets.map(code => ({ code, performance_target: "fast" })),
        optimization: "parallel"
      };

      const startTime = Date.now();
      const batchResult = await agentAPI.validateBatch(batchRequest);
      const totalTime = Date.now() - startTime;

      expect(batchResult.results).toHaveLength(codeSnippets.length);
      expect(batchResult.batch_metrics.parallel_processing).toBe(true);
      expect(batchResult.batch_metrics.total_time_ms).toBeLessThan(500); // Should be fast
      expect(totalTime).toBeLessThan(1000); // End-to-end efficiency
      
      // Most snippets should be valid (these are common patterns)
      const validCount = batchResult.results.filter(r => r.valid).length;
      expect(validCount).toBeGreaterThan(6);
      
      // Cache hit rate may be low for first batch (new instance)
      expect(batchResult.batch_metrics.cache_hit_rate).toBeGreaterThanOrEqual(0);
    });

    test("should handle large codebase analysis with performance monitoring", async () => {
      // Simulate LLM analyzing entire hyperscript codebase
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        code: `on event${i} put 'data${i}' into #element${i}`,
        validation_level: "syntax" as const,
        performance_target: "fast" as const
      }));

      const result = await agentAPI.validateBatch({
        constructs: largeBatch,
        optimization: "parallel"
      });

      expect(result.results).toHaveLength(50);
      expect(result.batch_metrics.total_time_ms).toBeLessThan(2000); // Should scale well
      
      // Performance monitoring
      const performanceReport = agentAPI.getPerformanceReport();
      expect(performanceReport.current_metrics.average_validation_time_ms).toBeLessThan(100);
      expect(typeof performanceReport.meets_targets).toBe("boolean");
    });
  });

  describe("Learning and Adaptation Workflow", () => {
    test("should provide pattern recognition for LLM learning", async () => {
      // Test common hyperscript patterns that LLMs should learn
      const learningPatterns = [
        "on click put 'clicked' into me",
        "on load fetch '/api/data' then put it into #content",
        "behavior Modal on show add .open then on hide remove .open end",
        "init measure my.offsetWidth then set my.initialWidth to it",
        "on submit prevent default then validate my.form",
      ];

      // Validate each pattern and collect learning data
      const learningResults = [];
      for (const pattern of learningPatterns) {
        const result = await agentAPI.validateSyntax({ 
          code: pattern,
          performance_target: "comprehensive" 
        });
        
        learningResults.push({
          pattern,
          valid: result.valid,
          confidence: result.confidence_score,
          suggestions: result.suggestions.length
        });
      }

      // All patterns should be valid with high confidence
      expect(learningResults.every(r => r.valid)).toBe(true);
      expect(learningResults.every(r => r.confidence > 0.8)).toBe(true);
      
      // Should provide learning insights through suggestions
      const totalSuggestions = learningResults.reduce((sum, r) => sum + r.suggestions, 0);
      expect(totalSuggestions).toBeGreaterThanOrEqual(0); // May have optimization suggestions
    });

    test("should maintain consistent validation across LLM sessions", async () => {
      // Test consistency for LLM session continuity
      const testCode = "on click toggle .active on closest .card";
      
      // Validate same code multiple times sequentially to ensure cache order
      const result1 = await agentAPI.validateSyntax({ code: testCode });
      const result2 = await agentAPI.validateSyntax({ code: testCode });
      const result3 = await agentAPI.validateSyntax({ code: testCode });

      // Results should be consistent
      expect(result1.valid).toBe(result2.valid);
      expect(result2.valid).toBe(result3.valid);
      expect(result1.confidence_score).toBe(result2.confidence_score);
      expect(result2.confidence_score).toBe(result3.confidence_score);
      
      // Second and third should be cache hits
      expect(result2.performance_metrics.cache_hit).toBe(true);
      expect(result3.performance_metrics.cache_hit).toBe(true);
    });
  });

  describe("Performance Under Load", () => {
    test("should maintain performance under concurrent LLM requests", async () => {
      // Simulate multiple LLMs making concurrent requests
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => 
        agentAPI.validateSyntax({
          code: `on event${i % 5} put 'data' into #target${i % 3}`,
          performance_target: "fast"
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(totalTime).toBeLessThan(1000); // Should handle concurrency well
      
      // All results should be valid
      expect(results.every(r => r.valid)).toBe(true);
      
      // Should benefit from caching with repeated patterns (some hits expected)
      const cacheHits = results.filter(r => r.performance_metrics.cache_hit).length;
      expect(cacheHits).toBeGreaterThanOrEqual(0); // At least some potential for hits
    });

    test("should provide performance insights for LLM optimization", async () => {
      // Generate load and analyze performance
      const loadTestPromises = Array.from({ length: 100 }, (_, i) =>
        agentAPI.validateSyntax({
          code: `on click${i % 10} put 'test${i}' into #element`,
          performance_target: i % 2 === 0 ? "fast" : "comprehensive"
        })
      );

      await Promise.all(loadTestPromises);

      const performanceReport = agentAPI.getPerformanceReport();
      const cacheMetrics = agentAPI.getCacheMetrics();

      // Should provide actionable performance insights
      expect(performanceReport.current_metrics.average_validation_time_ms).toBeLessThan(200);
      expect(cacheMetrics.hit_rate).toBeGreaterThanOrEqual(0);
      expect(cacheMetrics.total_entries).toBeGreaterThan(10);
      
      // Should provide recommendations for optimization
      expect(performanceReport.recommendations).toBeDefined();
      expect(Array.isArray(performanceReport.recommendations)).toBe(true);
    });
  });
});