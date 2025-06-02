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
      const text = documents.get(uri);
      if (!text) return [];
      
      const diagnostics: Diagnostic[] = [];
      const lines = text.split('\n');
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) continue;
        
        // Basic syntax checks
        const trimmed = line.trim();
        
        // Check for unmatched 'if' without 'end'
        if (trimmed.startsWith('if ') && !findMatchingEnd(lines, lineIndex)) {
          diagnostics.push({
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: lineIndex, character: line.length }
            },
            severity: DiagnosticSeverity.Error,
            message: "Missing 'end' for 'if' statement",
            source: "hyperscript-lsp"
          });
        }
        
        // Check for unmatched 'on' without 'end'
        if (trimmed.startsWith('on ') && !findMatchingEnd(lines, lineIndex)) {
          diagnostics.push({
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: lineIndex, character: line.length }
            },
            severity: DiagnosticSeverity.Error,
            message: "Missing 'end' for 'on' event handler",
            source: "hyperscript-lsp"
          });
        }
        
        // Check for unknown commands
        const words = trimmed.split(/\s+/);
        if (words.length > 0 && words[0]) {
          const firstWord = words[0].toLowerCase();
          
          // Skip comments and common keywords
          if (!firstWord.startsWith('--') && 
              !['if', 'else', 'end', 'on', 'behavior', 'init', 'def', 'then'].includes(firstWord)) {
            
            try {
              const hoverInfo = await dbService.getHoverInfo(firstWord);
              if (!hoverInfo) {
                diagnostics.push({
                  range: {
                    start: { line: lineIndex, character: line.indexOf(words[0]) },
                    end: { line: lineIndex, character: line.indexOf(words[0]) + words[0].length }
                  },
                  severity: DiagnosticSeverity.Warning,
                  message: `Unknown command or keyword: '${firstWord}'`,
                  source: "hyperscript-lsp"
                });
              }
            } catch (error) {
              // Ignore database errors for diagnostics
            }
          }
        }
      }
      
      return diagnostics;
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