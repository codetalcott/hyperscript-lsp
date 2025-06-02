import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Database } from 'bun:sqlite';
import { 
  openDatabase, 
  searchElements, 
  getElementDetails,
  getAutocompletionExamples,
  findSimilarExamples
} from '../db/query';
import { parseHyperscript } from './parser';
import { 
  CompletionRequest, 
  CompletionResponse,
  HoverRequest,
  HoverResponse,
  InitializeParams, 
  InitializeResult,
  Position,
  TextDocumentIdentifier,
  TextDocumentItem,
  TextDocumentPositionParams,
  DiagnosticSeverity,
  PublishDiagnosticsParams
} from './types';

// Create the app
const app = new Hono();

// Database connection
let db: Database | null = null;

// Document store for open files
const documents: Map<string, TextDocumentItem> = new Map();

/**
 * Extract positional context from the document
 */
function getPositionContext(document: TextDocumentItem, position: Position): {
  lineText: string;
  wordAtPosition: string;
  previousWord: string;
} {
  const lines = document.text.split('\n');
  const line = lines[position.line];
  
  // Get the entire line
  const lineText = line || '';
  
  // Extract the current word being typed
  let start = position.character;
  while (start > 0 && /[\w-]/.test(line[start - 1])) {
    start--;
  }
  
  const wordAtPosition = line.substring(start, position.character);
  
  // Try to determine the previous word for context
  let wordStart = start - 1;
  let wordEnd = start - 1;
  
  // Skip whitespace backwards
  while (wordStart > 0 && /\s/.test(line[wordStart])) {
    wordStart--;
  }
  
  // Find the start of the previous word
  wordEnd = wordStart;
  while (wordStart > 0 && /[\w-]/.test(line[wordStart - 1])) {
    wordStart--;
  }
  
  const previousWord = line.substring(wordStart, wordEnd + 1);
  
  return {
    lineText,
    wordAtPosition,
    previousWord
  };
}

// Initialize endpoint
app.post('/initialize', async (c) => {
  const params = await c.req.json<InitializeParams>();
  
  // Open the database connection
  db = openDatabase();
  
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: 1, // Full document sync
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', '@', ':', ' ']
      },
      hoverProvider: true,
      documentSymbolProvider: false,
      definitionProvider: false
    }
  };
  
  return c.json(result);
});

// Document open notification
app.post('/textDocument/didOpen', async (c) => {
  const params = await c.req.json<{ textDocument: TextDocumentItem }>();
  const { textDocument } = params;
  
  // Store the document
  documents.set(textDocument.uri, textDocument);
  
  // Run diagnostics on the document
  if (db) {
    const diagnostics = validateDocument(textDocument, db);
    
    // TODO: Send diagnostics to client
    // For now, we'll just log them
    console.log(`Diagnostics for ${textDocument.uri}:`, diagnostics);
  }
  
  return c.json({ result: null });
});

// Document change notification
app.post('/textDocument/didChange', async (c) => {
  const params = await c.req.json<{
    textDocument: TextDocumentIdentifier;
    contentChanges: { text: string }[];
  }>();
  
  const { textDocument, contentChanges } = params;
  
  // Update the document
  const document = documents.get(textDocument.uri);
  if (document && contentChanges.length > 0) {
    document.text = contentChanges[contentChanges.length - 1].text;
    
    // Run diagnostics on the document
    if (db) {
      const diagnostics = validateDocument(document, db);
      
      // TODO: Send diagnostics to client
      console.log(`Diagnostics for ${textDocument.uri}:`, diagnostics);
    }
  }
  
  return c.json({ result: null });
});

// Document close notification
app.post('/textDocument/didClose', async (c) => {
  const params = await c.req.json<{ textDocument: TextDocumentIdentifier }>();
  const { textDocument } = params;
  
  // Remove the document
  documents.delete(textDocument.uri);
  
  return c.json({ result: null });
});

// Completion request
app.post('/textDocument/completion', async (c) => {
  if (!db) {
    return c.json({ items: [] });
  }
  
  const request = await c.req.json<CompletionRequest>();
  const { textDocument, position } = request;
  
  const document = documents.get(textDocument.uri);
  if (!document) {
    return c.json({ items: [] });
  }
  
  const { lineText, wordAtPosition, previousWord } = getPositionContext(document, position);
  
  // Get completions based on the current context
  const completions = getCompletions(db, wordAtPosition, previousWord, lineText);
  
  const response: CompletionResponse = {
    isIncomplete: false,
    items: completions
  };
  
  return c.json(response);
});

// Hover request
app.post('/textDocument/hover', async (c) => {
  if (!db) {
    return c.json({ contents: [] });
  }
  
  const request = await c.req.json<HoverRequest>();
  const { textDocument, position } = request;
  
  const document = documents.get(textDocument.uri);
  if (!document) {
    return c.json({ contents: [] });
  }
  
  const { lineText, wordAtPosition } = getPositionContext(document, position);
  
  // Get hover information based on the word at position
  const hoverInfo = getHoverInfo(db, wordAtPosition, lineText);
  
  const response: HoverResponse = {
    contents: hoverInfo
  };
  
  return c.json(response);
});

/**
 * Get completion items based on the current context
 */
