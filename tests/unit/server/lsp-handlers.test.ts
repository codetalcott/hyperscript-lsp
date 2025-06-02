import { describe, expect, test, beforeAll } from "bun:test";
import type { DatabaseService } from "./database-service";
import type { LSPHandlers } from "./lsp-handlers";

describe("LSP Handlers", () => {
  let handlers: LSPHandlers;
  let mockDbService: DatabaseService;
  
  beforeAll(() => {
    // Create mock database service
    mockDbService = {
      isReady: () => true,
      close: () => {},
      getCompletionItems: async (prefix: string, type?: string) => {
        if (type === "command") {
          return [
            { id: "1", name: "put", description: "Puts content into element" },
            { id: "2", name: "publish", description: "Publishes an event" }
          ];
        }
        if (type === "all") {
          const commands = [
            { id: "1", name: "put", description: "Puts content into element" },
            { id: "2", name: "publish", description: "Publishes an event" }
          ].filter(cmd => cmd.name.startsWith(prefix));
          
          return {
            commands,
            keywords: [],
            expressions: [],
            features: [],
            specialSymbols: []
          };
        }
        return [];
      },
      getHoverInfo: async (name: string) => {
        if (name === "put") {
          return {
            name: "put",
            type: "command",
            description: "Puts content into an element",
            syntax: "put <expression> into <target>",
            examples: [
              { title: "Basic put", code: 'put "Hello" into me' }
            ]
          };
        }
        return null;
      },
      findDefinition: async (name: string) => {
        if (name === "put") {
          return {
            type: "command",
            element: { id: "1", name: "put", description: "Puts content" }
          };
        }
        return null;
      }
    };
    
    const { createLSPHandlers } = require("./lsp-handlers");
    handlers = createLSPHandlers(mockDbService);
  });
  
  describe("Completion Handler", () => {
    test("should handle textDocument/completion request", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 },
        context: {
          triggerKind: 1, // Invoked
          triggerCharacter: undefined
        }
      };
      
      // Set text content to trigger completion
      handlers.setTextContent("file:///test.hs", "pu");
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
    
    test("should return completion items with proper format", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      // Mock text content
      handlers.setTextContent("file:///test.hs", "pu");
      
      const result = await handlers.handleCompletion(params);
      
      expect(result.length).toBe(2); // put and publish
      expect(result[0]).toHaveProperty("label");
      expect(result[0]).toHaveProperty("kind");
      expect(result[0]).toHaveProperty("detail");
    });
    
    test("should filter completions based on current text", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "pub");
      
      const result = await handlers.handleCompletion(params);
      
      // Should only return "publish" not "put"
      expect(result.length).toBe(1);
      expect(result[0]?.label).toBe("publish");
    });
  });
  
  describe("Hover Handler", () => {
    test("should handle textDocument/hover request", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result?.contents).toBeDefined();
    });
    
    test("should return hover info with markdown content", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      expect(result!.contents.kind).toBe("markdown");
      expect(result!.contents.value).toContain("put");
      expect(result!.contents.value).toContain("command");
      expect(result!.contents.value).toContain("Puts content into an element");
    });
    
    test("should return null for unknown words", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "unknown command");
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeNull();
    });
  });
  
  describe("Text Document Sync", () => {
    test("should handle textDocument/didOpen", () => {
      const params = {
        textDocument: {
          uri: "file:///new.hs",
          languageId: "hyperscript",
          version: 1,
          text: "on click put 'clicked' into me"
        }
      };
      
      handlers.handleDidOpen(params);
      
      // Verify text was stored
      const content = handlers.getTextContent("file:///new.hs");
      expect(content).toBe("on click put 'clicked' into me");
    });
    
    test("should handle textDocument/didChange", () => {
      const params = {
        textDocument: {
          uri: "file:///test.hs",
          version: 2
        },
        contentChanges: [
          {
            text: "on click toggle .active"
          }
        ]
      };
      
      handlers.handleDidChange(params);
      
      const content = handlers.getTextContent("file:///test.hs");
      expect(content).toBe("on click toggle .active");
    });
    
    test("should handle textDocument/didClose", () => {
      handlers.setTextContent("file:///closing.hs", "some content");
      
      const params = {
        textDocument: {
          uri: "file:///closing.hs"
        }
      };
      
      handlers.handleDidClose(params);
      
      const content = handlers.getTextContent("file:///closing.hs");
      expect(content).toBeUndefined();
    });
  });
});