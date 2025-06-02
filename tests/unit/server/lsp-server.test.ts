import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import type { LSPServer } from "./lsp-server";

describe("LSP Server", () => {
  let server: LSPServer;
  
  beforeAll(() => {
    // We'll initialize the server here
  });
  
  afterAll(() => {
    // Clean up
  });
  
  describe("Server Initialization", () => {
    test("should create a Hono app instance", () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      expect(server).toBeDefined();
      expect(server.app).toBeInstanceOf(Hono);
    });
    
    test("should have default port configuration", () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      expect(server.port).toBe(3000);
    });
    
    test("should accept custom port configuration", () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer({ port: 4000 });
      expect(server.port).toBe(4000);
    });
  });
  
  describe("LSP Protocol", () => {
    test("should handle Content-Length header properly", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          processId: 1234,
          capabilities: {}
        }
      });
      
      const response = await server.app.request("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/vscode-jsonrpc; charset=utf-8",
          "Content-Length": message.length.toString()
        },
        body: message
      });
      
      expect(response.status).toBe(200);
    });
    
    test("should parse LSP messages correctly", () => {
      const { parseLSPMessage } = require("./lsp-server");
      
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {}
      });
      
      const rawMessage = `Content-Length: ${message.length}\r\n\r\n${message}`;
      const parsed = parseLSPMessage(rawMessage);
      
      expect(parsed).toBeDefined();
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.method).toBe("initialize");
    });
  });
  
  describe("Initialize Request", () => {
    test("should respond to initialize request", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          processId: 1234,
          rootUri: "file:///test",
          capabilities: {},
          trace: "off"
        }
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/vscode-jsonrpc; charset=utf-8"
        },
        body: JSON.stringify(initRequest)
      });
      
      const result = await response.json();
      
      expect(result.id).toBe(1);
      expect(result.result).toBeDefined();
      expect(result.result.capabilities).toBeDefined();
    });
    
    test("should advertise server capabilities", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          processId: 1234,
          capabilities: {}
        }
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        body: JSON.stringify(initRequest)
      });
      
      const result = await response.json();
      const capabilities = result.result.capabilities;
      
      // Test that we advertise basic capabilities
      expect(capabilities.textDocumentSync).toBeDefined();
      expect(capabilities.hoverProvider).toBe(true);
      expect(capabilities.completionProvider).toBeDefined();
    });
  });
  
  describe("Error Handling", () => {
    test("should handle invalid JSON-RPC requests", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const response = await server.app.request("/", {
        method: "POST",
        body: "invalid json"
      });
      
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32700); // Parse error
    });
    
    test("should handle unknown methods", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "unknown/method",
        params: {}
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        body: JSON.stringify(request)
      });
      
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32601); // Method not found
    });
  });
  
  describe("Shutdown and Exit", () => {
    test("should handle shutdown request", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const shutdownRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "shutdown",
        params: null
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        body: JSON.stringify(shutdownRequest)
      });
      
      const result = await response.json();
      
      expect(result.id).toBe(2);
      expect(result.result).toBeNull();
    });
    
    test("should handle exit notification", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const exitNotification = {
        jsonrpc: "2.0",
        method: "exit",
        params: null
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        body: JSON.stringify(exitNotification)
      });
      
      expect(response.status).toBe(200);
    });
    
    test("should handle initialized notification", async () => {
      const { createLSPServer } = require("./lsp-server");
      const server = createLSPServer();
      
      const initializedNotification = {
        jsonrpc: "2.0",
        method: "initialized",
        params: {}
      };
      
      const response = await server.app.request("/", {
        method: "POST",
        body: JSON.stringify(initializedNotification)
      });
      
      expect(response.status).toBe(200);
    });
  });
});