import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDatabaseService, type DatabaseService } from "./database-service";
import { createLSPHandlers, type LSPHandlers } from "./lsp-handlers";

// LSP Types
interface LSPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: LSPError;
}

interface LSPError {
  code: number;
  message: string;
  data?: any;
}

// LSP Error Codes
const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

// Server capabilities
const SERVER_CAPABILITIES = {
  textDocumentSync: 1, // Full sync
  hoverProvider: true,
  completionProvider: {
    triggerCharacters: [".", " ", "(", "[", "{", ":", "="],
    resolveProvider: false
  },
  definitionProvider: false,
  referencesProvider: false,
  documentFormattingProvider: false,
  documentSymbolProvider: false,
  workspaceSymbolProvider: false
};

export interface LSPServerConfig {
  port?: number;
  databasePath?: string;
}

export interface LSPServer {
  app: Hono;
  port: number;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Parse LSP message from raw input
 */
export function parseLSPMessage(raw: string): LSPMessage | null {
  try {
    // LSP messages have format: Content-Length: <length>\r\n\r\n<json>
    const contentLengthMatch = raw.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) {
      // Try to parse as raw JSON (for simpler testing)
      return JSON.parse(raw);
    }
    
    const contentLength = parseInt(contentLengthMatch[1]!);
    const messageStart = raw.indexOf("\r\n\r\n") + 4;
    const messageContent = raw.substring(messageStart, messageStart + contentLength);
    
    return JSON.parse(messageContent);
  } catch (error) {
    return null;
  }
}

/**
 * Format LSP response
 */
function formatLSPResponse(message: LSPMessage): string {
  const content = JSON.stringify(message);
  return `Content-Length: ${content.length}\r\n\r\n${content}`;
}

/**
 * Create error response
 */
function createErrorResponse(id: number | string | undefined, code: number, message: string): LSPMessage {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

/**
 * Handle initialize request
 */
function handleInitialize(params: any): any {
  return {
    capabilities: SERVER_CAPABILITIES,
    serverInfo: {
      name: "hyperscript-lsp",
      version: "0.1.0"
    }
  };
}

/**
 * Create LSP server
 */
export function createLSPServer(config: LSPServerConfig = {}): LSPServer {
  const app = new Hono();
  const port = config.port || 3000;
  
  // Initialize database service and handlers
  const dbService = createDatabaseService({ path: config.databasePath });
  const handlers = createLSPHandlers(dbService);
  
  // Middleware
  app.use("*", cors());
  app.use("*", logger());
  
  // Main LSP endpoint
  app.post("/", async (c) => {
    try {
      // Get raw body
      const rawBody = await c.req.text();
      
      // Parse LSP message
      const message = parseLSPMessage(rawBody);
      
      if (!message) {
        return c.json(createErrorResponse(undefined, ErrorCodes.ParseError, "Invalid JSON-RPC"));
      }
      
      // Handle different methods
      if (message.method) {
        switch (message.method) {
          case "initialize":
            return c.json({
              jsonrpc: "2.0",
              id: message.id,
              result: handleInitialize(message.params)
            });
            
          case "initialized":
            // Client notification that initialization is complete
            return c.json({ jsonrpc: "2.0" });
            
          case "shutdown":
            return c.json({
              jsonrpc: "2.0",
              id: message.id,
              result: null
            });
            
          case "exit":
            // Clean shutdown
            return c.json({ jsonrpc: "2.0" });
            
          // Text document sync
          case "textDocument/didOpen":
            handlers.handleDidOpen(message.params);
            return c.json({ jsonrpc: "2.0" });
            
          case "textDocument/didChange":
            handlers.handleDidChange(message.params);
            return c.json({ jsonrpc: "2.0" });
            
          case "textDocument/didClose":
            handlers.handleDidClose(message.params);
            return c.json({ jsonrpc: "2.0" });
            
          // Language features
          case "textDocument/completion":
            const completions = await handlers.handleCompletion(message.params);
            return c.json({
              jsonrpc: "2.0",
              id: message.id,
              result: completions
            });
            
          case "textDocument/hover":
            const hover = await handlers.handleHover(message.params);
            return c.json({
              jsonrpc: "2.0",
              id: message.id,
              result: hover
            });
            
          default:
            return c.json(createErrorResponse(
              message.id,
              ErrorCodes.MethodNotFound,
              `Method '${message.method}' not found`
            ));
        }
      }
      
      return c.json(createErrorResponse(
        message.id,
        ErrorCodes.InvalidRequest,
        "Invalid request"
      ));
      
    } catch (error) {
      console.error("Error handling request:", error);
      return c.json(createErrorResponse(
        undefined,
        ErrorCodes.InternalError,
        "Internal server error"
      ));
    }
  });
  
  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", server: "hyperscript-lsp" });
  });
  
  let server: any;
  
  return {
    app,
    port,
    start: async () => {
      server = Bun.serve({
        port,
        fetch: app.fetch,
      });
      console.log(`LSP server running on port ${port}`);
    },
    stop: () => {
      if (server) {
        server.stop();
        console.log("LSP server stopped");
      }
      dbService.close();
    }
  };
}

// Export for testing
export type { LSPMessage, LSPError };
export { ErrorCodes };