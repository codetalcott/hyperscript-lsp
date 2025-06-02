export interface AnalyzeResult {
  diagnostics: Array<{
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

export interface CompletionResult {
  completions: Array<{
    label: string;
    detail?: string;
    kind?: string;
  }>;
}

export interface HoverResult {
  name: string;
  type: string;
  description?: string;
  syntax?: string;
  examples?: Array<{
    title?: string;
    code: string;
  }>;
}

export interface SearchResult {
  commands?: Array<ElementInfo>;
  keywords?: Array<ElementInfo>;
  expressions?: Array<ElementInfo>;
  features?: Array<ElementInfo>;
  specialSymbols?: Array<ElementInfo>;
}

export interface ElementInfo {
  name: string;
  description?: string;
  syntax?: string;
}

export type GeneratePattern = 
  | 'event-handler' 
  | 'fetch-request' 
  | 'animation' 
  | 'form-validation' 
  | 'todo-item'
  | 'modal'
  | 'drag-drop'
  | 'infinite-scroll';

export interface GenerateOptions {
  pattern: GeneratePattern;
  customizations?: Record<string, any>;
}