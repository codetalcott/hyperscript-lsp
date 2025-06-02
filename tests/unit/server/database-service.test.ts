import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import type { DatabaseService } from "./database-service";
import * as fs from "node:fs/promises";
import * as path from "node:path";

describe("Database Service", () => {
  let service: DatabaseService;
  const testDbPath = path.join(import.meta.dir, "test-service.db");
  
  beforeAll(async () => {
    const { createDatabaseService } = require("./database-service");
    const { createConnection } = require("../db/connection");
    
    // Create schema in test database
    const conn = createConnection({ path: testDbPath });
    conn.exec(`
      CREATE TABLE commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        syntax_canonical TEXT
      );
      
      CREATE TABLE keywords (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
      
      CREATE TABLE expressions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
      
      CREATE TABLE features (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
      
      CREATE TABLE special_symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        description TEXT
      );
      
      CREATE TABLE code_examples (
        id TEXT PRIMARY KEY,
        title TEXT,
        raw_code TEXT,
        difficulty TEXT
      );
      
      CREATE TABLE code_example_grammar_elements (
        id TEXT PRIMARY KEY,
        code_example_id TEXT,
        grammar_element_id TEXT,
        grammar_element_type TEXT
      );
      
      -- Insert some test data
      INSERT INTO commands (id, name, description, syntax_canonical)
      VALUES ('1', 'put', 'Puts content into element', 'put <expression> into <target>');
      
      INSERT INTO keywords (id, name, description)
      VALUES ('1', 'to', 'Assignment keyword');
    `);
    conn.close();
    
    service = createDatabaseService({ 
      path: testDbPath,
      poolSize: 2 
    });
  });
  
  afterAll(async () => {
    if (service) {
      service.close();
    }
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });
  
  test("should create database service", () => {
    expect(service).toBeDefined();
    expect(service.isReady()).toBe(true);
  });
  
  describe("Completion Queries", () => {
    test("should get completion items for partial command", async () => {
      const completions = await service.getCompletionItems("pu", "command");
      
      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });
    
    test("should get all completion items when no prefix", async () => {
      const completions = await service.getCompletionItems("", "all");
      
      expect(completions).toBeDefined();
      expect(completions.commands).toBeDefined();
      expect(completions.keywords).toBeDefined();
    });
    
    test("should filter by element type", async () => {
      const commandCompletions = await service.getCompletionItems("", "command");
      const keywordCompletions = await service.getCompletionItems("", "keyword");
      
      expect(commandCompletions).toBeDefined();
      expect(keywordCompletions).toBeDefined();
    });
  });
  
  describe("Hover Information", () => {
    test("should get hover info for command", async () => {
      const hover = await service.getHoverInfo("put", "command");
      
      expect(hover).toBeDefined();
      if (hover) {
        expect(hover.name).toBeDefined();
        expect(hover.description).toBeDefined();
        expect(hover.syntax).toBeDefined();
      }
    });
    
    test("should return null for non-existent element", async () => {
      const hover = await service.getHoverInfo("nonexistent", "command");
      expect(hover).toBeNull();
    });
    
    test("should include examples in hover info", async () => {
      const hover = await service.getHoverInfo("put", "command");
      
      if (hover) {
        expect(hover.examples).toBeDefined();
        expect(Array.isArray(hover.examples)).toBe(true);
      }
    });
  });
  
  describe("Definition Lookup", () => {
    test("should find definition by exact name", async () => {
      const definition = await service.findDefinition("put");
      
      expect(definition).toBeDefined();
      if (definition) {
        expect(definition.type).toBeDefined();
        expect(definition.element).toBeDefined();
      }
    });
    
    test("should search multiple element types", async () => {
      const definition = await service.findDefinition("to");
      
      // "to" could be a keyword
      expect(definition).toBeDefined();
      if (definition) {
        expect(["keyword", "command", "expression"]).toContain(definition.type);
      }
    });
  });
  
  describe("Performance", () => {
    test("should cache frequently accessed data", async () => {
      const start1 = performance.now();
      await service.getCompletionItems("pu", "command");
      const time1 = performance.now() - start1;
      
      const start2 = performance.now();
      await service.getCompletionItems("pu", "command");
      const time2 = performance.now() - start2;
      
      // Second call should be faster due to caching
      expect(time2).toBeLessThan(time1);
    });
  });
  
  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      // Close the service to simulate error
      service.close();
      
      const completions = await service.getCompletionItems("test", "command");
      expect(completions).toEqual([]);
      
      // Recreate service for other tests
      const { createDatabaseService } = require("./database-service");
      service = createDatabaseService({ path: testDbPath });
    });
  });
});