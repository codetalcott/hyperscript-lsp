import type { DatabaseService, CompletionItem as DBCompletionItem, HoverInfo } from "./database-service";

// LSP Types
export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface CompletionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
  context?: {
    triggerKind: number;
    triggerCharacter?: string;
  };
}

export interface HoverParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface DidChangeTextDocumentParams {
  textDocument: {
    uri: string;
    version: number;
  };
  contentChanges: Array<{
    text: string;
  }>;
}

export interface DidCloseTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26
}

export interface DefinitionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface CompletionItem {
  label: string;
  kind: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

export interface Hover {
  contents: {
    kind: "plaintext" | "markdown";
    value: string;
  };
  range?: Range;
}

export interface LSPHandlers {
  handleCompletion: (params: CompletionParams) => Promise<CompletionItem[]>;
  handleHover: (params: HoverParams) => Promise<Hover | null>;
  handleDidOpen: (params: DidOpenTextDocumentParams) => void;
  handleDidChange: (params: DidChangeTextDocumentParams) => void;
  handleDidClose: (params: DidCloseTextDocumentParams) => void;
  handleDiagnostics: (uri: string) => Promise<Diagnostic[]>;
  provideDiagnostics: (uri: string) => Promise<Diagnostic[]>;
  handleDocumentSymbols: (uri: string) => Promise<DocumentSymbol[]>;
  handleGoToDefinition: (params: DefinitionParams) => Promise<Location[]>;
  
