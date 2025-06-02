#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  analyzeTool,
  completionTool,
  hoverTool,
  searchTool,
  generateTool
} from './tools/index.js';

// Create the MCP server
const server = new Server(
  {
    name: "hyperscript-lsp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool registry
const tools = [
  analyzeTool,
  completionTool,
  hoverTool,
  searchTool,
  generateTool
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }
    return await tool.execute(args as any);
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      }]
    };
  }
});

// Start the HTTP server
async function main() {
  const port = process.env.PORT || 3000;
  const hostname = process.env.HOSTNAME || 'localhost';
  
  // Create HTTP server to get ServerResponse
  const http = require('http');
  const server_http = http.createServer((req: any, res: any) => {
    if (req.url === '/sse') {
      const transport = new SSEServerTransport(`/sse`, res);
      server.connect(transport);
    }
  });
  
  server_http.listen(port, hostname);
  
  console.log(`Hyperscript MCP server running at http://${hostname}:${port}`);
  console.log(`Remote URL: ${process.env.PUBLIC_URL || `http://${hostname}:${port}`}`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});