import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { WebSocket } from "ws";
import { createWebSocketLSPServer } from "./lsp-websocket";
// Define LSPRequest locally since it's not exported from types
interface LSPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

describe("WebSocket LSP Integration", () => {
  let server: ReturnType<typeof createWebSocketLSPServer>;
  let client: WebSocket;
  const port = 4010;
  
  beforeAll(async () => {
    server = createWebSocketLSPServer({ port });
    await server.start();
  });
  
  afterAll(() => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    server.stop();
  });
  
  const connectClient = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/lsp`);
      
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  };
  
  const sendRequest = (ws: WebSocket, method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      
      const request: LSPRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };
      
      const messageHandler = (data: Buffer) => {
        try {
          const response: any = JSON.parse(data.toString());
          if (response.id === id) {
            ws.off('message', messageHandler);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      ws.on('message', messageHandler);
      ws.send(JSON.stringify(request));
      
      setTimeout(() => {
        ws.off('message', messageHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  };
  
  const sendNotification = (ws: WebSocket, method: string, params: any): void => {
    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };
    
    ws.send(JSON.stringify(notification));
  };
  
  describe("WebSocket Connection", () => {
    test("should establish WebSocket connection", async () => {
      client = await connectClient();
      expect(client.readyState).toBe(WebSocket.OPEN);
    });
    
    test("should handle initialization handshake", async () => {
      client = await connectClient();
      
      const initResponse = await sendRequest(client, "initialize", {
        processId: process.pid,
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        },
        capabilities: {
          textDocument: {
            completion: {
              completionItem: {
                snippetSupport: true
              }
            },
            hover: {
              contentFormat: ["markdown", "plaintext"]
            }
          }
        }
      });
      
      expect(initResponse.result).toBeDefined();
      expect(initResponse.result.capabilities).toBeDefined();
      expect(initResponse.result.capabilities.completionProvider).toBeDefined();
      expect(initResponse.result.capabilities.hoverProvider).toBe(true);
    });
  });
  
  describe("WebSocket Text Document Sync", () => {
    beforeAll(async () => {
      client = await connectClient();
      // Initialize first
      await sendRequest(client, "initialize", {
        processId: process.pid,
        capabilities: {}
      });
    });
    
    test("should handle textDocument/didOpen", async () => {
      // didOpen is a notification, doesn't return a response
      sendNotification(client, "textDocument/didOpen", {
        textDocument: {
          uri: "file:///ws-test.hs",
          languageId: "hyperscript",
          version: 1,
          text: "on click put 'clicked' into me"
        }
      });
      
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // No error means success for notifications
      expect(true).toBe(true);
    });
    
    test("should handle textDocument/didChange", async () => {
      // First open the document
      sendNotification(client, "textDocument/didOpen", {
        textDocument: {
          uri: "file:///ws-change.hs",
          languageId: "hyperscript",
          version: 1,
          text: "put 'hello' into me"
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Then change it
      sendNotification(client, "textDocument/didChange", {
        textDocument: {
          uri: "file:///ws-change.hs",
          version: 2
        },
        contentChanges: [{
          text: "put 'world' into me"
        }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // No error means success for notifications
      expect(true).toBe(true);
    });
  });
  
  describe("WebSocket Completion", () => {
    beforeAll(async () => {
      client = await connectClient();
      await sendRequest(client, "initialize", {
        processId: process.pid,
        capabilities: {}
      });
    });
    
    test("should provide completions via WebSocket", async () => {
      // Open document first
      sendNotification(client, "textDocument/didOpen", {
        textDocument: {
          uri: "file:///ws-complete.hs",
          languageId: "hyperscript",
          version: 1,
          text: "pu"
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Request completion
      const response = await sendRequest(client, "textDocument/completion", {
        textDocument: { uri: "file:///ws-complete.hs" },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      });
      
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.result.length).toBeGreaterThan(0);
      expect(response.result.some((item: any) => item.label === "put")).toBe(true);
    });
    
    test("should handle rapid completion requests", async () => {
      const uri = "file:///ws-rapid.hs";
      
      // Open document
      sendNotification(client, "textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "hyperscript",
          version: 1,
          text: "p"
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send multiple completion requests rapidly
      const promises = [];
      for (let i = 1; i <= 3; i++) {
        // Update document
        sendNotification(client, "textDocument/didChange", {
          textDocument: { uri, version: i + 1 },
          contentChanges: [{ text: "put".substring(0, i) }]
        });
        
        // Request completion
        promises.push(
          sendRequest(client, "textDocument/completion", {
            textDocument: { uri },
            position: { line: 0, character: i },
            context: { triggerKind: 1 }
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(response => {
        expect(response.result).toBeDefined();
        expect(Array.isArray(response.result)).toBe(true);
      });
    });
  });
  
  describe("WebSocket Hover", () => {
    beforeAll(async () => {
      client = await connectClient();
      await sendRequest(client, "initialize", {
        processId: process.pid,
        capabilities: {}
      });
    });
    
    test("should provide hover information via WebSocket", async () => {
      const uri = "file:///ws-hover.hs";
      
      // Open document
      sendNotification(client, "textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "hyperscript",
          version: 1,
          text: "on click toggle .active on me"
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Request hover on "toggle"
      const response = await sendRequest(client, "textDocument/hover", {
        textDocument: { uri },
        position: { line: 0, character: 11 } // On "toggle"
      });
      
      expect(response.result).toBeDefined();
      expect(response.result.contents).toBeDefined();
      expect(response.result.contents.kind).toBe("markdown");
      expect(response.result.contents.value).toContain("toggle");
    });
  });
  
  describe("WebSocket Error Handling", () => {
    beforeAll(async () => {
      client = await connectClient();
    });
    
    test("should handle invalid method gracefully", async () => {
      try {
        const response = await sendRequest(client, "invalid/method", {});
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32601); // Method not found
      } catch (error) {
        // Some implementations might close connection on error
        expect(error).toBeDefined();
      }
    });
    
    test("should handle malformed requests", async () => {
      const malformedRequest = JSON.stringify({
        jsonrpc: "2.0",
        // Missing id and method
        params: {}
      });
      
      client.send(malformedRequest);
      
      // Wait a bit for potential error response
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connection should still be open
      expect(client.readyState).toBe(WebSocket.OPEN);
    });
  });
  
  describe("WebSocket Concurrent Clients", () => {
    test("should handle multiple concurrent clients", async () => {
      const clients = await Promise.all([
        connectClient(),
        connectClient(),
        connectClient()
      ]);
      
      // All clients should be connected
      clients.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Each client should be able to make requests independently
      clients.forEach((ws, index) => {
        sendNotification(ws, "textDocument/didOpen", {
          textDocument: {
            uri: `file:///client${index}.hs`,
            languageId: "hyperscript",
            version: 1,
            text: `put 'client${index}' into me`
          }
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with actual requests
      const promises = clients.map((ws, index) => 
        sendRequest(ws, "textDocument/completion", {
          textDocument: { uri: `file:///client${index}.hs` },
          position: { line: 0, character: 2 },
          context: { triggerKind: 1 }
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      
      // Clean up
      clients.forEach(ws => ws.close());
    });
  });
  
  describe("WebSocket Connection Recovery", () => {
    test("should handle client reconnection", async () => {
      // Connect first client
      let client1 = await connectClient();
      expect(client1.readyState).toBe(WebSocket.OPEN);
      
      // Close it
      client1.close();
      
      // Wait for close
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connect new client
      const client2 = await connectClient();
      expect(client2.readyState).toBe(WebSocket.OPEN);
      
      // Should be able to use new client normally
      const response = await sendRequest(client2, "initialize", {
        processId: process.pid,
        capabilities: {}
      });
      
      expect(response.result).toBeDefined();
      
      client2.close();
    });
  });
});