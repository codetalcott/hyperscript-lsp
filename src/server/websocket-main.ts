import { createWebSocketLSPServer } from "./lsp-websocket";

// Get port from environment or use default
const port = parseInt(process.env.PORT || "3001", 10);

// Create and start the server
const server = createWebSocketLSPServer({ port });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down WebSocket LSP server...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down WebSocket LSP server...");
  server.stop();
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  console.error("Failed to start WebSocket LSP server:", error);
  process.exit(1);
});

console.log(`
🚀 Hyperscript LSP Server (WebSocket)
=====================================
WebSocket URL: ws://localhost:${port}
Health Check: http://localhost:${port}/health

The server is ready to accept WebSocket LSP connections.
Use this server with editors that support LSP over WebSocket.
`);