function getCompletions(db: Database, word: string, previousWord: string, line: string): any[] {
  // TODO: Implement proper completion logic
  // For now, just return a simple example
  
  if (word.length < 2) {
    return [];
  }
  
  const results = searchElements(db, word);
  const completionItems = [];
  
  // Add command completions
  for (const command of results.commands) {
    completionItems.push({
      label: command.name,
      kind: 3, // Method
      detail: 'Command',
      documentation: command.description || '',
      insertText: command.name
    });
  }
  
  // Add feature completions
  for (const feature of results.features) {
    completionItems.push({
      label: feature.name,
      kind: 14, // Keyword
      detail: 'Feature',
      documentation: feature.description || '',
      insertText: feature.name
    });
  }
  
  // Add keyword completions
  for (const keyword of results.keywords) {
    completionItems.push({
      label: keyword.name,
      kind: 14, // Keyword
      detail: 'Keyword',
      documentation: keyword.description || '',
      insertText: keyword.name
    });
  }
  
  // Try to get examples for autocompletion
  try {
    const examples = getAutocompletionExamples(db, word, line);
    for (const example of examples) {
      completionItems.push({
        label: `Example: ${example.title}`,
        kind: 15, // Snippet
        detail: 'Code Example',
        documentation: {
          kind: 'markdown',
          value: `
### ${example.title}
${example.description || ''}

\`\`\`hyperscript
${example.raw_code}
\`\`\`

${example.html_context ? `HTML Context:\n\`\`\`html\n${example.html_context}\n\`\`\`` : ''}
          `.trim()
        },
        insertText: null, // Not directly insertable, just for reference
        preselect: false
      });
    }
  } catch (error) {
    console.error('Error getting autocompletion examples:', error);
  }
  
  return completionItems;
}

/**
 * Get hover information for a hyperscript element
 */
function getHoverInfo(db: Database, word: string, line: string): any {
  // TODO: Implement proper hover logic
  // For now, return a simple hover
  
  if (word.length < 2) {
    return [];
  }
  
  // Look for exact matches first
  const results = searchElements(db, word);
  
  // Try to find an exact match
  const commandMatch = results.commands.find(c => c.name.toLowerCase() === word.toLowerCase());
  if (commandMatch) {
    // Get full command details
    const details = getElementDetails(db, commandMatch.id, 'Command');
    
    // Try to find related examples
    let exampleMarkdown = '';
    if (details.codeExamples && details.codeExamples.length > 0) {
      exampleMarkdown = '\n\n### Example\n```hyperscript\n' +
        details.codeExamples[0].raw_code +
        '\n```';
    }
    
    return [
      {
        kind: 'markdown',
        value: `
## Command: ${details.name}

${details.description || ''}

**Syntax:** \`${details.syntax_canonical || ''}\`${exampleMarkdown}
        `.trim()
      }
    ];
  }
  
  const featureMatch = results.features.find(f => f.name.toLowerCase() === word.toLowerCase());
  if (featureMatch) {
    // Get full feature details
    const details = getElementDetails(db, featureMatch.id, 'Feature');
    
    // Try to find related examples
    let exampleMarkdown = '';
    if (details.codeExamples && details.codeExamples.length > 0) {
      exampleMarkdown = '\n\n### Example\n```hyperscript\n' +
        details.codeExamples[0].raw_code +
        '\n```';
    }
    
    return [
      {
        kind: 'markdown',
        value: `
## Feature: ${details.name}

${details.description || ''}

**Syntax:** \`${details.syntax_canonical || ''}\`${exampleMarkdown}
        `.trim()
      }
    ];
  }
  
  // Return info from the first found match if we have no exact match
  if (results.commands.length > 0) {
    const command = results.commands[0];
    return [
      {
        kind: 'markdown',
        value: `
## Command: ${command.name}

${command.description || ''}

**Syntax:** \`${command.syntax_canonical || ''}\`
        `.trim()
      }
    ];
  }
  
  if (results.features.length > 0) {
    const feature = results.features[0];
    return [
      {
        kind: 'markdown',
        value: `
## Feature: ${feature.name}

${feature.description || ''}

**Syntax:** \`${feature.syntax_canonical || ''}\`
        `.trim()
      }
    ];
  }
  
  // Try to find a similar example if no direct match
  try {
    const examples = findSimilarExamples(db, line);
    if (examples.length > 0) {
      const example = examples[0];
      return [
        {
          kind: 'markdown',
          value: `
## Example: ${example.title}

${example.description || ''}

\`\`\`hyperscript
${example.raw_code}
\`\`\`

${example.html_context ? `HTML Context:\n\`\`\`html\n${example.html_context}\n\`\`\`` : ''}
          `.trim()
        }
      ];
    }
  } catch (error) {
    console.error('Error finding similar examples:', error);
  }
  
  return [];
}

/**
 * Validate a document and return diagnostics
 */
function validateDocument(document: TextDocumentItem, db: Database): PublishDiagnosticsParams {
  // TODO: Implement proper validation
  // For now, return empty diagnostics
  
  const diagnostics = [];
  
  // Parse the document (placeholder for actual parsing)
  try {
    const parsed = parseHyperscript(document.text);
    
    // Check for detected issues from the parser
    if (parsed.issues && parsed.issues.length > 0) {
      for (const issue of parsed.issues) {
        diagnostics.push({
          range: {
            start: { line: issue.line, character: issue.character },
            end: { line: issue.line, character: issue.character + issue.length }
          },
          severity: issue.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
          message: issue.message,
          source: 'hyperscript-lsp'
        });
      }
    }
  } catch (error) {
    console.error('Error parsing document:', error);
  }
  
  return {
    uri: document.uri,
    diagnostics
  };
}

// Shutdown endpoint
app.post('/shutdown', async (c) => {
  // Close the database connection
  if (db) {
    db.close();
    db = null;
  }
  
  return c.json({ result: null });
});

// Start the server
const port = process.env.PORT || 3000;
console.log(`Starting Hyperscript LSP server on port ${port}...`);
serve({
  fetch: app.fetch,
  port: Number(port)
});