import { Database } from "bun:sqlite";
import * as path from "node:path";

// Types
export interface DatabaseConfig {
  path?: string;
  readonly?: boolean;
  verbose?: boolean;
}

export interface ConnectionPoolConfig extends DatabaseConfig {
  poolSize?: number;
}

export type QueryResult = Record<string, any>;

export interface DatabaseConnection {
  query: (sql: string, params?: any[]) => QueryResult[];
  exec: (sql: string) => void;
  prepare: (sql: string) => any;
  close: () => void;
  isOpen: () => boolean;
  getPath: () => string;
  
  // Language-specific queries
  findCommands: (search: string) => QueryResult[];
  findKeywords: (search: string) => QueryResult[];
  findExpressions: (search: string) => QueryResult[];
  findFeatures: (search: string) => QueryResult[];
  findSpecialSymbols: (search: string) => QueryResult[];
  findExamplesByCode: (codeSnippet: string) => QueryResult[];
  searchElements: (search: string) => {
    commands: QueryResult[];
    keywords: QueryResult[];
    expressions: QueryResult[];
    features: QueryResult[];
    specialSymbols: QueryResult[];
  };
  
  // Get element by ID
  getCommand: (id: string) => QueryResult | null;
  getKeyword: (id: string) => QueryResult | null;
  getExpression: (id: string) => QueryResult | null;
  getFeature: (id: string) => QueryResult | null;
  getCodeExample: (id: string) => QueryResult | null;
  
  // Get related examples
  getExamplesForElement: (elementId: string) => QueryResult[];
}

export interface ConnectionPool {
  getConnection: () => DatabaseConnection;
  releaseConnection: (conn: DatabaseConnection) => void;
  close: () => void;
  getPoolSize: () => number;
}

/**
 * Create a database connection
 */
export function createConnection(config: DatabaseConfig = {}): DatabaseConnection {
  const dbPath = config.path || path.join(import.meta.dir, "../hyperscript.db");
  const db = new Database(dbPath, {
    readonly: config.readonly || false,
    create: !config.readonly
  });
  
  if (config.verbose) {
    db.query("PRAGMA journal_mode = WAL");
  }
  
  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON");
  
  let isOpen = true;
  
  return {
    query: (sql: string, params: any[] = []) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(sql);
      return params.length > 0 ? stmt.all(...params) as QueryResult[] : stmt.all() as QueryResult[];
    },
    
    exec: (sql: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      db.exec(sql);
    },
    
    prepare: (sql: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare(sql);
    },
    
    close: () => {
      if (isOpen) {
        db.close();
        isOpen = false;
      }
    },
    
    isOpen: () => isOpen,
    
    getPath: () => dbPath,
    
    // Language-specific queries
    findCommands: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM commands 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name
      `);
      return stmt.all(`%${search}%`, `%${search}%`) as QueryResult[];
    },
    
    findKeywords: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM keywords 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name
      `);
      return stmt.all(`%${search}%`, `%${search}%`) as QueryResult[];
    },
    
    findExpressions: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM expressions 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name
      `);
      return stmt.all(`%${search}%`, `%${search}%`) as QueryResult[];
    },
    
    findFeatures: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM features 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name
      `);
      return stmt.all(`%${search}%`, `%${search}%`) as QueryResult[];
    },
    
    findSpecialSymbols: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM special_symbols 
        WHERE symbol LIKE ? OR name LIKE ? OR description LIKE ?
        ORDER BY symbol
      `);
      return stmt.all(`%${search}%`, `%${search}%`, `%${search}%`) as QueryResult[];
    },
    
    findExamplesByCode: (codeSnippet: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT * FROM code_examples 
        WHERE raw_code LIKE ?
        ORDER BY difficulty, title
      `);
      return stmt.all(`%${codeSnippet}%`) as QueryResult[];
    },
    
    searchElements: (search: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return {
        commands: db.prepare("SELECT * FROM commands WHERE name LIKE ? OR description LIKE ?")
          .all(`%${search}%`, `%${search}%`) as QueryResult[],
        keywords: db.prepare("SELECT * FROM keywords WHERE name LIKE ? OR description LIKE ?")
          .all(`%${search}%`, `%${search}%`) as QueryResult[],
        expressions: db.prepare("SELECT * FROM expressions WHERE name LIKE ? OR description LIKE ?")
          .all(`%${search}%`, `%${search}%`) as QueryResult[],
        features: db.prepare("SELECT * FROM features WHERE name LIKE ? OR description LIKE ?")
          .all(`%${search}%`, `%${search}%`) as QueryResult[],
        specialSymbols: db.prepare("SELECT * FROM special_symbols WHERE symbol LIKE ? OR name LIKE ?")
          .all(`%${search}%`, `%${search}%`) as QueryResult[]
      };
    },
    
    getCommand: (id: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare("SELECT * FROM commands WHERE id = ?").get(id) || null;
    },
    
    getKeyword: (id: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare("SELECT * FROM keywords WHERE id = ?").get(id) || null;
    },
    
    getExpression: (id: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare("SELECT * FROM expressions WHERE id = ?").get(id) || null;
    },
    
    getFeature: (id: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare("SELECT * FROM features WHERE id = ?").get(id) || null;
    },
    
    getCodeExample: (id: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      return db.prepare("SELECT * FROM code_examples WHERE id = ?").get(id) || null;
    },
    
    getExamplesForElement: (elementId: string) => {
      if (!isOpen) throw new Error("Database connection is closed");
      const stmt = db.prepare(`
        SELECT ce.* FROM code_examples ce
        JOIN code_example_grammar_elements cege ON ce.id = cege.code_example_id
        WHERE cege.grammar_element_id = ?
        ORDER BY ce.difficulty, ce.title
      `);
      return stmt.all(elementId) as QueryResult[];
    }
  };
}

/**
 * Create a connection pool
 */
export function createConnectionPool(config: ConnectionPoolConfig = {}): ConnectionPool {
  const poolSize = config.poolSize || 5;
  const connections: DatabaseConnection[] = [];
  const availableConnections: DatabaseConnection[] = [];
  
  // Initialize pool
  for (let i = 0; i < poolSize; i++) {
    const conn = createConnection(config);
    connections.push(conn);
    availableConnections.push(conn);
  }
  
  return {
    getConnection: () => {
      const conn = availableConnections.pop();
      if (!conn) {
        throw new Error("No available connections in pool");
      }
      return conn;
    },
    
    releaseConnection: (conn: DatabaseConnection) => {
      if (connections.includes(conn) && !availableConnections.includes(conn)) {
        availableConnections.push(conn);
      }
    },
    
    close: () => {
      for (const conn of connections) {
        conn.close();
      }
      connections.length = 0;
      availableConnections.length = 0;
    },
    
    getPoolSize: () => poolSize
  };
}