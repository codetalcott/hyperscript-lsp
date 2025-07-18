/**
 * Agent-optimized types for hyperscript validation
 * Based on sqlite-extensions-framework AgentRequest/AgentResponse patterns
 */

export interface ValidationRequest {
  code: string;
  context?: {
    line?: number;
    character?: number;
    surrounding_code?: string;
  };
  validation_level?: "syntax" | "semantic" | "both";
  performance_target?: "fast" | "comprehensive";
}

export interface ValidationResult {
  valid: boolean;
  confidence_score: number; // 0.0 - 1.0, for LLM uncertainty handling
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  performance_metrics: {
    validation_time_ms: number;
    cache_hit: boolean;
    database_queries: number;
  };
}

export interface ValidationError {
  code: string; // e.g., "syntax-error", "unknown-command"
  message: string;
  severity: "error" | "warning" | "info";
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  fix_suggestions?: string[];
}

export interface ValidationWarning {
  code: string;
  message: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  recommendation?: string;
}

export interface ValidationSuggestion {
  type: "completion" | "correction" | "optimization";
  suggestion: string;
  confidence: number;
  reasoning?: string;
}

export interface SyntaxRequest {
  feature: string; // e.g., "on", "put", "toggle"
  include_examples?: boolean;
  include_usage_patterns?: boolean;
}

export interface SyntaxResponse {
  feature: string;
  syntax_pattern: string;
  description: string;
  required_parts: string[];
  optional_parts: string[];
  examples: SyntaxExample[];
  usage_patterns: UsagePattern[];
  common_errors: CommonError[];
}

export interface SyntaxExample {
  title: string;
  code: string;
  explanation?: string;
}

export interface UsagePattern {
  pattern: string;
  frequency: number; // How often this pattern appears in real code
  context: string[];
}

export interface CommonError {
  error_pattern: string;
  correct_pattern: string;
  explanation: string;
}

export interface BatchValidationRequest {
  constructs: ValidationRequest[];
  optimization?: "parallel" | "sequential";
}

export interface BatchValidationResponse {
  results: ValidationResult[];
  batch_metrics: {
    total_time_ms: number;
    cache_hit_rate: number;
    parallel_processing: boolean;
  };
}

export interface ConfidenceRequest {
  code: string;
  uncertainty_areas?: string[]; // Areas LLM is uncertain about
}

export interface ConfidenceResponse {
  overall_confidence: number;
  area_confidence: {
    syntax: number;
    semantics: number;
    style: number;
  };
  uncertainty_analysis: {
    unclear_constructs: string[];
    suggested_verification: string[];
  };
}

// Cache-related types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hit_count: number;
  generation_time_ms: number;
}

export interface CacheMetrics {
  hit_rate: number;
  total_entries: number;
  memory_usage_mb: number;
  average_lookup_time_ms: number;
}

// Performance monitoring
export interface PerformanceTarget {
  max_validation_time_ms: number;
  target_cache_hit_rate: number;
  max_memory_usage_mb: number;
}

export interface PerformanceReport {
  current_metrics: {
    average_validation_time_ms: number;
    cache_hit_rate: number;
    memory_usage_mb: number;
  };
  targets: PerformanceTarget;
  meets_targets: boolean;
  recommendations: string[];
}