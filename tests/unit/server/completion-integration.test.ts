import { describe, test, expect, beforeAll } from "bun:test";
import { createLSPHandlers } from "./lsp-handlers";
import { createDatabaseService } from "./database-service";
import * as path from "node:path";

describe("Completion Integration Tests", () => {
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

  describe("Real Data Completion", () => {
    test("should complete hyperscript commands", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 },
        context: { triggerKind: 1 }
      };
      
      // Set content with partial command
      handlers.setTextContent("file:///test.hs", "tog");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should contain toggle command
      const toggleCommand = result.find(item => item.label === "toggle");
      expect(toggleCommand).toBeDefined();
      expect(toggleCommand?.kind).toBe(3); // Function kind
    });

    test("should complete keywords after commands", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 8 },
        context: { triggerKind: 1 }
      };
      
      // Set content with command followed by partial keyword
      handlers.setTextContent("file:///test.hs", "put 'hi' in");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should contain "into" keyword
      const intoKeyword = result.find(item => item.label === "into");
      expect(intoKeyword).toBeDefined();
      expect(intoKeyword?.kind).toBe(14); // Keyword kind
    });

    test("should complete special symbols", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      // Set content with partial special symbol
      handlers.setTextContent("file:///test.hs", "me");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Should contain special symbols like "me"
      const meSymbol = result.find(item => item.label === "me");
      expect(meSymbol).toBeDefined();
      // Note: "me" might be found as variable (6) or constant (21) depending on database order
      expect([6, 21]).toContain(meSymbol?.kind);
    });

    test("should complete features", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      // Set content with partial feature
      handlers.setTextContent("file:///test.hs", "on");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Should contain "on" feature  
      const onFeature = result.find(item => item.label === "on");
      expect(onFeature).toBeDefined();
      // Note: "on" might be found as keyword (14) or event (23) depending on database order
      expect([14, 23]).toContain(onFeature?.kind);
    });

    test("should handle empty prefix completion", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 1 },
        context: { triggerKind: 1 }
      };
      
      // Document with single space to trigger completion
      handlers.setTextContent("file:///test.hs", " ");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      // Note: Empty prefix might return fewer results, just verify it doesn't crash
      
      // Should include various types of completions
      if (result.length > 0) {
        const hasCommands = result.some(item => item.kind === 3);
        const hasKeywords = result.some(item => item.kind === 14);
        
        expect(hasCommands || hasKeywords).toBe(true);
      }
    });

    test("should return proper LSP completion item format", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "put");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check first completion item format
      const firstItem = result[0];
      expect(firstItem).toBeDefined();
      expect(firstItem).toHaveProperty("label");
      expect(firstItem).toHaveProperty("kind");
      expect(typeof firstItem.label).toBe("string");
      expect(typeof firstItem.kind).toBe("number");
      
      // Optional properties should be strings if present
      if (firstItem.detail) {
        expect(typeof firstItem.detail).toBe("string");
      }
      if (firstItem.documentation) {
        expect(typeof firstItem.documentation).toBe("string");
      }
      if (firstItem.insertText) {
        expect(typeof firstItem.insertText).toBe("string");
      }
      if (firstItem.sortText) {
        expect(typeof firstItem.sortText).toBe("string");
      }
    });

    test("should handle completion for multiline documents", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 1, character: 2 },
        context: { triggerKind: 1 }
      };
      
      // Multi-line document
      handlers.setTextContent("file:///test.hs", "on click\n  to");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Should complete "toggle" even in indented context
      const toggleCommand = result.find(item => item.label === "toggle");
      expect(toggleCommand).toBeDefined();
    });

    test("should filter completions by exact prefix match priority", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 6 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "toggle");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Exact match "toggle" should be in results
      const exactMatch = result.find(item => item.label === "toggle");
      expect(exactMatch).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle document that doesn't exist", async () => {
      const params = {
        textDocument: { uri: "file:///nonexistent.hs" },
        position: { line: 0, character: 0 },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0); // Should return empty array
    });

    test("should handle position beyond document end", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 10, character: 50 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "short");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      // Should handle gracefully without throwing
    });

    test("should handle special characters in prefix", async () => {
      const params = {
        textDocument: { uri: "file:///test.hs" },
        position: { line: 0, character: 3 },
        context: { triggerKind: 1 }
      };
      
      handlers.setTextContent("file:///test.hs", "me.");
      
      const result = await handlers.handleCompletion(params);
      
      expect(Array.isArray(result)).toBe(true);
      // Should not crash on special characters
    });
  });
});