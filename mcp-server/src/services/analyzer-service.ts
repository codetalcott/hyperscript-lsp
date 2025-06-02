import type { AnalyzeResult } from '../types.js';

export class AnalyzerService {
  analyze(code: string): AnalyzeResult {
    const diagnostics: AnalyzeResult['diagnostics'] = [];
    const lines = code.split('\n');
    
    // Track structure depth
    const structureStack: Array<{ type: string; line: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('--')) continue;
      
      // Check for structure starts
      const structureStarts = [
        { pattern: /^if\s+/, type: 'if' },
        { pattern: /^on\s+/, type: 'on' },
        { pattern: /^behavior\s+/, type: 'behavior' },
        { pattern: /^def\s+/, type: 'def' },
        { pattern: /^repeat\s+/, type: 'repeat' },
        { pattern: /^for\s+/, type: 'for' }
      ];
      
      for (const { pattern, type } of structureStarts) {
        if (pattern.test(trimmed)) {
          structureStack.push({ type, line: i });
          break;
        }
      }
      
      // Check for 'end'
      if (trimmed === 'end' || trimmed.startsWith('end ')) {
        if (structureStack.length === 0) {
          diagnostics.push({
            line: i + 1,
            message: "Unexpected 'end' - no matching opening statement",
            severity: 'error'
          });
        } else {
          structureStack.pop();
        }
      }
      
      // Check for common syntax issues
      if (trimmed.includes('=') && !trimmed.includes('==')) {
        // Warn about single = in conditions
        if (trimmed.match(/if.*[^=!<>]=(?!=)/)) {
          diagnostics.push({
            line: i + 1,
            message: "Possible error: Use '==' for comparison, not '='",
            severity: 'warning'
          });
        }
      }
      
      // Check for unclosed strings
      const quotes = trimmed.match(/["'`]/g);
      if (quotes && quotes.length % 2 !== 0) {
        diagnostics.push({
          line: i + 1,
          message: "Unclosed string literal",
          severity: 'error'
        });
      }
    }
    
    // Check for unclosed structures
    while (structureStack.length > 0) {
      const unclosed = structureStack.pop()!;
      diagnostics.push({
        line: unclosed.line + 1,
        message: `Missing 'end' for '${unclosed.type}' statement`,
        severity: 'error'
      });
    }
    
    return { diagnostics };
  }
  
  findWordAtPosition(code: string, line: number, character: number): string {
    const lines = code.split('\n');
    if (line >= lines.length) return '';
    
    const lineText = lines[line] || '';
    let start = character;
    let end = character;
    
    // Find word boundaries
    while (start > 0 && /[a-zA-Z0-9_-]/.test(lineText[start - 1] || '')) {
      start--;
    }
    
    while (end < lineText.length && /[a-zA-Z0-9_-]/.test(lineText[end] || '')) {
      end++;
    }
    
    return lineText.substring(start, end);
  }
}