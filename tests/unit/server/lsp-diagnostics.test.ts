import { describe, expect, test, beforeAll } from "bun:test";
import type { DatabaseService } from "../../../src/server/database-service";
import type { LSPHandlers } from "../../../src/server/lsp-handlers";

describe("LSP Diagnostics", () => {
  let handlers: LSPHandlers;
  let mockDbService: DatabaseService;
  
  beforeAll(() => {
    // Create mock database service for diagnostics testing
    mockDbService = {
      isReady: () => true,
      close: () => {},
      getCompletionItems: async () => [],
      getHoverInfo: async (name: string) => {
        // Return info for known commands/keywords
        const knownElements = ["put", "toggle", "add", "remove", "on", "click", "me", "it"];
        if (knownElements.includes(name)) {
          return {
            name,
            type: "command",
            description: `Test description for ${name}`,
            syntax: `${name} syntax`,
            examples: []
          };
        }
        return null;
      },
      findDefinition: async () => null
    };
    
    const { createLSPHandlers } = require("../../../src/server/lsp-handlers");
    handlers = createLSPHandlers(mockDbService);
  });
  
  describe("Syntax Validation", () => {
    test("should validate basic hyperscript syntax", async () => {
      const uri = "file:///syntax-test.hs";
      handlers.setTextContent(uri, "on click put 'hello' into me");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(Array.isArray(diagnostics)).toBe(true);
      // Should have no errors - single line 'on' handlers don't need 'end'
      expect(diagnostics.length).toBe(0);
    });
    
    test("should detect unknown commands", async () => {
      const uri = "file:///unknown-cmd.hs";
      handlers.setTextContent(uri, "unknowncommand 'test'");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error
      expect(diagnostics[0].message).toContain("Unknown command");
      expect(diagnostics[0].range.start.line).toBe(0);
      expect(diagnostics[0].range.start.character).toBe(0);
    });
    
    test("should detect malformed syntax", async () => {
      const uri = "file:///malformed.hs";
      handlers.setTextContent(uri, "put into"); // Missing expression
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error
      expect(diagnostics[0].message).toContain("Incomplete");
    });
    
    test("should detect mismatched quotes", async () => {
      const uri = "file:///quotes.hs";
      handlers.setTextContent(uri, "put 'unclosed quote into me");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error
      expect(diagnostics[0].message).toContain("quote");
    });
  });
  
  describe("Semantic Validation", () => {
    test("should warn about potentially unused variables", async () => {
      const uri = "file:///unused-var.hs";
      handlers.setTextContent(uri, "set x to 'value'\nput 'hello' into me");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      const warnings = diagnostics.filter(d => d.severity === 2); // Warning
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("never used");
    });
    
    test("should detect undefined variables", async () => {
      const uri = "file:///undefined-var.hs";
      handlers.setTextContent(uri, "put undefinedVariable into me");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      const errors = diagnostics.filter(d => d.severity === 1); // Error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("undefined");
    });
    
    test("should validate event handler syntax", async () => {
      const uri = "file:///event-handler.hs";
      handlers.setTextContent(uri, "on invalidEvent put 'test' into me");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      const warnings = diagnostics.filter(d => d.severity === 2); // Warning
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("event");
    });
  });
  
  describe("Diagnostic Ranges", () => {
    test("should provide accurate ranges for errors", async () => {
      const uri = "file:///ranges.hs";
      handlers.setTextContent(uri, "put 'hello' into unknownword");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      
      // Should highlight the specific problematic word
      expect(diagnostic.range.start.character).toBeGreaterThan(0);
      expect(diagnostic.range.end.character).toBeGreaterThan(diagnostic.range.start.character);
    });
    
    test("should handle multiline content correctly", async () => {
      const uri = "file:///multiline.hs";
      handlers.setTextContent(uri, "on click\n  unknowncommand\nend");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      
      // Error should be on line 1 (second line)
      expect(diagnostic.range.start.line).toBe(1);
    });
  });
  
  describe("Diagnostic Categories", () => {
    test("should categorize syntax errors correctly", async () => {
      const uri = "file:///syntax-error.hs";
      handlers.setTextContent(uri, "put 'unclosed");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error
      expect(diagnostics[0].code).toBe("syntax-error");
    });
    
    test("should categorize semantic warnings correctly", async () => {
      const uri = "file:///semantic-warning.hs";
      handlers.setTextContent(uri, "set unused to 'value'");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      const warnings = diagnostics.filter(d => d.severity === 2);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].code).toBe("unused-variable");
    });
    
    test("should provide helpful diagnostic sources", async () => {
      const uri = "file:///source-test.hs";
      handlers.setTextContent(uri, "unknowncommand");
      
      const diagnostics = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].source).toBe("hyperscript-lsp");
    });
  });
  
  describe("Diagnostic Performance", () => {
    test("should handle large documents efficiently", async () => {
      const uri = "file:///large-doc.hs";
      const largeContent = Array(100).fill("put 'test' into me").join("\n");
      handlers.setTextContent(uri, largeContent);
      
      const start = Date.now();
      const diagnostics = await handlers.provideDiagnostics(uri);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(Array.isArray(diagnostics)).toBe(true);
    });
    
    test("should provide incremental diagnostics", async () => {
      const uri = "file:///incremental.hs";
      handlers.setTextContent(uri, "put 'hello' into me");
      
      // First diagnostic run
      const diagnostics1 = await handlers.provideDiagnostics(uri);
      
      // Change content
      handlers.setTextContent(uri, "put 'hello' unknownword me");
      
      // Second diagnostic run should detect new error
      const diagnostics2 = await handlers.provideDiagnostics(uri);
      
      expect(diagnostics1.length).toBe(0);
      expect(diagnostics2.length).toBeGreaterThan(0);
    });
  });
  
  describe("Diagnostic Integration", () => {
    test("should integrate with document lifecycle", async () => {
      const uri = "file:///lifecycle.hs";
      
      // Open document
      handlers.handleDidOpen({
        textDocument: {
          uri,
          languageId: "hyperscript",
          version: 1,
          text: "unknowncommand"
        }
      });
      
      // Should have diagnostics available
      const diagnostics = await handlers.provideDiagnostics(uri);
      expect(diagnostics.length).toBeGreaterThan(0);
      
      // Close document
      handlers.handleDidClose({ textDocument: { uri } });
      
      // Diagnostics should be cleared or unavailable
      const diagnosticsAfterClose = await handlers.provideDiagnostics(uri);
      expect(diagnosticsAfterClose.length).toBe(0);
    });
    
    test("should update diagnostics on content change", async () => {
      const uri = "file:///content-change.hs";
      
      // Initial content with error
      handlers.handleDidOpen({
        textDocument: {
          uri,
          languageId: "hyperscript",
          version: 1,
          text: "unknowncommand"
        }
      });
      
      const diagnostics1 = await handlers.provideDiagnostics(uri);
      expect(diagnostics1.length).toBeGreaterThan(0);
      
      // Fix the content
      handlers.handleDidChange({
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: "put 'hello' into me" }]
      });
      
      const diagnostics2 = await handlers.provideDiagnostics(uri);
      expect(diagnostics2.length).toBe(0);
    });
  });
});