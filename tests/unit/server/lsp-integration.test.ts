import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createLSPHandlers } from "./lsp-handlers";
import { createDatabaseService } from "./database-service";
import { createLSPServer } from "./lsp-server";
import type { CompletionParams, HoverParams, DefinitionParams } from "vscode-languageserver";

describe("LSP Integration Tests with Real Hyperscript", () => {
  let handlers: ReturnType<typeof createLSPHandlers>;
  let dbService: ReturnType<typeof createDatabaseService>;
  
  beforeAll(() => {
    // Use real database service
    dbService = createDatabaseService();
    handlers = createLSPHandlers(dbService);
  });
  
  afterAll(() => {
    dbService.close();
  });
  
  describe("Real Hyperscript Completion Scenarios", () => {
    test("should complete commands at the start of a line", async () => {
      const uri = "file:///test1.hs";
      handlers.setTextContent(uri, "pu");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(item => item.label === "put")).toBe(true);
    });
    
    test("should complete features like 'on' and 'behavior'", async () => {
      const uri = "file:///test2.hs";
      handlers.setTextContent(uri, "o");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 1 },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.some(item => item.label === "on")).toBe(true);
    });
    
    test("should complete in multi-line hyperscript", async () => {
      const uri = "file:///test3.hs";
      const content = `on click
  tog`;
      handlers.setTextContent(uri, content);
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 1, character: 5 }, // After "tog"
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.some(item => item.label === "toggle")).toBe(true);
    });
    
    test("should complete keywords after commands", async () => {
      const uri = "file:///test4.hs";
      handlers.setTextContent(uri, "put 'hello' i");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 13 }, // After "i"
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.some(item => item.label === "into")).toBe(true);
      expect(result.some(item => item.label === "in")).toBe(true);
    });
    
    test("should complete special symbols", async () => {
      const uri = "file:///test5.hs";
      handlers.setTextContent(uri, "put 'hello' into m");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 18 }, // After "m"
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.some(item => item.label === "me")).toBe(true);
    });
    
    test("should handle complex nested structures", async () => {
      const uri = "file:///test6.hs";
      const content = `behavior slideshow
  on click from .next-btn
    rem`;
      handlers.setTextContent(uri, content);
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 2, character: 7 }, // After "rem"
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(result.some(item => item.label === "remove")).toBe(true);
    });
  });
  
  describe("Real Hyperscript Hover Scenarios", () => {
    test("should show hover for commands", async () => {
      const uri = "file:///hover1.hs";
      handlers.setTextContent(uri, "put 'hello' into me");
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 2 } // On "put"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.kind).toBe("markdown");
      expect(result!.contents.value).toContain("put");
      expect(result!.contents.value).toContain("command");
    });
    
    test("should show hover for features", async () => {
      const uri = "file:///hover2.hs";
      handlers.setTextContent(uri, "on click toggle .active");
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 1 } // On "on"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("on");
    });
    
    test("should show hover for keywords", async () => {
      const uri = "file:///hover3.hs";
      handlers.setTextContent(uri, "put 'text' into #output");
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 12 } // On "into"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("into");
    });
    
    test("should show hover for special symbols", async () => {
      const uri = "file:///hover4.hs";
      handlers.setTextContent(uri, "on click from me");
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 15 } // On "me"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("me");
    });
    
    test("should handle hover in complex expressions", async () => {
      const uri = "file:///hover5.hs";
      const content = `behavior todoApp
  on click from .add-btn
    get value of #input
    put it into newTodo
    make <li/> called item
    put newTodo into item
    put item at end of #list`;
      
      handlers.setTextContent(uri, content);
      
      // Test hover on "make"
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 4, character: 6 } // On "make"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
      expect(result!.contents.value).toContain("make");
    });
  });
  
  describe("Edge Cases and Error Handling", () => {
    test("should handle empty files gracefully", async () => {
      const uri = "file:///empty.hs";
      handlers.setTextContent(uri, "");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 0 },
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    test("should handle position beyond text length", async () => {
      const uri = "file:///beyond.hs";
      handlers.setTextContent(uri, "put");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 10 }, // Beyond text
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    test("should handle multi-byte characters", async () => {
      const uri = "file:///unicode.hs";
      handlers.setTextContent(uri, "put '👋 Hello' into me");
      
      const params: HoverParams = {
        textDocument: { uri },
        position: { line: 0, character: 20 } // On "me"
      };
      
      const result = await handlers.handleHover(params);
      
      expect(result).toBeDefined();
    });
    
    test("should handle comments in hyperscript", async () => {
      const uri = "file:///comments.hs";
      const content = `-- This is a comment
put 'hello' into me -- inline comment`;
      
      handlers.setTextContent(uri, content);
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 5 }, // In comment
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      
      // Should still return results even in comments (LSP doesn't parse comments)
      expect(result).toBeDefined();
    });
  });
  
  describe("Performance Tests", () => {
    test("should handle rapid completion requests", async () => {
      const uri = "file:///perf.hs";
      const promises = [];
      
      // Simulate typing "put"
      for (let i = 1; i <= 3; i++) {
        handlers.setTextContent(uri, "put".substring(0, i));
        const params: CompletionParams = {
          textDocument: { uri },
          position: { line: 0, character: i },
          context: { triggerKind: 1 }
        };
        promises.push(handlers.handleCompletion(params));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });
    
    test("should cache and reuse database results efficiently", async () => {
      const uri = "file:///cache.hs";
      handlers.setTextContent(uri, "pu");
      
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 0, character: 2 },
        context: { triggerKind: 1 }
      };
      
      // First call
      const start1 = Date.now();
      const result1 = await handlers.handleCompletion(params);
      const time1 = Date.now() - start1;
      
      // Second call (should be cached)
      const start2 = Date.now();
      const result2 = await handlers.handleCompletion(params);
      const time2 = Date.now() - start2;
      
      expect(result1).toEqual(result2);
      // Second call should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
  
  describe("Real-world Hyperscript Examples", () => {
    test("should handle todo app example", async () => {
      const uri = "file:///todo.hs";
      const content = `behavior TodoList
  on click from .todo-item
    toggle .completed on me
    
  on click from .delete-btn
    remove closest .todo-item
    
  on submit from #todo-form
    prevent default
    get value of #todo-input
    make <li.todo-item/> called item
    put it into item
    put item at end of #todo-list
    set value of #todo-input to ""`;
      
      handlers.setTextContent(uri, content);
      
      // Test completion after "toggle"
      const params1: CompletionParams = {
        textDocument: { uri },
        position: { line: 2, character: 11 }, // After "toggle"
        context: { triggerKind: 1 }
      };
      
      const result1 = await handlers.handleCompletion(params1);
      expect(result1.some(item => item.label === ".completed")).toBe(false); // Class names aren't in our db
      
      // Test hover on "prevent"
      const params2: HoverParams = {
        textDocument: { uri },
        position: { line: 8, character: 8 } // On "prevent"
      };
      
      const result2 = await handlers.handleHover(params2);
      expect(result2).toBeDefined();
      expect(result2!.contents.value).toContain("prevent");
    });
    
    test("should handle animation example", async () => {
      const uri = "file:///animation.hs";
      const content = `behavior FadeIn
  init
    set my opacity to 0
    then transition my opacity to 1 over 500ms
    
  on click
    toggle between .expanded and .collapsed on me
    if I match .expanded
      transition my height to auto over 300ms
    else
      transition my height to 0 over 300ms
    end`;
      
      handlers.setTextContent(uri, content);
      
      // Test completion for "transition"
      handlers.setTextContent(uri, content.substring(0, 50) + "tra");
      const params: CompletionParams = {
        textDocument: { uri },
        position: { line: 3, character: 11 }, // After "tra"
        context: { triggerKind: 1 }
      };
      
      const result = await handlers.handleCompletion(params);
      expect(result.some(item => item.label === "transition")).toBe(true);
    });
  });
});