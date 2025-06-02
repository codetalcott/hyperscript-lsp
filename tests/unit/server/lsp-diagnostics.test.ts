import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createLSPHandlers } from "./lsp-handlers";
import { createDatabaseService } from "./database-service";
import { DiagnosticSeverity } from "./lsp-handlers";

describe("LSP Diagnostics", () => {
  let handlers: ReturnType<typeof createLSPHandlers>;
  let dbService: ReturnType<typeof createDatabaseService>;
  
  beforeAll(() => {
    dbService = createDatabaseService();
    handlers = createLSPHandlers(dbService);
  });
  
  afterAll(() => {
    dbService.close();
  });
  
  describe("Syntax Error Detection", () => {
    test("should detect missing 'end' for 'if' statement", async () => {
      const uri = "file:///test-if.hs";
      const content = `if true
  put "hello" into me
-- missing end`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => 
        d.message.includes("Missing 'end' for 'if' statement") &&
        d.severity === DiagnosticSeverity.Error
      )).toBe(true);
    });
    
    test("should detect missing 'end' for 'on' event handler", async () => {
      const uri = "file:///test-on.hs";
      const content = `on click
  toggle .active
-- missing end`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => 
        d.message.includes("Missing 'end' for 'on' event handler") &&
        d.severity === DiagnosticSeverity.Error
      )).toBe(true);
    });
    
    test("should not flag properly closed structures", async () => {
      const uri = "file:///test-proper.hs";
      const content = `if true
  put "hello" into me
end

on click
  toggle .active
end`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      const syntaxErrors = diagnostics.filter(d => 
        d.message.includes("Missing 'end'") &&
        d.severity === DiagnosticSeverity.Error
      );
      
      expect(syntaxErrors.length).toBe(0);
    });
    
    test("should handle nested structures correctly", async () => {
      const uri = "file:///test-nested.hs";
      const content = `on click
  if condition
    put "nested" into me
  end
end`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      const syntaxErrors = diagnostics.filter(d => 
        d.message.includes("Missing 'end'") &&
        d.severity === DiagnosticSeverity.Error
      );
      
      expect(syntaxErrors.length).toBe(0);
    });
    
    test("should detect unknown commands", async () => {
      const uri = "file:///test-unknown.hs";
      const content = `unknownCommand "test"
put "hello" into me`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      expect(diagnostics.some(d => 
        d.message.includes("Unknown command or keyword") &&
        d.message.includes("unknowncommand") &&
        d.severity === DiagnosticSeverity.Warning
      )).toBe(true);
    });
    
    test("should ignore comments", async () => {
      const uri = "file:///test-comments.hs";
      const content = `-- This is a comment with unknownStuff
put "hello" into me -- inline comment`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      const commentWarnings = diagnostics.filter(d => 
        d.message.includes("Unknown command") &&
        d.message.includes("unknownstuff")
      );
      
      expect(commentWarnings.length).toBe(0);
    });
  });
  
  describe("Edge Cases", () => {
    test("should handle empty files", async () => {
      const uri = "file:///empty.hs";
      handlers.setTextContent(uri, "");
      
      const diagnostics = await handlers.handleDiagnostics(uri);
      expect(diagnostics).toBeDefined();
      expect(Array.isArray(diagnostics)).toBe(true);
    });
    
    test("should handle files with only whitespace", async () => {
      const uri = "file:///whitespace.hs";
      handlers.setTextContent(uri, "\n  \n\t\n");
      
      const diagnostics = await handlers.handleDiagnostics(uri);
      expect(diagnostics).toBeDefined();
      expect(Array.isArray(diagnostics)).toBe(true);
    });
    
    test("should handle complex nested missing ends", async () => {
      const uri = "file:///complex-missing.hs";
      const content = `on click
  if condition1
    if condition2
      put "deep" into me
    -- missing end for condition2
  -- missing end for condition1
-- missing end for on click`;
      
      handlers.setTextContent(uri, content);
      const diagnostics = await handlers.handleDiagnostics(uri);
      
      const missingEndErrors = diagnostics.filter(d => 
        d.message.includes("Missing 'end'") &&
        d.severity === DiagnosticSeverity.Error
      );
      
      // Should detect at least the outermost missing end
      expect(missingEndErrors.length).toBeGreaterThan(0);
    });
  });
});

