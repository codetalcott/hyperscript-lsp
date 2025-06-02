import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import type { WebSocketLSPServer } from "./lsp-websocket";

describe("WebSocket LSP Server", () => {
  let server: WebSocketLSPServer;
  
  afterAll(() => {
    if (server) {
      server.stop();
    }
  });
  
  test("should create WebSocket server", () => {
    const { createWebSocketLSPServer } = require("./lsp-websocket");
    server = createWebSocketLSPServer({ port: 3001 });
    expect(server).toBeDefined();
    expect(server.port).toBe(3001);
  });
  
  test("should handle WebSocket connections", async () => {
    const { createWebSocketLSPServer } = require("./lsp-websocket");
    const testServer = createWebSocketLSPServer({ port: 3002 });
    await testServer.start();
    
    // Create a WebSocket client
    const ws = new WebSocket("ws://localhost:3002");
    
    await new Promise((resolve) => {
      ws.onopen = () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        testServer.stop();
        resolve(undefined);
      };
    });
  });
  
  test("should handle LSP messages over WebSocket", async () => {
    const { createWebSocketLSPServer } = require("./lsp-websocket");
    const testServer = createWebSocketLSPServer({ port: 3003 });
    await testServer.start();
    
    const ws = new WebSocket("ws://localhost:3003");
    
    await new Promise((resolve) => {
      ws.onopen = () => {
        // Send initialize request
        const initRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            processId: 1234,
            capabilities: {}
          }
        };
        
        ws.send(JSON.stringify(initRequest));
      };
      
      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        expect(response.id).toBe(1);
        expect(response.result).toBeDefined();
        expect(response.result.capabilities).toBeDefined();
        ws.close();
        testServer.stop();
        resolve(undefined);
      };
    });
  });
});