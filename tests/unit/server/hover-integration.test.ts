import { describe, test, expect, beforeAll } from "bun:test";
import { createLSPHandlers } from "../../../src/server/lsp-handlers";
import { createDatabaseService } from "../../../src/server/database-service";
import * as path from "node:path";

describe("Hover Integration Tests", () => {
  let handlers: any;
  let dbService: any;

  beforeAll(() => {
    // Use real database for integration testing
    const dbPath = path.join(import.meta.dir, "../hyperscript.db");
    dbService = createDatabaseService({ 
      path: dbPath,
      cacheEnabled: true
    });
    handlers = createLSPHandlers(dbService);
  });

  describe("Command Hover", () => {
    test("should show hover info for commands", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      expect(result?.contents).toBeDefined();
      expect(result?.contents.kind).toBe("markdown");
      expect(result?.contents.value).toContain("put");
    });

    test("should include syntax information", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "toggle .active");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toMatch(/\*\*Syntax:\*\*/);
        expect(result.contents.value).toContain("```hyperscript");
      }
    });

    test("should include description and examples", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 }
      };
      
      handlers.setTextContent("file:///test.hs", "add .class to #element");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        // Should contain the command name and type
        expect(result.contents.value).toMatch(/\*\*\w+\*\*.*_\(\w+\)_/);
        
        // Should contain description or examples section
        const hasDescription = result.contents.value.includes("**Syntax:**") ||
                             result.contents.value.includes("**Examples:**");
        expect(hasDescription).toBe(true);
      }
    });
  });

  describe("Keyword Hover", () => {
    test("should show hover info for keywords", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 13 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("into");
        expect(result.contents.kind).toBe("markdown");
      }
    });

    test("should distinguish between similar keywords", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 8 }
      };
      
      handlers.setTextContent("file:///test.hs", "wait for click");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("for");
        expect(result.contents.kind).toBe("markdown");
      }
    });
  });

  describe("Feature Hover", () => {
    test("should show hover info for features", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "on click\n  toggle .active\nend");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("on");
        expect(result.contents.kind).toBe("markdown");
      }
    });

    test("should handle behavior definitions", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 }
      };
      
      handlers.setTextContent("file:///test.hs", "behavior MyBehavior");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("behavior");
        expect(result.contents.kind).toBe("markdown");
      }
    });
  });

  describe("Special Symbol Hover", () => {
    test("should show hover info for special symbols", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 18 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'hello' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("me");
        expect(result.contents.kind).toBe("markdown");
      }
    });

    test("should handle it symbol", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 4 }
      };
      
      handlers.setTextContent("file:///test.hs", "put it into #output");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("it");
        expect(result.contents.kind).toBe("markdown");
      }
    });
  });

  describe("Expression Hover", () => {
    test("should show hover info for expressions", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 10 }
      };
      
      handlers.setTextContent("file:///test.hs", "if the window's scrollTop > 100");
      
      const result = await handlers.handleHover(params);
      
      // This might find "window" or "scrollTop" depending on position
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.kind).toBe("markdown");
      }
    });
  });

  describe("Multiline Document Hover", () => {
    test("should handle hover in multiline documents", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 1, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "on click\n  toggle .active\nend");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("toggle");
        expect(result.contents.kind).toBe("markdown");
      }
    });

    test("should handle indented content", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 2, character: 6 }
      };
      
      handlers.setTextContent("file:///test.hs", "on click\n  if true\n    add .class\n  end\nend");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("add");
        expect(result.contents.kind).toBe("markdown");
      }
    });
  });

  describe("Markdown Formatting", () => {
    test("should format hover content with proper markdown", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'test' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        const content = result.contents.value;
        
        // Should have proper markdown structure
        expect(content).toMatch(/\*\*\w+\*\*/); // Bold title
        expect(content).toMatch(/_\(\w+\)_/);   // Italic type
        
        // Should have code blocks if syntax is present
        if (content.includes("**Syntax:**")) {
          expect(content).toContain("```hyperscript");
          expect(content).toContain("```");
        }
      }
    });

    test("should limit number of examples", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "put 'test' into me");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result && result.contents.value.includes("**Examples:**")) {
        // Count number of example blocks - should be limited (≤ 3)
        const exampleBlocks = (result.contents.value.match(/```hyperscript/g) || []).length;
        expect(exampleBlocks).toBeLessThanOrEqual(4); // 1 for syntax + max 3 for examples
      }
    });
  });

  describe("Edge Cases", () => {
    test("should return null for unknown words", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 }
      };
      
      handlers.setTextContent("file:///test.hs", "unknownword123");
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeNull();
    });

    test("should handle position at word boundaries", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 } // Right at end of "put"
      };
      
      handlers.setTextContent("file:///test.hs", "put 'test'");
      
      const result = await handlers.handleHover(params);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.contents.value).toContain("put");
      }
    });

    test("should handle position beyond document end", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 10, character: 50 }
      };
      
      handlers.setTextContent("file:///test.hs", "short");
      
      const result = await handlers.handleHover(params);
      
      // Should not crash and return null or empty result
      expect(result === null || result === undefined).toBe(true);
    });

    test("should handle empty documents", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 0 }
      };
      
      handlers.setTextContent("file:///test.hs", "");
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeNull();
    });

    test("should handle documents that don't exist", async () => {
      const params = {
        textDocument: { uri: "file:///nonexistent.hs" },
        position: { line: 0, character: 0 }
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeNull();
    });
  });
});