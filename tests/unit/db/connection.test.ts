import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { DatabaseConnection, QueryResult } from "../../../src/db/connection";

describe("Database Connection", () => {
  const testDbPath = path.join(import.meta.dir, "test.db");
  
  afterAll(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });
  
  describe("Connection Management", () => {
    test("should create database connection", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection({ path: testDbPath });
      
      expect(conn).toBeDefined();
      expect(conn.isOpen()).toBe(true);
      
      conn.close();
    });
    
    test("should use default database path if not specified", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection();
      
      expect(conn).toBeDefined();
      expect(conn.getPath()).toContain("hyperscript.db");
      
      conn.close();
    });
    
    test("should create connection pool", () => {
      const { createConnectionPool } = require("../../../src/db/connection");
      const pool = createConnectionPool({ path: testDbPath, poolSize: 3 });
      
      expect(pool).toBeDefined();
      expect(pool.getPoolSize()).toBe(3);
      
      pool.close();
    });
  });
  
  describe("Query Execution", () => {
    test("should execute queries", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection({ path: testDbPath });
      
      // Create a test table
      conn.exec(`
        CREATE TABLE IF NOT EXISTS test_items (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Insert data
      conn.exec("INSERT INTO test_items (name) VALUES ('test1'), ('test2')");
      
      // Query data
      const results = conn.query("SELECT * FROM test_items ORDER BY id");
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("test1");
      expect(results[1].name).toBe("test2");
      
      conn.close();
    });
    
    test("should support prepared statements", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection({ path: testDbPath });
      
      conn.exec(`
        CREATE TABLE IF NOT EXISTS test_prepared (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
      
      const stmt = conn.prepare("INSERT INTO test_prepared (value) VALUES (?)");
      stmt.run("value1");
      stmt.run("value2");
      
      const results = conn.query("SELECT * FROM test_prepared");
      expect(results).toHaveLength(2);
      
      conn.close();
    });
  });
  
  describe("Language Data Queries", () => {
    let conn: DatabaseConnection;
    
    beforeAll(() => {
      const { createConnection } = require("../../../src/db/connection");
      conn = createConnection({ path: testDbPath });
      
      // Set up test schema
      conn.exec(`
        CREATE TABLE IF NOT EXISTS commands (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          syntax_canonical TEXT
        );
        
        CREATE TABLE IF NOT EXISTS keywords (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT
        );
        
        CREATE TABLE IF NOT EXISTS expressions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT
        );
        
        CREATE TABLE IF NOT EXISTS features (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT
        );
        
        CREATE TABLE IF NOT EXISTS special_symbols (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          description TEXT
        );
        
        CREATE TABLE IF NOT EXISTS code_examples (
          id TEXT PRIMARY KEY,
          title TEXT,
          raw_code TEXT,
          difficulty TEXT
        );
        
        CREATE TABLE IF NOT EXISTS code_example_grammar_elements (
          id TEXT PRIMARY KEY,
          code_example_id TEXT,
          grammar_element_id TEXT,
          grammar_element_type TEXT
        );
      `);
      
      // Insert test data
      conn.exec(`
        INSERT INTO commands (id, name, description, syntax_canonical)
        VALUES 
          ('1', 'put', 'Puts content into element', 'put <expression> into <target>'),
          ('2', 'set', 'Sets a value', 'set <target> to <value>');
          
        INSERT INTO keywords (id, name, description)
        VALUES 
          ('1', 'into', 'Direction keyword'),
          ('2', 'to', 'Assignment keyword');
          
        INSERT INTO code_examples (id, title, raw_code, difficulty)
        VALUES 
          ('1', 'Example 1', 'put "Hello" into me', 'Beginner'),
          ('2', 'Example 2', 'set x to 42', 'Beginner');
      `);
    });
    
    afterAll(() => {
      if (conn) conn.close();
    });
    
    test("should find commands by name", () => {
      const results = conn.findCommands("put");
      
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("put");
      expect(results[0]?.description).toBe("Puts content into element");
    });
    
    test("should find keywords", () => {
      const results = conn.findKeywords("to");
      
      expect(results).toHaveLength(2); // Both "into" and "to" contain "to"
      const names = results.map(r => r.name);
      expect(names).toContain("to");
      expect(names).toContain("into");
    });
    
    test("should search across all element types", () => {
      const results = conn.searchElements("put");
      
      expect(results.commands).toHaveLength(1);
      expect(results.commands[0]?.name).toBe("put");
      expect(results.keywords).toHaveLength(0);
    });
    
    test("should find examples by code content", () => {
      const results = conn.findExamplesByCode("put");
      
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe("Example 1");
    });
  });
  
  describe("Error Handling", () => {
    test("should handle query errors gracefully", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection({ path: testDbPath });
      
      expect(() => {
        conn.query("SELECT * FROM non_existent_table");
      }).toThrow();
      
      conn.close();
    });
    
    test("should validate connection before queries", () => {
      const { createConnection } = require("../../../src/db/connection");
      const conn = createConnection({ path: testDbPath });
      conn.close();
      
      expect(() => {
        conn.query("SELECT 1");
      }).toThrow("Database connection is closed");
    });
  });
});