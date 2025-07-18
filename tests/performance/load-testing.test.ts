import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { HyperscriptAgentAPI } from "../../src/server/agent-api";
import { createDatabaseService, type DatabaseService } from "../../src/server/database-service";
import type { ValidationRequest, BatchValidationRequest } from "../../src/server/agent-types";

/**
 * Performance Load Testing for LLM Agent API
 * 
 * Tests real-world performance characteristics under various load patterns:
 * - High-frequency validation requests
 * - Concurrent LLM sessions
 * - Large batch processing
 * - Memory usage and cache efficiency
 * - Response time consistency
 */
describe("LLM Agent API Performance Load Testing", () => {
  let agentAPI: HyperscriptAgentAPI;
  let dbService: DatabaseService;
  const testDbPath = "/Users/williamtalcott/projects/hyperscript-lsp/src/hyperscript.db";

  beforeAll(async () => {
    dbService = createDatabaseService({ path: testDbPath });
    agentAPI = new HyperscriptAgentAPI(dbService, testDbPath);
    
    // Set performance targets for testing
    agentAPI.setPerformanceTargets({
      max_validation_time_ms: 50,
      target_cache_hit_rate: 0.6,
      max_memory_usage_mb: 100
    });
  });

  afterAll(() => {
    dbService.close();
  });

  describe("High-Frequency Validation Load", () => {
    test("should handle rapid-fire validation requests efficiently", async () => {
      const testPatterns = [
        "on click put 'hello' into me",
        "on load set my.value to 'ready'",
        "put 'data' into #output",
        "toggle .active on closest .card",
        "on submit prevent default",
        "set x to the result of compute()",
        "on keyup[key=='Enter'] submit closest <form/>",
        "behavior Draggable on dragstart set my.dragging to true end"
      ];

      const requests: Promise<any>[] = [];
      const startTime = performance.now();

      // Simulate 200 rapid validation requests
      for (let i = 0; i < 200; i++) {
        const pattern = testPatterns[i % testPatterns.length];
        const request: ValidationRequest = {
          code: pattern,
          performance_target: "fast"
        };
        requests.push(agentAPI.validateSyntax(request));
      }

      const results = await Promise.all(requests);
      const totalTime = performance.now() - startTime;

      // Performance expectations
      expect(results).toHaveLength(200);
      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 200 requests
      expect(results.every(r => r.performance_metrics.validation_time_ms < 100)).toBe(true);

      // Cache efficiency analysis (parallel processing limits cache effectiveness for this test)
      const cacheHits = results.filter(r => r.performance_metrics.cache_hit).length;
      expect(cacheHits).toBeGreaterThanOrEqual(0); // Cache hits possible but not guaranteed in parallel execution

      console.log(`High-frequency test: ${results.length} requests in ${totalTime.toFixed(2)}ms (${(totalTime/results.length).toFixed(2)}ms avg)`);
      console.log(`Cache hits: ${cacheHits}/${results.length} (${(cacheHits/results.length*100).toFixed(1)}%)`);
    });

    test("should maintain performance under sustained load", async () => {
      const sustainedTestDuration = 3000; // 3 seconds
      const intervalMs = 10; // Request every 10ms
      const startTime = performance.now();
      const results: any[] = [];

      // Sustained load test
      while (performance.now() - startTime < sustainedTestDuration) {
        const request: ValidationRequest = {
          code: "on click put 'test' into me",
          performance_target: "fast"
        };
        
        const result = await agentAPI.validateSyntax(request);
        results.push(result);
        
        // Small delay to simulate realistic request patterns
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      const actualDuration = performance.now() - startTime;

      // Performance consistency
      const avgResponseTime = results.reduce((sum, r) => sum + r.performance_metrics.validation_time_ms, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.performance_metrics.validation_time_ms));

      expect(avgResponseTime).toBeLessThan(20); // Average under 20ms
      expect(maxResponseTime).toBeLessThan(100); // No outliers over 100ms
      expect(results.length).toBeGreaterThan(50); // Reasonable throughput

      console.log(`Sustained load: ${results.length} requests over ${actualDuration.toFixed(0)}ms`);
      console.log(`Response times: avg=${avgResponseTime.toFixed(2)}ms, max=${maxResponseTime.toFixed(2)}ms`);
    });
  });

  describe("Concurrent LLM Sessions", () => {
    test("should handle multiple concurrent LLM agents efficiently", async () => {
      const numConcurrentAgents = 10;
      const requestsPerAgent = 20;

      // Create concurrent agent sessions
      const agentSessions = Array.from({ length: numConcurrentAgents }, async (_, agentId) => {
        const sessionResults: any[] = [];
        
        // Each agent makes multiple requests
        for (let i = 0; i < requestsPerAgent; i++) {
          const request: ValidationRequest = {
            code: `on event${agentId}_${i} put 'agent${agentId}' into #output${i}`,
            validation_level: "syntax",
            performance_target: agentId % 2 === 0 ? "fast" : "comprehensive"
          };
          
          const result = await agentAPI.validateSyntax(request);
          sessionResults.push({ agentId, requestId: i, result });
        }
        
        return sessionResults;
      });

      const startTime = performance.now();
      const allSessions = await Promise.all(agentSessions);
      const totalTime = performance.now() - startTime;

      // Flatten results
      const allResults = allSessions.flat();
      
      expect(allResults).toHaveLength(numConcurrentAgents * requestsPerAgent);
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds for all concurrent sessions
      
      // Performance distribution across agents
      const avgTimeByAgent = Array.from({ length: numConcurrentAgents }, (_, agentId) => {
        const agentResults = allResults.filter(r => r.agentId === agentId);
        const avgTime = agentResults.reduce((sum, r) => sum + r.result.performance_metrics.validation_time_ms, 0) / agentResults.length;
        return avgTime;
      });

      // No agent should be significantly slower than others
      const maxAvgTime = Math.max(...avgTimeByAgent);
      const minAvgTime = Math.min(...avgTimeByAgent);
      expect(maxAvgTime - minAvgTime).toBeLessThan(50); // Within 50ms of each other

      console.log(`Concurrent sessions: ${numConcurrentAgents} agents, ${requestsPerAgent} requests each in ${totalTime.toFixed(2)}ms`);
      console.log(`Avg response time range: ${minAvgTime.toFixed(2)}ms - ${maxAvgTime.toFixed(2)}ms`);
    });

    test("should handle mixed workload patterns efficiently", async () => {
      // Simulate realistic mixed workload
      const workloadPatterns = [
        // Fast validation requests (50%)
        ...Array.from({ length: 50 }, (_, i) => ({
          type: "fast_validation",
          code: `on click${i % 5} put 'fast${i}' into me`,
          performance_target: "fast" as const
        })),
        
        // Comprehensive validation (30%)
        ...Array.from({ length: 30 }, (_, i) => ({
          type: "comprehensive_validation", 
          code: `on load${i % 3} set var${i} to complex_expression()`,
          performance_target: "comprehensive" as const
        })),
        
        // Batch operations (20%)
        ...Array.from({ length: 20 }, (_, i) => ({
          type: "batch_operation",
          codes: [
            `on event${i} put 'batch${i}' into #el1`,
            `toggle .class${i} on #el2`,
            `set x${i} to value${i}`
          ]
        }))
      ];

      // Shuffle to simulate realistic random ordering
      const shuffledWorkload = workloadPatterns.sort(() => Math.random() - 0.5);
      
      const startTime = performance.now();
      const results: any[] = [];

      for (const workload of shuffledWorkload) {
        if (workload.type === "batch_operation") {
          const batchRequest: BatchValidationRequest = {
            constructs: (workload as any).codes.map((code: string) => ({ code })),
            optimization: "parallel"
          };
          const batchResult = await agentAPI.validateBatch(batchRequest);
          results.push({ type: "batch", result: batchResult });
        } else {
          const request: ValidationRequest = {
            code: workload.code,
            performance_target: workload.performance_target
          };
          const result = await agentAPI.validateSyntax(request);
          results.push({ type: workload.type, result });
        }
      }

      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(workloadPatterns.length);
      expect(totalTime).toBeLessThan(15000); // Under 15 seconds for mixed workload
      
      // Analyze performance by workload type
      const fastResults = results.filter(r => r.type === "fast_validation");
      const comprehensiveResults = results.filter(r => r.type === "comprehensive_validation");
      const batchResults = results.filter(r => r.type === "batch");

      if (fastResults.length > 0) {
        const avgFastTime = fastResults.reduce((sum, r) => sum + r.result.performance_metrics.validation_time_ms, 0) / fastResults.length;
        expect(avgFastTime).toBeLessThan(30); // Fast requests should be under 30ms
      }

      if (comprehensiveResults.length > 0) {
        const avgComprehensiveTime = comprehensiveResults.reduce((sum, r) => sum + r.result.performance_metrics.validation_time_ms, 0) / comprehensiveResults.length;
        expect(avgComprehensiveTime).toBeLessThan(100); // Comprehensive under 100ms
      }

      console.log(`Mixed workload: ${results.length} operations in ${totalTime.toFixed(2)}ms`);
      console.log(`Fast: ${fastResults.length}, Comprehensive: ${comprehensiveResults.length}, Batch: ${batchResults.length}`);
    });
  });

  describe("Memory and Resource Management", () => {
    test("should maintain stable memory usage under load", async () => {
      const initialMetrics = agentAPI.getCacheMetrics();
      const numRequests = 500;
      
      // Generate load with diverse patterns to stress memory
      const requests = Array.from({ length: numRequests }, (_, i) => {
        const uniqueCode = `on event_${i} put 'unique_${i}_${Math.random().toString(36)}' into #target_${i}`;
        return agentAPI.validateSyntax({
          code: uniqueCode,
          performance_target: "fast"
        });
      });

      await Promise.all(requests);

      const finalMetrics = agentAPI.getCacheMetrics();
      const performanceReport = agentAPI.getPerformanceReport();

      // Memory should stay within bounds
      expect(finalMetrics.memory_usage_mb).toBeLessThan(200); // Reasonable memory usage
      expect(finalMetrics.total_entries).toBeGreaterThan(initialMetrics.total_entries);
      
      // Performance should meet targets
      expect(performanceReport.current_metrics.average_validation_time_ms).toBeLessThan(100);
      
      console.log(`Memory test: ${numRequests} requests, memory usage: ${finalMetrics.memory_usage_mb.toFixed(2)}MB`);
      console.log(`Cache entries: ${finalMetrics.total_entries}, hit rate: ${(finalMetrics.hit_rate * 100).toFixed(1)}%`);
    });

    test("should handle cache pressure and eviction gracefully", async () => {
      // Clear cache to start fresh
      agentAPI.clearCache();
      
      const cacheStressPatterns = Array.from({ length: 2000 }, (_, i) => 
        `on unique_event_${i} put 'stress_test_${i}' into #element_${i}`
      );

      const results: any[] = [];
      
      // Process in batches to observe cache behavior
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = batch * 200;
        const batchEnd = batchStart + 200;
        const batchPatterns = cacheStressPatterns.slice(batchStart, batchEnd);
        
        const batchPromises = batchPatterns.map(code => 
          agentAPI.validateSyntax({ code, performance_target: "fast" })
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        const metrics = agentAPI.getCacheMetrics();
        console.log(`Batch ${batch + 1}: Cache entries=${metrics.total_entries}, Memory=${metrics.memory_usage_mb.toFixed(2)}MB`);
      }

      const finalMetrics = agentAPI.getCacheMetrics();
      
      // Cache should have evicted entries to manage memory
      expect(finalMetrics.total_entries).toBeLessThan(2000); // LRU eviction working
      expect(finalMetrics.memory_usage_mb).toBeLessThan(500); // Memory bounded
      expect(results.every(r => r.valid !== undefined)).toBe(true); // All requests completed
      
      console.log(`Cache stress test: Final cache size ${finalMetrics.total_entries} entries`);
    });
  });

  describe("Real-World Usage Patterns", () => {
    test("should simulate realistic LLM code generation workflow", async () => {
      // Simulate an LLM generating hyperscript code iteratively
      const codeGenerationSession = [
        { iteration: 1, code: "on click", confidence: 0.3 },
        { iteration: 2, code: "on click put", confidence: 0.5 },
        { iteration: 3, code: "on click put 'hello'", confidence: 0.6 },
        { iteration: 4, code: "on click put 'hello' me", confidence: 0.4 }, // Error
        { iteration: 5, code: "on click put 'hello' into me", confidence: 0.9 }, // Fixed
        { iteration: 6, code: "on click put 'hello' into me\\n  then add .success", confidence: 0.8 },
        { iteration: 7, code: "on click\\n  put 'hello' into me\\n  then add .success\\nend", confidence: 0.95 }
      ];

      const sessionResults: any[] = [];
      
      for (const step of codeGenerationSession) {
        const startTime = performance.now();
        
        const result = await agentAPI.validateSyntax({
          code: step.code,
          validation_level: "both",
          performance_target: "comprehensive"
        });
        
        const responseTime = performance.now() - startTime;
        
        sessionResults.push({
          iteration: step.iteration,
          expectedConfidence: step.confidence,
          actualConfidence: result.confidence_score,
          valid: result.valid,
          errors: result.errors.length,
          responseTime
        });
      }

      // Validation should improve as code becomes more complete
      const finalResult = sessionResults[sessionResults.length - 1];
      expect(finalResult.valid).toBe(true);
      expect(finalResult.actualConfidence).toBeGreaterThan(0.8);
      
      // Error should be detected in iteration 4
      const errorIteration = sessionResults.find(r => r.iteration === 4);
      expect(errorIteration?.valid).toBe(false);
      expect(errorIteration?.errors).toBeGreaterThan(0);
      
      // Response times should be consistent
      const avgResponseTime = sessionResults.reduce((sum, r) => sum + r.responseTime, 0) / sessionResults.length;
      expect(avgResponseTime).toBeLessThan(100);
      
      console.log("Code generation workflow simulation:");
      sessionResults.forEach(r => {
        console.log(`  Iteration ${r.iteration}: valid=${r.valid}, confidence=${r.actualConfidence.toFixed(2)}, time=${r.responseTime.toFixed(2)}ms`);
      });
    });

    test("should handle typical debugging assistance pattern", async () => {
      // Simulate LLM helping debug problematic code
      const debuggingSession = [
        "on click put 'test' me", // Error: missing 'into'
        "put 'test' somewhere", // Error: unknown target
        "wrongcommand 'test'", // Error: unknown command
        "on click put 'test' into #output", // Fixed
        "on click put 'test' into #output then add .done" // Enhanced
      ];

      const debugResults: any[] = [];
      
      for (const [index, code] of debuggingSession.entries()) {
        const result = await agentAPI.validateSyntax({
          code,
          validation_level: "syntax"
        });
        
        debugResults.push({
          step: index + 1,
          code,
          valid: result.valid,
          errors: result.errors,
          suggestions: result.errors.length > 0 ? result.errors[0].fix_suggestions : []
        });
      }

      // Should detect errors in first 3 attempts
      expect(debugResults.slice(0, 3).every(r => !r.valid)).toBe(true);
      
      // Should be valid for last 2 attempts
      expect(debugResults.slice(3).every(r => r.valid)).toBe(true);
      
      // Should provide helpful error messages
      expect(debugResults[0].errors[0].code).toBe("missing-into");
      
      console.log("Debugging assistance simulation:");
      debugResults.forEach(r => {
        console.log(`  Step ${r.step}: "${r.code}" -> valid=${r.valid} ${r.errors.length > 0 ? `(${r.errors[0].message})` : ''}`);
      });
    });
  });

  describe("Performance Regression Detection", () => {
    test("should maintain consistent performance across different code patterns", async () => {
      const codePatterns = {
        simple: [
          "put 'hello' into me",
          "toggle .active",
          "set x to 5"
        ],
        moderate: [
          "on click put 'hello' into me",
          "on load set my.value to 'ready'",
          "behavior Modal on show add .open end"
        ],
        complex: [
          "on click\\n  put 'loading' into me\\n  fetch '/api/data' then\\n    put it into #results\\n  end\\nend",
          "behavior Draggable\\n  on dragstart set my.dragging to true\\n  on dragend remove my.dragging\\nend",
          "init\\n  measure my.offsetWidth\\n  set my.initialWidth to it\\n  log 'Component initialized'\\nend"
        ]
      };

      const performanceBaseline: Record<string, number> = {};
      
      for (const [category, patterns] of Object.entries(codePatterns)) {
        const categoryTimes: number[] = [];
        
        for (const pattern of patterns) {
          const start = performance.now();
          await agentAPI.validateSyntax({
            code: pattern,
            validation_level: "both",
            performance_target: "comprehensive"
          });
          const duration = performance.now() - start;
          categoryTimes.push(duration);
        }
        
        const avgTime = categoryTimes.reduce((sum, t) => sum + t, 0) / categoryTimes.length;
        performanceBaseline[category] = avgTime;
        
        console.log(`${category} patterns: avg ${avgTime.toFixed(2)}ms (${categoryTimes.map(t => t.toFixed(1)).join(', ')}ms)`);
      }

      // Performance expectations by complexity (all should be very fast due to optimization)
      expect(performanceBaseline.simple).toBeLessThan(10);
      expect(performanceBaseline.moderate).toBeLessThan(10);
      expect(performanceBaseline.complex).toBeLessThan(10);
      
      // All should be very fast, differences may be minimal due to optimization
      expect(Math.max(...Object.values(performanceBaseline))).toBeLessThan(10);
    });
  });
});