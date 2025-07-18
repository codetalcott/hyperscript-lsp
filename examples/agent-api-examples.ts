/**
 * Hyperscript Agent API - Practical Examples
 * 
 * This file contains working examples of how to use the Hyperscript Agent API
 * for various LLM and automated code analysis scenarios.
 */

import { HyperscriptAgentAPI } from "../src/server/agent-api";
import { createDatabaseService } from "../src/server/database-service";

// Initialize the agent API
const dbService = createDatabaseService({ path: "./src/hyperscript.db" });
const agentAPI = new HyperscriptAgentAPI(dbService, "./src/hyperscript.db");

/**
 * Example 1: Basic Validation for LLM Code Generation
 */
export async function example1_BasicValidation() {
  console.log("\n=== Example 1: Basic Validation ===");
  
  const codeToValidate = "on click put 'hello world' into me";
  
  const result = await agentAPI.validateSyntax({
    code: codeToValidate,
    validation_level: "both",
    performance_target: "normal"
  });
  
  console.log(`Code: "${codeToValidate}"`);
  console.log(`Valid: ${result.valid}`);
  console.log(`Confidence: ${result.confidence_score.toFixed(2)}`);
  console.log(`Validation time: ${result.performance_metrics.validation_time_ms}ms`);
  
  if (result.errors.length > 0) {
    console.log("Errors:");
    result.errors.forEach(error => {
      console.log(`  - ${error.message} (${error.code})`);
      console.log(`    Suggestions: ${error.fix_suggestions.join(", ")}`);
    });
  }
  
  return result;
}

/**
 * Example 2: Error Detection and Correction Guidance
 */
