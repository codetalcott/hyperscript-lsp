/**
 * Simple hyperscript parser for LSP functionality
 * This is a placeholder for a more complete parser in the future
 */

interface ParsedHyperscript {
  tokens: Token[];
  ast?: any; // Will be implemented later
  issues: Issue[];
}

interface Token {
  type: string;
  value: string;
  line: number;
  character: number;
  length: number;
}

interface Issue {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  character: number;
  length: number;
}

/**
 * A very simple hyperscript parser that tokenizes the code
 * and identifies basic issues
 */
export function parseHyperscript(code: string): ParsedHyperscript {
  const tokens: Token[] = [];
  const issues: Issue[] = [];
  
  // Basic tokenization and issue detection
  const lines = code.split('\n');
  
  for (let line = 0; line < lines.length; line++) {
    const lineContent = lines[line];
    
    // Skip empty lines
    if (lineContent.trim() === '') {
      continue;
    }
    
    // Very simple tokenizer that just splits by whitespace
    // A real parser would be much more sophisticated
    let position = 0;
    let inString = false;
    let stringStart = 0;
    let currentToken = '';
    let tokenStart = 0;
    
    while (position < lineContent.length) {
      const char = lineContent[position];
      
      // Handle string literals
      if (char === '"' || char === "'") {
        if (!inString) {
          // Start of string
          if (currentToken) {
            // Push the current token if we have one
            tokens.push({
              type: 'identifier',
              value: currentToken,
              line,
              character: tokenStart,
              length: position - tokenStart
            });
            currentToken = '';
          }
          inString = true;
          stringStart = position;
        } else {
          // End of string
          tokens.push({
            type: 'string',
            value: lineContent.substring(stringStart, position + 1),
            line,
            character: stringStart,
            length: position - stringStart + 1
          });
          inString = false;
        }
      } else if (inString) {
        // Inside a string, just continue
      } else if (/\s/.test(char)) {
        // Whitespace outside string
        if (currentToken) {
          // Push the current token
          tokens.push({
            type: getTokenType(currentToken),
            value: currentToken,
            line,
            character: tokenStart,
            length: position - tokenStart
          });
          currentToken = '';
        }
      } else {
        // Regular character, add to current token
        if (!currentToken) {
          tokenStart = position;
        }
        currentToken += char;
      }
      
      position++;
    }
    
    // Handle the last token if any
    if (currentToken) {
      tokens.push({
        type: getTokenType(currentToken),
        value: currentToken,
        line,
        character: tokenStart,
        length: position - tokenStart
      });
    }
    
    // Check for unclosed strings
    if (inString) {
      issues.push({
        message: 'Unclosed string literal',
        severity: 'error',
        line,
        character: stringStart,
        length: lineContent.length - stringStart
      });
    }
    
    // Check for unbalanced syntax - this is very basic and not comprehensive
    let featureStarts = 0;
    let featureEnds = 0;
    
    for (const token of tokens) {
      if (token.line !== line) continue;
      
      if (token.value === 'on' || token.value === 'init' || token.value === 'def') {
        featureStarts++;
      } else if (token.value === 'end') {
        featureEnds++;
      }
    }
    
    if (featureStarts > featureEnds) {
      issues.push({
        message: 'Missing "end" keyword',
        severity: 'error',
        line,
        character: lineContent.length - 1,
        length: 1
      });
    } else if (featureEnds > featureStarts) {
      // Find the 'end' token
      const endToken = tokens.find(t => t.line === line && t.value === 'end');
      if (endToken) {
        issues.push({
          message: 'Unexpected "end" keyword',
          severity: 'error',
          line,
          character: endToken.character,
          length: endToken.length
        });
      }
    }
  }
  
  return {
    tokens,
    issues
  };
}

/**
 * Determine the token type based on its value
 */
function getTokenType(token: string): string {
  // Special keywords
  const keywords = [
    'on', 'end', 'in', 'with', 'to', 'from', 'as', 'init', 'def', 'if', 'else', 'then', 'when'
  ];
  
  if (keywords.includes(token)) {
    return 'keyword';
  }
  
  // Commands
  const commands = [
    'add', 'remove', 'toggle', 'set', 'put', 'get', 'fetch', 'call', 'log', 'return', 'throw', 'wait'
  ];
  
  if (commands.includes(token)) {
    return 'command';
  }
  
  // Event types
  const events = [
    'click', 'load', 'unload', 'change', 'submit', 'keyup', 'keydown', 'mouseover', 'mouseout'
  ];
  
  if (events.includes(token)) {
    return 'event';
  }
  
  // Special symbols
  if (token === 'me' || token === 'it' || token === 'my' || token === 'its' || token === 'result') {
    return 'special';
  }
  
  // Numbers
  if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
    return 'number';
  }
  
  // Default
  return 'identifier';
}