import { createLSPServer, parseLSPMessage, ErrorCodes, type LSPMessage } from "./lsp-server";
import { createLSPHandlers } from "./lsp-handlers";
import { createDatabaseService } from "./database-service";

export interface WebSocketLSPServerConfig {
  port?: number;
}

export interface WebSocketLSPServer {
  port: number;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Create LSP server with WebSocket support
 */
export function createWebSocketLSPServer(config: WebSocketLSPServerConfig = {}): WebSocketLSPServer {
  const port = config.port || 3001;
  let server: any;
  
  // Create database service and LSP handlers
  const dbService = createDatabaseService();
  const lspHandlers = createLSPHandlers(dbService);
  
  // Create base LSP server for handling requests
  const lspServer = createLSPServer({ port });
  
  return {
    port,
    start: async () => {
      server = Bun.serve({
        port,
        
        // Regular HTTP requests
        fetch(req, server) {
          // Check if this is a WebSocket upgrade request
          if (req.headers.get("upgrade") === "websocket") {
            const success = server.upgrade(req);
            if (success) {
              return undefined;
            }
          }
          
          // Otherwise, handle as regular HTTP (health check, etc.)
          return lspServer.app.fetch(req);
        },
        
        // WebSocket handlers
        websocket: {
          async message(ws, message) {
            try {
              // Parse the incoming message
              const lspMessage = typeof message === "string" 
                ? JSON.parse(message) 
                : parseLSPMessage(message.toString());
              
              if (!lspMessage) {
                ws.send(JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: ErrorCodes.ParseError,
                    message: "Invalid JSON-RPC"
                  }
                }));
                return;
              }
              
              // Handle the LSP message
              await handleLSPMessage(lspMessage, ws, lspHandlers);
              
            } catch (error) {
              console.error("WebSocket message error:", error);
              ws.send(JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: ErrorCodes.InternalError,
                  message: "Internal server error"
                }
              }));
            }
          },
          
          open(ws) {
            console.log("WebSocket client connected");
          },
          
          close(ws, code, message) {
            console.log(`WebSocket client disconnected: ${code} ${message}`);
          }
        }
      });
      
      console.log(`WebSocket LSP server running on port ${port}`);
    },
    
    stop: () => {
      if (server) {
        server.stop();
        dbService.close();
        console.log("WebSocket LSP server stopped");
      }
    }
  };
}

/**
 * Handle LSP message and send response via WebSocket
 */
async function handleLSPMessage(message: LSPMessage, ws: any, handlers: any) {
  let response: LSPMessage;
  
  switch (message.method) {
    case "initialize":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          capabilities: {
            textDocumentSync: 1,
            hoverProvider: true,
            completionProvider: {
              triggerCharacters: [".", " ", "(", "[", "{", ":", "="],
              resolveProvider: false
            }
          },
          serverInfo: {
            name: "hyperscript-lsp",
            version: "0.1.0"
          }
        }
      };
      break;
      
    case "initialized":
      // No response needed for notification
      return;
      
    case "shutdown":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: null
      };
      break;
      
    case "exit":
      ws.close();
      return;
      
    case "textDocument/completion":
      try {
        const result = await handlers.handleCompletion(message.params);
        response = {
          jsonrpc: "2.0",
          id: message.id,
          result
        };
      } catch (error) {
        response = {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: ErrorCodes.InternalError,
            message: `Error handling completion: ${error}`
          }
        };
      }
      break;
      
    case "textDocument/hover":
      try {
        const result = await handlers.handleHover(message.params);
        response = {
          jsonrpc: "2.0",
          id: message.id,
          result
        };
      } catch (error) {
        response = {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: ErrorCodes.InternalError,
            message: `Error handling hover: ${error}`
          }
        };
      }
      break;
      
    case "textDocument/didOpen":
      handlers.handleDidOpen(message.params);
      return; // No response for notifications
      
    case "textDocument/didChange":
      handlers.handleDidChange(message.params);
      return; // No response for notifications
      
    case "textDocument/didClose":
      handlers.handleDidClose(message.params);
      return; // No response for notifications
      
    default:
      response = {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: ErrorCodes.MethodNotFound,
          message: `Method '${message.method}' not found`
        }
      };
  }
  
  ws.send(JSON.stringify(response));
}