export async function example2_ErrorDetection() {
  console.log("\n=== Example 2: Error Detection ===");
  
  const incorrectCode = "on click put 'hello' me"; // Missing 'into'
  
  const result = await agentAPI.validateSyntax({
    code: incorrectCode,
    validation_level: "syntax"
  });
  
  console.log(`Code: "${incorrectCode}"`);
  console.log(`Valid: ${result.valid}`);
  console.log(`Confidence in error detection: ${result.confidence_score.toFixed(2)}`);
  
  if (!result.valid) {
    console.log("\nDetected errors:");
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`);
      console.log(`     Location: Line ${error.range.start.line + 1}, Column ${error.range.start.character + 1}`);
      console.log(`     Fix suggestions:`);
      error.fix_suggestions.forEach(suggestion => {
        console.log(`       - ${suggestion}`);
      });
    });
  }
  
  return result;
}

/**
 * Example 3: Confidence Analysis for Uncertain Code
 */
export async function example3_ConfidenceAnalysis() {
  console.log("\n=== Example 3: Confidence Analysis ===");
  
  const uncertainCode = `
    on customEvent from #specialElement
      performComplexOperation with unknownData
      if result is successful then
        updateInterface
      else
        handleError
      end
    end
  `.trim();
  
  const uncertaintyAreas = [
    "customEvent",
    "performComplexOperation",
    "unknownData",
    "updateInterface",
    "handleError"
  ];
  
  const confidence = await agentAPI.getValidationConfidence({
    code: uncertainCode,
    uncertainty_areas: uncertaintyAreas
  });
  
  console.log(`Code: "${uncertainCode.replace(/\n/g, ' ').substring(0, 60)}..."`);
  console.log(`Overall confidence: ${confidence.overall_confidence.toFixed(2)}`);
  console.log(`Area confidence:`);
  console.log(`  Syntax: ${confidence.area_confidence.syntax.toFixed(2)}`);
  console.log(`  Semantics: ${confidence.area_confidence.semantics.toFixed(2)}`);
  console.log(`  Style: ${confidence.area_confidence.style.toFixed(2)}`);
  
  console.log(`\nUnclear constructs: ${confidence.uncertainty_analysis.unclear_constructs.join(", ")}`);
  console.log(`Verification suggestions:`);
  confidence.uncertainty_analysis.suggested_verification.forEach(suggestion => {
    console.log(`  - ${suggestion}`);
  });
  
  return confidence;
}

/**
 * Example 4: Syntax Help for LLM Learning
 */
export async function example4_SyntaxHelp() {
  console.log("\n=== Example 4: Syntax Help ===");
  
  const syntaxHelp = await agentAPI.getSyntaxHelp({
    feature: "on",
    include_examples: true,
    include_usage_patterns: true
  });
  
  console.log(`Feature: ${syntaxHelp.feature}`);
  console.log(`Syntax pattern: ${syntaxHelp.syntax_pattern}`);
  console.log(`Required parts: [${syntaxHelp.required_parts.join(", ")}]`);
  console.log(`Optional parts: [${syntaxHelp.optional_parts.join(", ")}]`);
  
  if (syntaxHelp.examples.length > 0) {
    console.log(`\nExamples:`);
    syntaxHelp.examples.slice(0, 2).forEach((example, index) => {
      console.log(`  ${index + 1}. ${example.title}`);
      console.log(`     Code: ${example.code}`);
      console.log(`     Explanation: ${example.explanation}`);
    });
  }
  
  if (syntaxHelp.usage_patterns.length > 0) {
    console.log(`\nUsage patterns:`);
    syntaxHelp.usage_patterns.forEach(pattern => {
      console.log(`  - "${pattern.pattern}" (${(pattern.frequency * 100).toFixed(1)}% frequency)`);
      console.log(`    Context: ${pattern.context.join(", ")}`);
    });
  }
  
  return syntaxHelp;
}

/**
 * Example 5: Batch Processing for Large Codebases
 */
export async function example5_BatchProcessing() {
  console.log("\n=== Example 5: Batch Processing ===");
  
  const codeSnippets = [
    "on click put 'hello' into me",
    "toggle .active on closest .card", 
    "set myVar to 'value'",
    "on load add .ready to document",
    "put 'loading...' into #status",
    "on submit prevent default",
    "remove .highlight from .selected",
    "on hover add .hover-effect to me"
  ];
  
  const startTime = Date.now();
  
  const batchResult = await agentAPI.validateBatch({
    constructs: codeSnippets.map(code => ({
      code,
      performance_target: "fast"
    })),
    optimization: "parallel"
  });
  
  const endTime = Date.now();
  
  console.log(`Processed ${batchResult.results.length} code snippets`);
  console.log(`Total time: ${endTime - startTime}ms`);
  console.log(`Batch processing time: ${batchResult.batch_metrics.total_time_ms}ms`);
  console.log(`Parallel processing: ${batchResult.batch_metrics.parallel_processing}`);
  console.log(`Cache hit rate: ${(batchResult.batch_metrics.cache_hit_rate * 100).toFixed(1)}%`);
  
  const validCount = batchResult.results.filter(r => r.valid).length;
  console.log(`Valid snippets: ${validCount}/${batchResult.results.length}`);
  
  // Show any errors found
  batchResult.results.forEach((result, index) => {
    if (!result.valid) {
      console.log(`\nSnippet ${index + 1}: "${codeSnippets[index]}"`);
      console.log(`  Errors: ${result.errors.map(e => e.message).join(", ")}`);
    }
  });
  
  return batchResult;
}

/**
 * Example 6: Performance Monitoring and Optimization
 */
export async function example6_PerformanceMonitoring() {
  console.log("\n=== Example 6: Performance Monitoring ===");
  
  // Set performance targets
  agentAPI.setPerformanceTargets({
    max_validation_time_ms: 50,
    target_cache_hit_rate: 0.7,
    max_memory_usage_mb: 100
  });
  
  // Perform some validations to generate metrics
  const testCodes = [
    "on click put 'test1' into me",
    "on click put 'test2' into me", // Should hit cache
    "toggle .active",
    "set x to 'value'",
    "on click put 'test1' into me", // Should hit cache again
  ];
  
  for (const code of testCodes) {
    await agentAPI.validateSyntax({ code, performance_target: "fast" });
  }
  
  // Get performance report
  const performanceReport = agentAPI.getPerformanceReport();
  
  console.log("Performance Report:");
  console.log(`Average validation time: ${performanceReport.current_metrics.average_validation_time_ms.toFixed(2)}ms`);
  console.log(`Cache hit rate: ${(performanceReport.current_metrics.cache_hit_rate * 100).toFixed(1)}%`);
  console.log(`Memory usage: ${performanceReport.current_metrics.memory_usage_mb.toFixed(2)}MB`);
  console.log(`Meets targets: ${performanceReport.meets_targets}`);
  
  if (performanceReport.recommendations.length > 0) {
    console.log("\nRecommendations:");
    performanceReport.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }
  
  // Get cache metrics
  const cacheMetrics = agentAPI.getCacheMetrics();
  console.log(`\nCache Metrics:`);
  console.log(`  Total entries: ${cacheMetrics.total_entries}`);
  console.log(`  Hit rate: ${(cacheMetrics.hit_rate * 100).toFixed(1)}%`);
  console.log(`  Memory usage: ${cacheMetrics.memory_usage_mb.toFixed(2)}MB`);
  console.log(`  Average lookup time: ${cacheMetrics.average_lookup_time_ms.toFixed(2)}ms`);
  
  return { performanceReport, cacheMetrics };
}

/**
 * Example 7: LLM Code Generation Workflow
 */
export async function example7_LLMCodeGeneration() {
  console.log("\n=== Example 7: LLM Code Generation Workflow ===");
  
  // Simulate LLM generating code iteratively
  const generationSteps = [
    { step: 1, code: "on click", description: "Starting event handler" },
    { step: 2, code: "on click put", description: "Adding put command" },
    { step: 3, code: "on click put 'hello'", description: "Adding content" },
    { step: 4, code: "on click put 'hello' me", description: "Adding target (error)" },
    { step: 5, code: "on click put 'hello' into me", description: "Correcting syntax" },
    { step: 6, code: "on click put 'hello' into me then add .success", description: "Adding enhancement" }
  ];
  
  console.log("LLM Code Generation Session:");
  
  for (const { step, code, description } of generationSteps) {
    const result = await agentAPI.validateSyntax({
      code,
      validation_level: "both",
      performance_target: "comprehensive"
    });
    
    console.log(`\nStep ${step}: ${description}`);
    console.log(`  Code: "${code}"`);
    console.log(`  Valid: ${result.valid}`);
    console.log(`  Confidence: ${result.confidence_score.toFixed(2)}`);
    
    if (!result.valid && result.errors.length > 0) {
      console.log(`  Error: ${result.errors[0].message}`);
      console.log(`  Suggestion: ${result.errors[0].fix_suggestions[0]}`);
    }
    
    if (result.valid && result.suggestions.length > 0) {
      console.log(`  Suggestion: ${result.suggestions[0].suggestion}`);
    }
  }
  
  return generationSteps;
}

/**
 * Example 8: Interactive Debugging Assistant
 */
export async function example8_DebuggingAssistant() {
  console.log("\n=== Example 8: Interactive Debugging Assistant ===");
  
  const debuggingSession = [
    "on click put 'test' me",           // Error: missing 'into'
    "put 'test' somewhere",             // Error: missing 'into'  
    "unknowncommand 'test'",            // Error: unknown command
    "on click put 'test' into #output", // Fixed!
  ];
  
  console.log("Debugging Session:");
  
  for (let i = 0; i < debuggingSession.length; i++) {
    const code = debuggingSession[i];
    const result = await agentAPI.validateSyntax({
      code,
      validation_level: "syntax"
    });
    
    console.log(`\nAttempt ${i + 1}: "${code}"`);
    
    if (result.valid) {
      console.log(`  ✅ Valid! (confidence: ${result.confidence_score.toFixed(2)})`);
      if (result.suggestions.length > 0) {
        console.log(`  💡 Suggestion: ${result.suggestions[0].suggestion}`);
      }
    } else {
      console.log(`  ❌ Invalid (confidence: ${result.confidence_score.toFixed(2)})`);
      result.errors.forEach(error => {
        console.log(`  🔧 Fix: ${error.message}`);
        if (error.fix_suggestions.length > 0) {
          console.log(`     Try: ${error.fix_suggestions[0]}`);
        }
      });
    }
  }
  
  return debuggingSession;
}

/**
 * Example 9: Real-time Validation Server
 */
export async function example9_ValidationServer() {
  console.log("\n=== Example 9: Real-time Validation Server ===");
  
  // Simulate incoming validation requests
  const incomingRequests = [
    { id: 1, code: "on click put 'hello' into me", client: "LLM-A" },
    { id: 2, code: "toggle .active", client: "LLM-B" },
    { id: 3, code: "on click put 'test' me", client: "LLM-A" }, // Error
    { id: 4, code: "set myVar to 'value'", client: "LLM-C" },
    { id: 5, code: "on click put 'hello' into me", client: "LLM-B" }, // Cache hit
  ];
  
  console.log("Processing validation requests...");
  
  const responses = [];
  
  for (const request of incomingRequests) {
    const startTime = Date.now();
    
    try {
      const result = await agentAPI.validateSyntax({
        code: request.code,
        performance_target: "fast" // Prioritize speed for real-time
      });
      
      const responseTime = Date.now() - startTime;
      
      const response = {
        id: request.id,
        client: request.client,
        valid: result.valid,
        confidence: result.confidence_score,
        response_time_ms: responseTime,
        cache_hit: result.performance_metrics.cache_hit,
        errors: result.errors.map(e => ({
          message: e.message,
          suggestions: e.fix_suggestions
        }))
      };
      
      responses.push(response);
      
      console.log(`Request ${request.id} (${request.client}): ${result.valid ? '✅' : '❌'} ${responseTime}ms ${result.performance_metrics.cache_hit ? '🏆' : ''}`);
      
    } catch (error) {
      console.log(`Request ${request.id} (${request.client}): ❌ Error - ${error.message}`);
    }
  }
  
  // Summary statistics
  const avgResponseTime = responses.reduce((sum, r) => sum + r.response_time_ms, 0) / responses.length;
  const cacheHits = responses.filter(r => r.cache_hit).length;
  const validCodes = responses.filter(r => r.valid).length;
  
  console.log(`\nSummary:`);
  console.log(`  Processed: ${responses.length} requests`);
  console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`  Cache hits: ${cacheHits}/${responses.length} (${(cacheHits/responses.length*100).toFixed(1)}%)`);
  console.log(`  Valid codes: ${validCodes}/${responses.length} (${(validCodes/responses.length*100).toFixed(1)}%)`);
  
  return responses;
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("🚀 Hyperscript Agent API Examples\n");
  
  try {
    await example1_BasicValidation();
    await example2_ErrorDetection();
    await example3_ConfidenceAnalysis();
    await example4_SyntaxHelp();
    await example5_BatchProcessing();
    await example6_PerformanceMonitoring();
    await example7_LLMCodeGeneration();
    await example8_DebuggingAssistant();
    await example9_ValidationServer();
    
    console.log("\n✅ All examples completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Example failed:", error.message);
  } finally {
    // Clean up
    dbService.close();
  }
}

// Export individual examples for selective testing
export {
  agentAPI,
  dbService
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}