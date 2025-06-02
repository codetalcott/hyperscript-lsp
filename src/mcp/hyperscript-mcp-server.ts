#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createDatabaseService } from "../server/database-service.js";
import { createLSPHandlers } from "../server/lsp-handlers.js";

// Initialize services
const dbService = createDatabaseService();
const lspHandlers = createLSPHandlers(dbService);

// Create MCP server
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

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_hyperscript",
      description: "Analyze hyperscript code and provide diagnostics",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Hyperscript code to analyze" },
        },
        required: ["code"],
      },
    },
    {
      name: "get_completion",
      description: "Get code completion suggestions for hyperscript",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Current code context" },
          line: { type: "number", description: "Current line number" },
          character: { type: "number", description: "Current character position" },
        },
        required: ["code", "line", "character"],
      },
    },
    {
      name: "get_hover_info",
      description: "Get hover documentation for a hyperscript element",
      inputSchema: {
        type: "object",
        properties: {
          element: { type: "string", description: "Element name to get info for" },
        },
        required: ["element"],
      },
    },
    {
      name: "search_language_elements",
      description: "Search for hyperscript language elements (commands, keywords, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: { 
            type: "string", 
            enum: ["command", "keyword", "expression", "feature", "symbol", "all"],
            description: "Type of element to search for" 
          },
        },
        required: ["query"],
      },
    },
    {
      name: "generate_hyperscript",
      description: "Generate hyperscript code for common patterns",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { 
            type: "string",
            enum: ["event-handler", "fetch-request", "animation", "form-validation", "todo-item"],
            description: "Pattern to generate" 
          },
          options: { type: "object", description: "Pattern-specific options" },
        },
        required: ["pattern"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "analyze_hyperscript": {
      const uri = "temp://analyze.hs";
      lspHandlers.setTextContent(uri, args.code);
      const diagnostics = await lspHandlers.handleDiagnostics(uri);
      
      return {
        content: [
          {
            type: "text",
            text: diagnostics.length === 0 
              ? "✓ No syntax errors found" 
              : `Found ${diagnostics.length} issue(s):\n${diagnostics.map(d => 
                  `- Line ${d.range.start.line + 1}: ${d.message} (${d.severity === 1 ? 'error' : 'warning'})`
                ).join('\n')}`,
          },
        ],
      };
    }

    case "get_completion": {
      const uri = "temp://complete.hs";
      lspHandlers.setTextContent(uri, args.code);
      
      const completions = await lspHandlers.handleCompletion({
        textDocument: { uri },
        position: { line: args.line, character: args.character },
        context: { triggerKind: 1 }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${completions.length} completion(s):\n${completions.slice(0, 10).map(c => 
              `- ${c.label}: ${c.detail || 'No description'}`
            ).join('\n')}`,
          },
        ],
      };
    }

    case "get_hover_info": {
      const info = await dbService.getHoverInfo(args.element);
      
      if (!info) {
        return {
          content: [{ type: "text", text: `No information found for '${args.element}'` }],
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `**${info.name}** (${info.type})\n\n${info.description}\n\n` +
                  (info.syntax ? `Syntax: \`${info.syntax}\`\n\n` : '') +
                  (info.examples?.length ? `Examples:\n${info.examples.map(e => 
                    `\`\`\`hyperscript\n${e.code}\n\`\`\``
                  ).join('\n\n')}` : ''),
          },
        ],
      };
    }

    case "search_language_elements": {
      const results = await dbService.getCompletionItems(args.query, args.type || 'all');
      
      const formatResults = (items: any[], type: string) => 
        items.length > 0 ? `\n**${type}:**\n${items.slice(0, 5).map(i => 
          `- ${i.name}: ${i.description?.split('\n')[0] || 'No description'}`
        ).join('\n')}` : '';
      
      let text = `Search results for "${args.query}":`;
      
      if (args.type === 'all' && typeof results === 'object') {
        text += formatResults(results.commands || [], 'Commands');
        text += formatResults(results.keywords || [], 'Keywords');
        text += formatResults(results.expressions || [], 'Expressions');
        text += formatResults(results.features || [], 'Features');
        text += formatResults(results.specialSymbols || [], 'Special Symbols');
      } else if (Array.isArray(results)) {
        text += formatResults(results, args.type || 'Results');
      }
      
      return {
        content: [{ type: "text", text }],
      };
    }

    case "generate_hyperscript": {
      const patterns: Record<string, string> = {
        "event-handler": `on click
  toggle .active on me
end`,
        "fetch-request": `on click
  fetch /api/data
    then if it.ok
      put it.json() into me
    else
      put "Error loading data" into me
    end
end`,
        "animation": `behavior FadeIn
  init
    set my opacity to 0
    then transition my opacity to 1 over 500ms
  end
end`,
        "form-validation": `on submit
  prevent default
  if #email.value is empty
    add .error to #email
    put "Email is required" into #email-error
  else
    remove .error from #email
    put "" into #email-error
  end
end`,
        "todo-item": `on click from .add-btn
  get value of #input
  make <li class="todo-item"/> called item
  put it into item
  put item at end of #todo-list
  set value of #input to ""
end`
      };
      
      const code = patterns[args.pattern] || "// Pattern not found";
      
      return {
        content: [
          {
            type: "text",
            text: `Generated ${args.pattern} pattern:\n\n\`\`\`hyperscript\n${code}\n\`\`\``,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hyperscript MCP server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});