describe("LSP Document Symbols", () => {
  let handlers: ReturnType<typeof createLSPHandlers>;
  let dbService: ReturnType<typeof createDatabaseService>;
  
  beforeAll(() => {
    dbService = createDatabaseService();
    handlers = createLSPHandlers(dbService);
  });
  
  afterAll(() => {
    dbService.close();
  });
  
  test("should find behavior symbols", async () => {
    const uri = "file:///behaviors.hs";
    const content = `behavior TodoApp
  init
    log "initialized"
  end
end

behavior SlideShow
  on click
    log "clicked"
  end
end`;
    
    handlers.setTextContent(uri, content);
    const symbols = await handlers.handleDocumentSymbols(uri);
    
    const behaviors = symbols.filter(s => s.name === "TodoApp" || s.name === "SlideShow");
    expect(behaviors.length).toBe(2);
    expect(behaviors[0]?.name).toBe("TodoApp");
    expect(behaviors[1]?.name).toBe("SlideShow");
  });
  
  test("should find event handler symbols", async () => {
    const uri = "file:///events.hs";
    const content = `on click
  put "clicked" into me
end

on submit
  prevent default
end

on keydown
  log "key pressed"
end`;
    
    handlers.setTextContent(uri, content);
    const symbols = await handlers.handleDocumentSymbols(uri);
    
    const events = symbols.filter(s => s.name.startsWith("on "));
    expect(events.length).toBe(3);
    expect(events.some(e => e.name === "on click")).toBe(true);
    expect(events.some(e => e.name === "on submit")).toBe(true);
    expect(events.some(e => e.name === "on keydown")).toBe(true);
  });
  
  test("should find function definition symbols", async () => {
    const uri = "file:///functions.hs";
    const content = `def showSlide(index)
  hide .slide
  show .slide[index]
end

def calculateTotal(items)
  set total to 0
  for item in items
    increment total by item.price
  end
  return total
end`;
    
    handlers.setTextContent(uri, content);
    const symbols = await handlers.handleDocumentSymbols(uri);
    
    const functions = symbols.filter(s => 
      s.name === "showSlide" || s.name === "calculateTotal"
    );
    expect(functions.length).toBe(2);
  });
  
  test("should handle mixed symbol types", async () => {
    const uri = "file:///mixed.hs";
    const content = `behavior App
  def helper()
    return "test"
  end
  
  on click
    call helper()
  end
end

on load
  log "page loaded"
end`;
    
    handlers.setTextContent(uri, content);
    const symbols = await handlers.handleDocumentSymbols(uri);
    
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols.some(s => s.name === "App")).toBe(true);
    expect(symbols.some(s => s.name === "helper")).toBe(true);
    expect(symbols.some(s => s.name.includes("click"))).toBe(true);
    expect(symbols.some(s => s.name.includes("load"))).toBe(true);
  });
  
  test("should handle empty files", async () => {
    const uri = "file:///empty-symbols.hs";
    handlers.setTextContent(uri, "");
    
    const symbols = await handlers.handleDocumentSymbols(uri);
    expect(symbols).toBeDefined();
    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols.length).toBe(0);
  });
});

describe("LSP Go to Definition", () => {
  let handlers: ReturnType<typeof createLSPHandlers>;
  let dbService: ReturnType<typeof createDatabaseService>;
  
  beforeAll(() => {
    dbService = createDatabaseService();
    handlers = createLSPHandlers(dbService);
  });
  
  afterAll(() => {
    dbService.close();
  });
  
  test("should find definition for known commands", async () => {
    const uri = "file:///definition.hs";
    const content = "put 'hello' into me";
    
    handlers.setTextContent(uri, content);
    
    const locations = await handlers.handleGoToDefinition({
      textDocument: { uri },
      position: { line: 0, character: 2 } // On "put"
    });
    
    // For now, it should return the current location if element is known
    expect(locations).toBeDefined();
    expect(Array.isArray(locations)).toBe(true);
  });
  
  test("should return empty array for unknown words", async () => {
    const uri = "file:///unknown-def.hs";
    const content = "unknownCommand 'test'";
    
    handlers.setTextContent(uri, content);
    
    const locations = await handlers.handleGoToDefinition({
      textDocument: { uri },
      position: { line: 0, character: 5 } // On "unknownCommand"
    });
    
    expect(locations).toBeDefined();
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBe(0);
  });
  
  test("should handle position beyond text", async () => {
    const uri = "file:///beyond-def.hs";
    const content = "put";
    
    handlers.setTextContent(uri, content);
    
    const locations = await handlers.handleGoToDefinition({
      textDocument: { uri },
      position: { line: 0, character: 10 } // Beyond text
    });
    
    expect(locations).toBeDefined();
    expect(Array.isArray(locations)).toBe(true);
  });
});