  // For testing
  setTextContent: (uri: string, content: string) => void;
  getTextContent: (uri: string) => string | undefined;
}

// Completion item kinds (from LSP spec)
const CompletionItemKind = {
  Text: 1,
  Method: 2,
  Function: 3,
  Constructor: 4,
  Field: 5,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Module: 9,
  Property: 10,
  Unit: 11,
  Value: 12,
  Enum: 13,
  Keyword: 14,
  Snippet: 15,
  Color: 16,
  File: 17,
  Reference: 18,
  Folder: 19,
  EnumMember: 20,
  Constant: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
};

/**
 * Create LSP handlers with database integration
 */
export function createLSPHandlers(dbService: DatabaseService): LSPHandlers {
  // Store document contents
  const documents = new Map<string, string>();
  
  // Helper to find matching 'end' for control structures
  function findMatchingEnd(lines: string[], startLine: number): number | null {
    let depth = 1;
    
    for (let i = startLine + 1; i < lines.length; i++) {
      const trimmed = lines[i]?.trim().toLowerCase();
      if (!trimmed) continue;
      
      const firstWord = trimmed.split(/\s+/)[0];
      
      // Increment depth for nested structures
      if (['if', 'on', 'def', 'repeat', 'for'].includes(firstWord!)) {
        depth++;
      }
      // Decrement depth for 'end'
      else if (firstWord === 'end') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    
    return null; // No matching end found
  }
  
  // Helper to find end of behavior
  function findBehaviorEnd(lines: string[], startLine: number): number {
    // Behaviors don't have explicit 'end', they end at next top-level construct or EOF
    for (let i = startLine + 1; i < lines.length; i++) {
      const trimmed = lines[i]?.trim();
      if (trimmed && trimmed.startsWith('behavior ')) {
        return i - 1;
      }
    }
    return lines.length - 1;
  }

  // Helper to get word at position
  function getWordAtPosition(text: string, position: Position): string {
    const lines = text.split('\n');
    if (position.line >= lines.length) return '';
    
    const line = lines[position.line];
    if (!line) return '';
    const char = position.character;
    
    // Find word boundaries
    let start = char;
    let end = char;
    
    while (start > 0 && line[start - 1] && /[a-zA-Z0-9_-]/.test(line[start - 1]!)) {
      start--;
    }
    
    while (end < line.length && line[end] && /[a-zA-Z0-9_-]/.test(line[end]!)) {
      end++;
    }
    
    return line.substring(start, end);
  }
  
  // Helper to get prefix for completion
  function getPrefixAtPosition(text: string, position: Position): string {
    const lines = text.split('\n');
    if (position.line >= lines.length) return '';
    
    const line = lines[position.line];
    if (!line) return '';
    const char = position.character;
    
    // Find start of current word
    let start = char;
    while (start > 0 && line[start - 1] && /[a-zA-Z0-9_-]/.test(line[start - 1]!)) {
      start--;
    }
    
    return line.substring(start, char);
  }
  
  // Convert DB completion item to LSP completion item
  function toCompletionItem(dbItem: any, kind: number): CompletionItem {
    return {
      label: dbItem.name || dbItem.symbol,
      kind,
      detail: dbItem.syntax_canonical || dbItem.description?.substring(0, 100),
      documentation: dbItem.description,
      insertText: dbItem.name || dbItem.symbol,
      sortText: dbItem.name || dbItem.symbol
    };
  }
  
  // Create hover content from hover info
  function createHoverContent(info: HoverInfo): string {
    let content = `**${info.name}** _(${info.type})_\n\n`;
    
    if (info.description) {
      content += `${info.description}\n\n`;
    }
    
    if (info.syntax) {
      content += `**Syntax:**\n\`\`\`hyperscript\n${info.syntax}\n\`\`\`\n\n`;
    }
    
    if (info.examples && info.examples.length > 0) {
      content += `**Examples:**\n`;
      for (const example of info.examples) {
        content += `\n_${example.title}_\n`;
        content += `\`\`\`hyperscript\n${example.code}\n\`\`\`\n`;
      }
    }
    
    return content;
  }
  
  // Helper function for diagnostics (shared between both methods)
  async function provideDiagnosticsImpl(uri: string): Promise<Diagnostic[]> {
    const text = documents.get(uri);
    if (!text) return [];
    
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    // Track variables for semantic analysis
    const declaredVariables = new Set<string>();
    const usedVariables = new Set<string>();
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('--')) continue;
      
      // Check for unmatched quotes
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;
      
      if (singleQuotes % 2 !== 0) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: line.length }
          },
          severity: DiagnosticSeverity.Error,
          code: "syntax-error",
          message: "Unmatched single quote",
          source: "hyperscript-lsp"
        });
      }
      
      if (doubleQuotes % 2 !== 0) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: line.length }
          },
          severity: DiagnosticSeverity.Error,
          code: "syntax-error",
          message: "Unmatched double quote",
          source: "hyperscript-lsp"
        });
      }
      
      // Check for unmatched control structures that REQUIRE 'end'
      if (trimmed.startsWith('if ') && !findMatchingEnd(lines, lineIndex)) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: line.length }
          },
          severity: DiagnosticSeverity.Error,
          code: "syntax-error",
          message: "Missing 'end' for 'if' statement",
          source: "hyperscript-lsp"
        });
      }
      
      // Note: 'on' handlers don't require 'end' - it's optional in hyperscript
      // Only flag as error if we detect an obvious multi-line handler that looks incomplete
      if (trimmed.startsWith('on ') && lineIndex < lines.length - 1) {
        const nextLine = lines[lineIndex + 1]?.trim();
        if (nextLine && !nextLine.startsWith('on ') && !nextLine.startsWith('end') && 
            !nextLine.startsWith('--') && nextLine.length > 0) {
          // This looks like a multi-line handler, check if it eventually has an 'end'
          let hasEnd = false;
          for (let i = lineIndex + 1; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (line === 'end') {
              hasEnd = true;
              break;
            }
            if (line && (line.startsWith('on ') || line.startsWith('behavior ') || 
                        line.startsWith('def ') || line.startsWith('init'))) {
              break; // Found another top-level construct
            }
          }
          // Only warn, don't error, since 'end' is optional
          if (!hasEnd && lineIndex < lines.length - 2) {
            diagnostics.push({
              range: {
                start: { line: lineIndex, character: 0 },
                end: { line: lineIndex, character: line.length }
              },
              severity: DiagnosticSeverity.Information, // Just informational, not error
              code: "style-suggestion",
              message: "Consider adding 'end' for multi-line event handler (optional but recommended for clarity)",
              source: "hyperscript-lsp"
            });
          }
        }
      }
      
      // Check for incomplete 'put' commands
      if (trimmed.startsWith('put ') && !trimmed.includes(' into ')) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: line.length }
          },
          severity: DiagnosticSeverity.Error,
          code: "syntax-error",
          message: "Incomplete 'put' command - missing 'into' clause",
          source: "hyperscript-lsp"
        });
      }
      
      // Track variable declarations
      const setMatch = trimmed.match(/^set\s+(\w+)\s+to\s+/);
      if (setMatch && setMatch[1]) {
        declaredVariables.add(setMatch[1]);
      }
      
      // Track variable usage in simple contexts
      const putMatch = trimmed.match(/^put\s+(\w+)\s+into\s+/);
      if (putMatch && putMatch[1] && !putMatch[1].startsWith("'") && !putMatch[1].startsWith('"') && !['me', 'it', 'you'].includes(putMatch[1])) {
        usedVariables.add(putMatch[1]);
      }
      
      // Check for unknown commands/keywords
      const words = trimmed.split(/\s+/);
      
      // Check first word (commands)
      if (words.length > 0 && words[0]) {
        const firstWord = words[0].toLowerCase();
        
        // Skip common control structures and known patterns  
        if (!['if', 'else', 'end', 'on', 'behavior', 'init', 'def', 'then', 'set', 'put', 
              'tell', 'trigger', 'send', 'fetch', 'go', 'call', 'repeat', 'for', 'while', 
              'return', 'continue', 'break', 'try', 'catch', 'throw'].includes(firstWord)) {
          try {
            const hoverInfo = await dbService.getHoverInfo(firstWord);
            if (!hoverInfo) {
              const startChar = line.indexOf(words[0]);
              diagnostics.push({
                range: {
                  start: { line: lineIndex, character: startChar },
                  end: { line: lineIndex, character: startChar + words[0].length }
                },
                severity: DiagnosticSeverity.Error,
                code: "unknown-command",
                message: `Unknown command: '${firstWord}'`,
                source: "hyperscript-lsp"
              });
            }
          } catch (error) {
            // Ignore database errors for diagnostics
          }
        }
      }
      
      // Check for unknown words in other positions (e.g., after 'into')
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (word && !word.startsWith("'") && !word.startsWith('"') && 
            !word.startsWith('#') && !word.startsWith('.') &&
            !['me', 'it', 'you', 'the', 'my', 'its', 'a', 'an', 'and', 'or', 'not',
              'to', 'from', 'into', 'onto', 'with', 'without', 'of', 'in', 'on', 'at',
              'true', 'false', 'null', 'undefined'].includes(word.toLowerCase())) {
          
          // Check if this looks like a variable or unknown identifier
          if (/^[a-zA-Z_]\w*$/.test(word)) {
            try {
              const hoverInfo = await dbService.getHoverInfo(word.toLowerCase());
              if (!hoverInfo) {
                const startChar = line.indexOf(word, line.indexOf(words[i-1] || ''));
                diagnostics.push({
                  range: {
                    start: { line: lineIndex, character: startChar },
                    end: { line: lineIndex, character: startChar + word.length }
                  },
                  severity: DiagnosticSeverity.Error,
                  code: "unknown-command",
                  message: `Unknown command: '${word.toLowerCase()}'`,
                  source: "hyperscript-lsp"
                });
              }
            } catch (error) {
              // Ignore database errors for diagnostics
            }
          }
        }
      }
      
      // Check for potentially invalid events - but be lenient with common ones
      const eventMatch = trimmed.match(/^on\s+(\w+)/);
      if (eventMatch && eventMatch[1]) {
        const eventName = eventMatch[1];
        // More comprehensive list of common events
        const commonEvents = [
          'click', 'load', 'submit', 'change', 'keyup', 'keydown', 'focus', 'blur', 
          'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousedown', 'mouseup',
          'resize', 'scroll', 'input', 'invalid', 'reset', 'select', 'toggle',
          'contextmenu', 'dblclick', 'dragstart', 'drag', 'dragend', 'drop', 'dragover',
          'animationend', 'transitionend'
        ];
        // Only warn for clearly non-standard events
        if (!commonEvents.includes(eventName) && eventName.length > 2 && !eventName.includes(':')) {
          const startChar = line.indexOf(eventName);
          diagnostics.push({
            range: {
              start: { line: lineIndex, character: startChar },
              end: { line: lineIndex, character: startChar + eventName.length }
            },
            severity: DiagnosticSeverity.Warning,
            code: "unknown-event",
            message: `Potentially unknown event: '${eventName}'`,
            source: "hyperscript-lsp"
          });
        }
      }
    }
    
    // Check for unused variables
    for (const variable of declaredVariables) {
      if (!usedVariables.has(variable)) {
        // Find the line where this variable was declared
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          if (line && line.includes(`set ${variable} to `)) {
            const startChar = line.indexOf(variable);
            diagnostics.push({
              range: {
                start: { line: lineIndex, character: startChar },
                end: { line: lineIndex, character: startChar + variable.length }
              },
              severity: DiagnosticSeverity.Warning,
              code: "unused-variable",
              message: `Variable '${variable}' is declared but never used`,
              source: "hyperscript-lsp"
            });
            break;
          }
        }
      }
    }
    
    // Check for undefined variables  
    for (const variable of usedVariables) {
      if (!declaredVariables.has(variable)) {
        // Find the line where this variable was used
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          if (line && line.includes(`put ${variable} into `)) {
            const startChar = line.indexOf(variable);
            diagnostics.push({
              range: {
                start: { line: lineIndex, character: startChar },
                end: { line: lineIndex, character: startChar + variable.length }
              },
              severity: DiagnosticSeverity.Error,
              code: "undefined-variable",
              message: `Variable '${variable}' is used but not defined`,
              source: "hyperscript-lsp"
            });
            break;
          }
        }
      }
    }
    
    return diagnostics;
  }
  
  return {
    handleCompletion: async (params: CompletionParams): Promise<CompletionItem[]> => {
      const uri = params.textDocument.uri;
      const text = documents.get(uri);
      if (!text) return [];
      
      const prefix = getPrefixAtPosition(text, params.position);
      
      try {
        // Get completions from all element types
        const results = await dbService.getCompletionItems(prefix, "all");
        const items: CompletionItem[] = [];
        
        // Convert commands
        if (results.commands) {
          for (const cmd of results.commands) {
            items.push(toCompletionItem(cmd, CompletionItemKind.Function));
          }
        }
        
        // Convert keywords
        if (results.keywords) {
          for (const kw of results.keywords) {
            items.push(toCompletionItem(kw, CompletionItemKind.Keyword));
          }
        }
        
        // Convert expressions
        if (results.expressions) {
          for (const expr of results.expressions) {
            items.push(toCompletionItem(expr, CompletionItemKind.Variable));
          }
        }
        
        // Convert features
        if (results.features) {
          for (const feat of results.features) {
            items.push(toCompletionItem(feat, CompletionItemKind.Event));
          }
        }
        
        // Convert special symbols
        if (results.specialSymbols) {
          for (const sym of results.specialSymbols) {
            items.push(toCompletionItem(sym, CompletionItemKind.Constant));
          }
        }
        
        return items;
      } catch (error) {
        console.error("Error getting completions:", error);
        return [];
      }
    },
    
    handleHover: async (params: HoverParams): Promise<Hover | null> => {
      const uri = params.textDocument.uri;
      const text = documents.get(uri);
      if (!text) return null;
      
      const word = getWordAtPosition(text, params.position);
      if (!word) return null;
      
      try {
        const hoverInfo = await dbService.getHoverInfo(word);
        if (!hoverInfo) return null;
        
        return {
          contents: {
            kind: "markdown",
            value: createHoverContent(hoverInfo)
          }
        };
      } catch (error) {
        console.error("Error getting hover info:", error);
        return null;
      }
    },
    
    handleDidOpen: (params: DidOpenTextDocumentParams): void => {
      documents.set(params.textDocument.uri, params.textDocument.text);
    },
    
    handleDidChange: (params: DidChangeTextDocumentParams): void => {
      // For simplicity, we're doing full document sync
      if (params.contentChanges.length > 0 && params.contentChanges[0]) {
        documents.set(params.textDocument.uri, params.contentChanges[0].text);
      }
    },
    
    handleDidClose: (params: DidCloseTextDocumentParams): void => {
      documents.delete(params.textDocument.uri);
    },

    handleDiagnostics: async (uri: string): Promise<Diagnostic[]> => {
      return await provideDiagnosticsImpl(uri);
    },

    provideDiagnostics: async (uri: string): Promise<Diagnostic[]> => {
      return await provideDiagnosticsImpl(uri);
    },

    handleDocumentSymbols: async (uri: string): Promise<DocumentSymbol[]> => {
      const text = documents.get(uri);
      if (!text) return [];
      
      const symbols: DocumentSymbol[] = [];
      const lines = text.split('\n');
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) continue;
        const trimmed = line.trim();
        
        // Find behaviors
        const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
        if (behaviorMatch) {
          const name = behaviorMatch[1];
          const endLine = findBehaviorEnd(lines, lineIndex);
          
          symbols.push({
            name: name!,
            kind: SymbolKind.Class,
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: endLine, character: lines[endLine]?.length || 0 }
            },
            selectionRange: {
              start: { line: lineIndex, character: line.indexOf(name!) },
              end: { line: lineIndex, character: line.indexOf(name!) + name!.length }
            }
          });
        }
        
        // Find event handlers
        const eventMatch = trimmed.match(/^on\s+(\w+)/);
        if (eventMatch) {
          const eventName = eventMatch[1];
          const endLine = findMatchingEnd(lines, lineIndex) || lineIndex;
          
          symbols.push({
            name: `on ${eventName}`,
            kind: SymbolKind.Event,
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: endLine, character: lines[endLine]?.length || 0 }
            },
            selectionRange: {
              start: { line: lineIndex, character: line.indexOf('on') },
              end: { line: lineIndex, character: line.indexOf(eventName!) + eventName!.length }
            }
          });
        }
        
        // Find function definitions
        const defMatch = trimmed.match(/^def\s+(\w+)/);
        if (defMatch) {
          const funcName = defMatch[1];
          const endLine = findMatchingEnd(lines, lineIndex) || lineIndex;
          
          symbols.push({
            name: funcName!,
            kind: SymbolKind.Function,
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: endLine, character: lines[endLine]?.length || 0 }
            },
            selectionRange: {
              start: { line: lineIndex, character: line.indexOf(funcName!) },
              end: { line: lineIndex, character: line.indexOf(funcName!) + funcName!.length }
            }
          });
        }
      }
      
      return symbols;
    },

    handleGoToDefinition: async (params: DefinitionParams): Promise<Location[]> => {
      const text = documents.get(params.textDocument.uri);
      if (!text) return [];
      
      const word = getWordAtPosition(text, params.position);
      if (!word) return [];
      
      // For now, just return the current location if it's a known element
      try {
        const definition = await dbService.findDefinition(word);
        if (definition) {
          // Since we don't have external files, return the current document
          return [{
            uri: params.textDocument.uri,
            range: {
              start: params.position,
              end: params.position
            }
          }];
        }
      } catch (error) {
        console.error("Error finding definition:", error);
      }
      
      return [];
    },
    
    // For testing
    setTextContent: (uri: string, content: string): void => {
      documents.set(uri, content);
    },
    
    getTextContent: (uri: string): string | undefined => {
      return documents.get(uri);
    }
  };
}