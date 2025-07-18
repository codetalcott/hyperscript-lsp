import { describe, expect, test } from "bun:test";
import { createLSPServer } from "../../../src/server/lsp-server";
import { createWebSocketLSPServer } from "../../../src/server/lsp-websocket";

describe("Server Integration", () => {
  test("HTTP server starts and responds to health check", async () => {
    const server = createLSPServer({ port: 4000 });
    await server.start();
    
    try {
      const response = await fetch("http://localhost:4000/health");
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.server).toBe("hyperscript-lsp");
    } finally {
      server.stop();
    }
  });
  
  test("WebSocket server starts and responds to health check", async () => {
    const server = createWebSocketLSPServer({ port: 4001 });
    await server.start();
    
    try {
      const response = await fetch("http://localhost:4001/health");
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.server).toBe("hyperscript-lsp");
    } finally {
      server.stop();
    }
  });
});