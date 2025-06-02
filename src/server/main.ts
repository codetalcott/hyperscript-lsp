import { createLSPServer } from "./lsp-server";

// Get port from environment or use default
const port = parseInt(process.env.PORT || "3000", 10);

// Create and start the server
const server = createLSPServer({ port });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down LSP server...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down LSP server...");
  server.stop();
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  console.error("Failed to start LSP server:", error);
  process.exit(1);
});

console.log(`
🚀 Hyperscript LSP Server
========================
Port: ${port}
Health Check: http://localhost:${port}/health

The server is ready to accept LSP connections.
Use this server with your editor's LSP client configuration.
`);