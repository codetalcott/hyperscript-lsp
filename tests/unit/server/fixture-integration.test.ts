import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { createLSPHandlers } from "./lsp-handlers";
import { createDatabaseService } from "./database-service";
import type { CompletionParams, HoverParams } from "./types";

describe("LSP Integration with Real Hyperscript Files", () => {
  let handlers: ReturnType<typeof createLSPHandlers>;
  let dbService: ReturnType<typeof createDatabaseService>;
  
  const fixturesDir = join(__dirname, "test-fixtures");
  
  // Helper to load fixture
  const loadFixture = (filename: string): string => {
    return readFileSync(join(fixturesDir, filename), "utf-8");
  };
  
  beforeAll(() => {
    dbService = createDatabaseService();
    handlers = createLSPHandlers(dbService);
  });
  
  afterAll(() => {
    dbService.close();
  });
  
  describe("Todo App Fixture Tests", () => {
    const todoContent = loadFixture("todo-app.hs");
    const uri = "file:///fixtures/todo-app.hs";
    
    beforeAll(() => {
      handlers.setTextContent(uri, todoContent);
    });
    
    test("should provide completions for 'make' command variations", async () => {
      // Position after "ma" in "make <li.todo-item/>"
      const lineWithMake = todoContent.split('\n').findIndex(line => line.includes("make <li.todo-item/>"));
      const charPos = todoContent.split('\n')[lineWithMake].indexOf("make") + 2;
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: lineWithMake, character: charPos },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result.some(item => item.label === "make")).toBe(true);
    });
    
    test("should show hover info for 'toggle' command", async () => {
      const lines = todoContent.split('\n');
      const lineWithToggle = lines.findIndex(line => line.includes("toggle .completed"));
      const charPos = lines[lineWithToggle].indexOf("toggle") + 3;
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: lineWithToggle, character: charPos }
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("toggle");
      expect(result!.contents.value).toContain("command");
    });
    
    test("should complete 'if' expressions", async () => {
      const lines = todoContent.split('\n');
      const lineWithIf = lines.findIndex(line => line.trim().startsWith("if it"));
      const charPos = lines[lineWithIf].indexOf("if") + 1;
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: lineWithIf, character: charPos },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result.some(item => item.label === "if")).toBe(true);
    });
    
    test("should recognize 'log' command throughout file", async () => {
      const logOccurrences = todoContent.split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.includes("log"));
      
      expect(logOccurrences.length).toBeGreaterThan(0);
      
      // Test hover on first log occurrence
      const firstLog = logOccurrences[0];
      const charPos = firstLog.line.indexOf("log") + 1;
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: firstLog.index, character: charPos }
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("log");
    });
  });
  
  describe("Animations Fixture Tests", () => {
    const animContent = loadFixture("animations.hs");
    const uri = "file:///fixtures/animations.hs";
    
    beforeAll(() => {
      handlers.setTextContent(uri, animContent);
    });
    
    test("should complete 'transition' command", async () => {
      const lines = animContent.split('\n');
      const lineWithTransition = lines.findIndex(line => line.includes("transition opacity"));
      const charPos = lines[lineWithTransition].indexOf("transition") + 5;
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: lineWithTransition, character: charPos },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result.some(item => item.label === "transition")).toBe(true);
    });
    
    test("should recognize 'def' for function definitions", async () => {
      const lines = animContent.split('\n');
      const lineWithDef = lines.findIndex(line => line.trim().startsWith("def"));
      const charPos = lines[lineWithDef].indexOf("def") + 1;
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: lineWithDef, character: charPos }
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      // def might be a feature or keyword
      expect(result!.contents.value).toContain("def");
    });
    
    test("should handle event modifiers like keydown[key==...]", async () => {
      const lines = animContent.split('\n');
      const lineWithKeydown = lines.findIndex(line => line.includes("keydown[key=="));
      const charPos = lines[lineWithKeydown].indexOf("keydown") + 3;
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: lineWithKeydown, character: charPos }
      };
      
      const result = await handlers.handleHover(params);
      
      // This tests that we can handle complex event syntax
      expect(result).toBeDefined();
    });
  });
  
  describe("Forms Fixture Tests", () => {
    const formsContent = loadFixture("forms.hs");
    const uri = "file:///fixtures/forms.hs";
    
    beforeAll(() => {
      handlers.setTextContent(uri, formsContent);
    });
    
    test("should complete 'fetch' command", async () => {
      const lines = formsContent.split('\n');
      const lineWithFetch = lines.findIndex(line => line.trim().startsWith("fetch"));
      const charPos = lines[lineWithFetch].indexOf("fetch") + 3;
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: lineWithFetch, character: charPos },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result.some(item => item.label === "fetch")).toBe(true);
    });
    
    test("should recognize 'prevent' command", async () => {
      const lines = formsContent.split('\n');
      const lineWithPrevent = lines.findIndex(line => line.includes("prevent default"));
      const charPos = lines[lineWithPrevent].indexOf("prevent") + 3;
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: lineWithPrevent, character: charPos }
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("prevent");
    });
    
    test("should handle 'debounced' modifier", async () => {
      const lines = formsContent.split('\n');
      const lineWithDebounced = lines.findIndex(line => line.includes("debounced at"));
      
      if (lineWithDebounced !== -1) {
        const charPos = lines[lineWithDebounced].indexOf("debounced") + 5;
        
        const params: HoverParams = {
          textDocument: { uri },
          position: { line: lineWithDebounced, character: charPos }
        };
        
        const result = await handlers.handleHover(params);
        
        // debounced might be a keyword or modifier
        expect(result).toBeDefined();
      }
    });
    
    test("should complete 'wait' command", async () => {
      const lines = formsContent.split('\n');
      const lineWithWait = lines.findIndex(line => line.trim().startsWith("wait"));
      
      if (lineWithWait !== -1) {
        const charPos = lines[lineWithWait].indexOf("wait") + 2;
        
        const params: CompletionParams = {
          textDocument: { uri },
          position: { line: lineWithWait, character: charPos },
          context: { triggerKind: 1 }
        };
        
        const result = await handlers.handleCompletion(params);
        
        expect(result.some(item => item.label === "wait")).toBe(true);
      }
    });
  });
  
  describe("Cross-file Pattern Recognition", () => {
    test("should recognize common patterns across all fixtures", async () => {
      const fixtures = ["todo-app.hs", "animations.hs", "forms.hs"];
      const commonCommands = ["if", "put", "set", "on"];
      
      for (const fixture of fixtures) {
        const content = loadFixture(fixture);
        const uri = `file:///fixtures/${fixture}`;
        handlers.setTextContent(uri, content);
        
        // Check that common commands are recognized
        for (const command of commonCommands) {
          const lines = content.split('\n');
          const lineWithCommand = lines.findIndex(line => 
            line.includes(command + " ") || line.includes(command + "\t")
          );
          
          if (lineWithCommand !== -1) {
            const charPos = lines[lineWithCommand].indexOf(command) + 1;
            
            const params: HoverParams = {
              textDocument: { uri },
              position: { line: lineWithCommand, character: charPos }
            };
            
            const result = await handlers.handleHover(params);
            
            if (result) {
              expect(result.contents.value.toLowerCase()).toContain(command);
            }
          }
        }
      }
    });
  });
  
  describe("Error Recovery and Edge Cases", () => {
    test("should handle malformed hyperscript gracefully", async () => {
      const malformedContent = `behavior Broken
  on click from
    put into
    if then else
  end end end`;
      
      const uri = "file:///malformed.hs";
      handlers.setTextContent(uri, malformedContent);
      
      // Should still provide completions even with malformed code
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 2, character: 8 }, // After "put "
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    test("should handle very long lines", async () => {
      const longLine = "put " + "'x'".repeat(500) + " into me";
      const uri = "file:///longline.hs";
      handlers.setTextContent(uri, longLine);
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 2 } // On "put"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
    });
  });
});