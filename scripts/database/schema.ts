import { Database } from 'bun:sqlite';

/**
 * Creates the SQLite database schema based on the project's Zod schemas.
 */
export function createSchema(db: Database): void {
  // Create tables for each grammar element type
  
  // Source Info table - used as a reference table
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_info (
      id TEXT PRIMARY KEY,
      source_url TEXT,
      source_description TEXT NOT NULL,
      hyperscript_version_context TEXT,
      retrieved_at TEXT,
      document_path TEXT
    );
  `);

  // Commands table
  db.exec(`
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      syntax_canonical TEXT,
      purpose TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      implicit_target TEXT,
      implicit_result_target TEXT,
      is_blocking INTEGER,
      has_body INTEGER,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Command Arguments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_arguments (
      id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_optional INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      FOREIGN KEY (command_id) REFERENCES commands (id)
    );
  `);

  // Expressions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expressions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      evaluates_to_type TEXT,
      precedence INTEGER,
      associativity TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Expression Operators table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expression_operators (
      id TEXT PRIMARY KEY,
      expression_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      FOREIGN KEY (expression_id) REFERENCES expressions (id)
    );
  `);

  // Features table
  db.exec(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      syntax_canonical TEXT,
      trigger TEXT,
      structure_description TEXT,
      scope_impact TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Keywords table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      context_of_use TEXT,
      is_optional_in_syntax INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Keyword Usage Contexts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyword_usage_contexts (
      id TEXT PRIMARY KEY,
      keyword_id TEXT NOT NULL,
      context TEXT NOT NULL,
      FOREIGN KEY (keyword_id) REFERENCES keywords (id)
    );
  `);

  // Special Symbols table
  db.exec(`
    CREATE TABLE IF NOT EXISTS special_symbols (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      symbol_type TEXT NOT NULL,
      description TEXT,
      typical_value_or_referent TEXT,
      scope_implications TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Code Examples table
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_examples (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      raw_code TEXT NOT NULL,
      html_context TEXT,
      observed_behavior TEXT,
      difficulty TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Code Example to Grammar Element relationship table
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_example_grammar_elements (
      id TEXT PRIMARY KEY,
      code_example_id TEXT NOT NULL,
      grammar_element_id TEXT NOT NULL,
      grammar_element_type TEXT NOT NULL,
      FOREIGN KEY (code_example_id) REFERENCES code_examples (id)
    );
  `);

  // Ambiguity Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ambiguity_reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT,
      status TEXT NOT NULL,
      resolution_suggestion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_info_id TEXT,
      FOREIGN KEY (source_info_id) REFERENCES source_info (id)
    );
  `);

  // Ambiguous Constructs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ambiguous_constructs (
      id TEXT PRIMARY KEY,
      ambiguity_report_id TEXT NOT NULL,
      construct TEXT NOT NULL,
      FOREIGN KEY (ambiguity_report_id) REFERENCES ambiguity_reports (id)
    );
  `);

  // Tables for syntax examples and usage examples - shared across element types
  db.exec(`
    CREATE TABLE IF NOT EXISTS syntax_examples (
      id TEXT PRIMARY KEY,
      element_id TEXT NOT NULL,
      element_type TEXT NOT NULL, -- 'Command', 'Expression', 'Feature', 'Keyword', 'SpecialSymbol'
      example TEXT NOT NULL
    );
  `);

  // Related elements tables - for cross-references
  db.exec(`
    CREATE TABLE IF NOT EXISTS related_elements (
      id TEXT PRIMARY KEY,
      source_element_id TEXT NOT NULL,
      source_element_type TEXT NOT NULL,
      target_element_type TEXT NOT NULL,
      target_element_name TEXT NOT NULL
    );
  `);

  // Tags table - for categorizing elements
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      element_id TEXT NOT NULL,
      element_type TEXT NOT NULL,
      tag TEXT NOT NULL
    );
  `);

  console.log('Database schema created successfully');
}

/**
 * Creates a new SQLite database and initializes the schema.
 */
export function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');
  
  // Create the schema
  createSchema(db);
  
  return db;
}

// If this script is run directly, create the database
if (import.meta.main) {
  const dbPath = process.argv[2] || '../hyperscript.db';
  const db = initDatabase(dbPath);
  console.log(`Database initialized at: ${dbPath}`);
  db.close();
}