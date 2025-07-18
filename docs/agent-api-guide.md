# Hyperscript Agent API Usage Guide

The Hyperscript Agent API provides optimized validation and syntax assistance specifically designed for LLM agents and automated code analysis tools. This guide shows how to integrate and use the API effectively.

## Table of Contents
- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [API Reference](#api-reference)
- [Usage Patterns](#usage-patterns)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Quick Start

### Installation

```typescript
import { HyperscriptAgentAPI } from "./src/server/agent-api";
import { createDatabaseService } from "./src/server/database-service";

// Initialize database service
const dbService = createDatabaseService({ path: "./hyperscript.db" });

// Create agent API with database optimization
const agentAPI = new HyperscriptAgentAPI(dbService, "./hyperscript.db");
```

### Basic Validation

```typescript
// Validate hyperscript code
const result = await agentAPI.validateSyntax({
  code: "on click put 'hello' into me",
  validation_level: "both",
  performance_target: "fast"
});

console.log(result.valid);           // true
console.log(result.confidence_score); // 0.95
console.log(result.errors);          // []
```

## Core Features

### 1. Fast Validation with Caching

The API provides sub-millisecond validation for common patterns through intelligent caching:

```typescript
// First validation (cache miss)
const result1 = await agentAPI.validateSyntax({
  code: "on click put 'test' into me"
});
console.log(result1.performance_metrics.cache_hit); // false
console.log(result1.performance_metrics.validation_time_ms); // ~2ms

// Second validation (cache hit)
const result2 = await agentAPI.validateSyntax({
  code: "on click put 'test' into me"
});
console.log(result2.performance_metrics.cache_hit); // true
console.log(result2.performance_metrics.validation_time_ms); // ~0.02ms
```

### 2. Confidence Scoring for LLM Uncertainty

The API provides detailed confidence analysis to help LLMs handle uncertain code:

```typescript
const confidence = await agentAPI.getValidationConfidence({
  code: "on customEvent performComplexAction",
  uncertainty_areas: ["customEvent", "performComplexAction"]
});

console.log(confidence.overall_confidence);     // 0.65
console.log(confidence.area_confidence.syntax); // 0.90
console.log(confidence.area_confidence.semantics); // 0.60
console.log(confidence.uncertainty_analysis.suggested_verification);
// ["Verify event names are standard DOM events"]
```

### 3. Structured Syntax Help

Get detailed information about hyperscript features for LLM training:

```typescript
const syntaxHelp = await agentAPI.getSyntaxHelp({
  feature: "on",
  include_examples: true,
  include_usage_patterns: true
});

console.log(syntaxHelp.syntax_pattern);
// "on [every] <event-name>[(<param-list>)] [<count>] [from <expr>] {<command>} [end]"

console.log(syntaxHelp.required_parts);
// ["event-name"]

console.log(syntaxHelp.optional_parts);
// ["every", "end"]

console.log(syntaxHelp.examples[0]);
// { title: "Basic event handler", code: "on click put 'clicked' into #output", explanation: "..." }
```

### 4. Batch Processing

Efficiently process multiple code snippets:

```typescript
const batchResult = await agentAPI.validateBatch({
  constructs: [
    { code: "on click put 'hello' into me" },
    { code: "toggle .active on closest .card" },
    { code: "set myVar to 'value'" }
  ],
  optimization: "parallel"
});

console.log(batchResult.results.length); // 3
console.log(batchResult.batch_metrics.parallel_processing); // true
console.log(batchResult.batch_metrics.total_time_ms); // ~5ms
```

## API Reference

### ValidationRequest

```typescript
interface ValidationRequest {
  code: string;                    // Hyperscript code to validate
  validation_level?: "syntax" | "semantic" | "both"; // Default: "syntax"
  performance_target?: "fast" | "normal" | "comprehensive"; // Default: "normal"
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;                  // Whether code is valid
  confidence_score: number;        // 0-1 confidence in the result
  errors: ValidationError[];       // Syntax/semantic errors
  warnings: ValidationWarning[];   // Non-critical issues
  suggestions: ValidationSuggestion[]; // Optimization suggestions
  performance_metrics: {
    validation_time_ms: number;
    cache_hit: boolean;
    database_queries: number;
  };
}
```

### ConfidenceRequest

```typescript
interface ConfidenceRequest {
  code: string;                    // Code to analyze
  uncertainty_areas?: string[];    // Areas of uncertainty
}
```

### ConfidenceResponse

```typescript
interface ConfidenceResponse {
  overall_confidence: number;      // Overall confidence (0-1)
  area_confidence: {
    syntax: number;               // Syntax confidence
    semantics: number;            // Semantic confidence  
    style: number;                // Style confidence
  };
  uncertainty_analysis: {
    unclear_constructs: string[]; // List of uncertain elements
    suggested_verification: string[]; // Verification suggestions
  };
}
```

## Usage Patterns

### LLM Code Generation Workflow

```typescript
async function validateLLMGeneratedCode(code: string) {
  // Start with comprehensive validation
  const validation = await agentAPI.validateSyntax({
    code,
    validation_level: "both",
    performance_target: "comprehensive"
  });

  if (!validation.valid) {
    // Get detailed error information for LLM feedback
    const errors = validation.errors.map(error => ({
      message: error.message,
      line: error.range.start.line,
      suggestions: error.fix_suggestions
    }));
    
    return {
      status: "needs_correction",
      errors,
      confidence: validation.confidence_score
    };
  }

  // For valid code, check confidence
  if (validation.confidence_score < 0.8) {
    // Get uncertainty analysis
    const confidence = await agentAPI.getValidationConfidence({
      code,
      uncertainty_areas: [] // LLM can specify uncertain areas
    });
    
    return {
      status: "valid_but_uncertain",
      confidence: validation.confidence_score,
      verification_needed: confidence.uncertainty_analysis.suggested_verification
    };
  }

  return {
    status: "valid_and_confident",
    confidence: validation.confidence_score
  };
}
```

### Interactive Debugging Assistant

```typescript
async function provideLLMDebuggingHelp(problematicCode: string) {
  const validation = await agentAPI.validateSyntax({
    code: problematicCode,
    validation_level: "both"
  });

  if (!validation.valid) {
    // Provide specific fix suggestions
    const fixes = validation.errors.map(error => ({
      problem: error.message,
      location: `Line ${error.range.start.line + 1}`,
      suggestions: error.fix_suggestions,
      confidence: "High" // Error detection has high confidence
    }));

    return {
      type: "syntax_errors",
      fixes,
      overall_confidence: validation.confidence_score
    };
  }

  // Check for semantic issues
  if (validation.warnings.length > 0) {
    const warnings = validation.warnings.map(warning => ({
      issue: warning.message,
      recommendation: warning.recommendation,
      severity: "Medium"
    }));

    return {
      type: "semantic_warnings", 
      warnings,
      confidence: validation.confidence_score
    };
  }

  return {
    type: "code_looks_good",
    confidence: validation.confidence_score,
    suggestions: validation.suggestions
  };
}
```

### Batch Codebase Analysis

```typescript
async function analyzeLargeCodebase(codeSnippets: string[]) {
  // Process in batches for optimal performance
  const batchSize = 50;
  const results: any[] = [];

  for (let i = 0; i < codeSnippets.length; i += batchSize) {
    const batch = codeSnippets.slice(i, i + batchSize);
    
    const batchResult = await agentAPI.validateBatch({
      constructs: batch.map(code => ({
        code,
        performance_target: "fast" // Use fast mode for large batches
      })),
      optimization: "parallel"
    });

    results.push(...batchResult.results);

    // Log progress
    console.log(`Processed ${Math.min(i + batchSize, codeSnippets.length)}/${codeSnippets.length} snippets`);
    console.log(`Batch cache hit rate: ${(batchResult.batch_metrics.cache_hit_rate * 100).toFixed(1)}%`);
  }

  // Analyze overall results
  const validCount = results.filter(r => r.valid).length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence_score, 0) / results.length;

  return {
    total_snippets: codeSnippets.length,
    valid_count: validCount,
    error_count: results.length - validCount,
    average_confidence: avgConfidence,
    detailed_results: results
  };
}
```

## Performance Optimization

### Setting Performance Targets

```typescript
// Configure performance targets
agentAPI.setPerformanceTargets({
  max_validation_time_ms: 50,      // Target < 50ms per validation
  target_cache_hit_rate: 0.7,      // Target 70% cache hit rate
  max_memory_usage_mb: 100         // Keep memory under 100MB
});

// Monitor performance
const report = agentAPI.getPerformanceReport();
console.log(`Average validation time: ${report.current_metrics.average_validation_time_ms}ms`);
console.log(`Cache hit rate: ${(report.current_metrics.cache_hit_rate * 100).toFixed(1)}%`);
console.log(`Meets targets: ${report.meets_targets}`);

if (!report.meets_targets) {
  console.log("Recommendations:", report.recommendations);
}
```

### Cache Management

```typescript
// Get cache metrics
const metrics = agentAPI.getCacheMetrics();
console.log(`Cache entries: ${metrics.total_entries}`);
console.log(`Memory usage: ${metrics.memory_usage_mb.toFixed(2)}MB`);
console.log(`Hit rate: ${(metrics.hit_rate * 100).toFixed(1)}%`);

// Clear cache if needed (e.g., between different projects)
agentAPI.clearCache();
```

### Performance Targets by Use Case

```typescript
// For interactive LLM assistance (prioritize speed)
agentAPI.setPerformanceTargets({
  max_validation_time_ms: 20,
  target_cache_hit_rate: 0.8,
  max_memory_usage_mb: 50
});

// For batch processing (prioritize throughput)  
agentAPI.setPerformanceTargets({
  max_validation_time_ms: 100,
  target_cache_hit_rate: 0.6,
  max_memory_usage_mb: 200
});

// For comprehensive analysis (prioritize accuracy)
agentAPI.setPerformanceTargets({
  max_validation_time_ms: 200,
  target_cache_hit_rate: 0.5,
  max_memory_usage_mb: 300
});
```

## Error Handling

### Graceful Error Recovery

```typescript
async function robustValidation(code: string) {
  try {
    const result = await agentAPI.validateSyntax({
      code,
      validation_level: "both"
    });
    
    return { success: true, result };
  } catch (error) {
    // Handle various error types
    if (error.message.includes("database")) {
      return {
        success: false,
        error: "database_unavailable",
        fallback: "Use basic syntax checking"
      };
    }
    
    if (error.message.includes("timeout")) {
      return {
        success: false,
        error: "validation_timeout",
        fallback: "Try with performance_target: 'fast'"
      };
    }
    
    return {
      success: false,
      error: "unknown_error",
      details: error.message
    };
  }
}
```

### Handling Uncertain Results

```typescript
async function handleUncertainValidation(code: string, uncertainAreas: string[]) {
  const confidence = await agentAPI.getValidationConfidence({
    code,
    uncertainty_areas: uncertainAreas
  });

  if (confidence.overall_confidence < 0.5) {
    return {
      recommendation: "human_review_needed",
      reason: "Low confidence in validation result",
      confidence: confidence.overall_confidence,
      unclear_elements: confidence.uncertainty_analysis.unclear_constructs
    };
  }

  if (confidence.overall_confidence < 0.8) {
    return {
      recommendation: "additional_verification",
      suggestions: confidence.uncertainty_analysis.suggested_verification,
      confidence: confidence.overall_confidence
    };
  }

  return {
    recommendation: "proceed_with_confidence",
    confidence: confidence.overall_confidence
  };
}
```

## Best Practices

### 1. Choose Appropriate Performance Targets

```typescript
// For real-time LLM interaction
const request = {
  code: userInput,
  performance_target: "fast" // Sub-10ms response
};

// For thorough code analysis
const request = {
  code: complexCode,
  validation_level: "both",
  performance_target: "comprehensive" // Full validation
};
```

### 2. Leverage Batch Processing

```typescript
// Instead of individual requests
for (const code of codeSnippets) {
  await agentAPI.validateSyntax({ code }); // Inefficient
}

// Use batch processing
const batchResult = await agentAPI.validateBatch({
  constructs: codeSnippets.map(code => ({ code })),
  optimization: "parallel"
}); // Much faster
```

### 3. Handle Confidence Appropriately

```typescript
const result = await agentAPI.validateSyntax({ code });

if (result.confidence_score > 0.9) {
  // High confidence - proceed with result
  return processResult(result);
}

if (result.confidence_score > 0.7) {
  // Medium confidence - add verification step
  const confidence = await agentAPI.getValidationConfidence({ code });
  return addVerificationStep(result, confidence);
}

// Low confidence - flag for human review
return flagForHumanReview(result);
```

### 4. Monitor Performance in Production

```typescript
// Regular performance monitoring
setInterval(async () => {
  const report = agentAPI.getPerformanceReport();
  
  if (!report.meets_targets) {
    console.warn("Performance targets not met:", report.recommendations);
    
    // Adjust targets or clear cache as needed
    if (report.current_metrics.memory_usage_mb > 150) {
      agentAPI.clearCache();
    }
  }
}, 60000); // Check every minute
```

### 5. Optimize for Your Use Case

```typescript
// For LLM training data validation
const config = {
  validation_level: "both",
  performance_target: "comprehensive"
};

// For real-time LLM assistance  
const config = {
  validation_level: "syntax",
  performance_target: "fast"
};

// For code generation feedback
const config = {
  validation_level: "both", 
  performance_target: "normal"
};
```

## Integration Examples

### Express.js API Server

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/validate', async (req, res) => {
  try {
    const { code, options = {} } = req.body;
    
    const result = await agentAPI.validateSyntax({
      code,
      validation_level: options.validation_level || "both",
      performance_target: options.performance_target || "normal"
    });
    
    res.json({
      success: true,
      validation: result,
      performance: result.performance_metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/confidence', async (req, res) => {
  const { code, uncertainty_areas } = req.body;
  
  const confidence = await agentAPI.getValidationConfidence({
    code,
    uncertainty_areas
  });
  
  res.json({ confidence });
});
```

### LLM Chat Integration

```typescript
async function processLLMChatMessage(message: string, code: string) {
  // Quick validation for immediate feedback
  const quickResult = await agentAPI.validateSyntax({
    code,
    performance_target: "fast"
  });

  if (!quickResult.valid) {
    return {
      type: "error_feedback",
      errors: quickResult.errors.map(e => e.message),
      suggestions: quickResult.errors.flatMap(e => e.fix_suggestions)
    };
  }

  // If user asks for help with specific features
  if (message.includes("how to use")) {
    const feature = extractFeature(message); // Custom parsing
    const syntaxHelp = await agentAPI.getSyntaxHelp({
      feature,
      include_examples: true
    });
    
    return {
      type: "syntax_help",
      help: syntaxHelp
    };
  }

  return {
    type: "validation_success",
    confidence: quickResult.confidence_score
  };
}
```

## Troubleshooting

### Common Issues

1. **Slow validation times**
   - Use `performance_target: "fast"` for interactive use
   - Monitor cache hit rates with `getCacheMetrics()`
   - Consider batch processing for multiple validations

2. **Low confidence scores**
   - Use `getValidationConfidence()` for detailed analysis
   - Specify `uncertainty_areas` for better confidence calculation
   - Consider human review for confidence < 0.7

3. **Memory usage concerns**
   - Monitor with `getCacheMetrics().memory_usage_mb`
   - Call `clearCache()` periodically in long-running processes
   - Adjust `max_memory_usage_mb` in performance targets

4. **Database connection issues**
   - Ensure database path is correct in constructor
   - Check database file permissions
   - Handle errors gracefully with try-catch blocks

### Debug Logging

```typescript
// Enable performance logging
const originalValidate = agentAPI.validateSyntax.bind(agentAPI);
agentAPI.validateSyntax = async function(request) {
  const start = Date.now();
  const result = await originalValidate(request);
  console.log(`Validation took ${Date.now() - start}ms, cache hit: ${result.performance_metrics.cache_hit}`);
  return result;
};
```

This guide provides comprehensive coverage of the Hyperscript Agent API for LLM integration. For additional support or feature requests, see the project repository.