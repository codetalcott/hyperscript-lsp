import { Database } from 'bun:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

// Define paths relative to this script's location
const SCRIPT_DIR = import.meta.dir;
const DB_DIR = path.join(SCRIPT_DIR, '..');
const DB_PATH = path.join(DB_DIR, 'hyperscript.db');
const DATA_DIR = path.join(SCRIPT_DIR, 'data/collected_json');

/**
 * Creates the SQLite database schema.
 */
function createSchema(db: Database): void {
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
function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');
  
  // Create the schema
  createSchema(db);
  
  return db;
}

// Importing functions and utilities for data import
import { v4 as uuidv4 } from 'uuid';

/**
 * Reads a JSON file and returns its parsed content
 */
async function readJsonFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    return [];
  }
}

/**
 * Imports source info data into the database
 */
function importSourceInfo(db: Database, sourceInfo: any): string {
  if (!sourceInfo) return '';

  // Check if the source_info already exists
  const existingSourceInfo = db.query('SELECT id FROM source_info WHERE id = ?').get(sourceInfo.id);
  if (existingSourceInfo) {
    return existingSourceInfo.id as string;
  }
  
  // Insert the source info
  const stmt = db.prepare(`
    INSERT INTO source_info (
      id, 
      source_url, 
      source_description, 
      hyperscript_version_context, 
      retrieved_at, 
      document_path
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    sourceInfo.id,
    sourceInfo.source_url || null,
    sourceInfo.source_description,
    sourceInfo.hyperscript_version_context || null,
    sourceInfo.retrieved_at ? new Date(sourceInfo.retrieved_at).toISOString() : null,
    sourceInfo.document_path || null
  );
  
  return sourceInfo.id;
}

/**
 * Imports tags for an element
 */
function importTags(db: Database, elementId: string, elementType: string, tags: string[]): void {
  if (!tags || tags.length === 0) return;
  
  const stmt = db.prepare(`
    INSERT INTO tags (
      id,
      element_id,
      element_type,
      tag
    ) VALUES (?, ?, ?, ?)
  `);
  
  for (const tag of tags) {
    stmt.run(
      uuidv4(),
      elementId,
      elementType,
      tag
    );
  }
}

/**
 * Imports syntax examples for an element
 */
function importSyntaxExamples(
  db: Database, 
  elementId: string, 
  elementType: string, 
  examples: string[], 
  fieldName: string = 'syntax_examples'
): void {
  if (!examples || examples.length === 0) return;
  
  const stmt = db.prepare(`
    INSERT INTO syntax_examples (
      id,
      element_id,
      element_type,
      example
    ) VALUES (?, ?, ?, ?)
  `);
  
  for (const example of examples) {
    stmt.run(
      uuidv4(),
      elementId,
      elementType,
      example
    );
  }
}

/**
 * Imports related elements for an element
 */
function importRelatedElements(
  db: Database, 
  sourceElementId: string, 
  sourceElementType: string, 
  relatedElements: any[]
): void {
  if (!relatedElements || relatedElements.length === 0) return;
  
  const stmt = db.prepare(`
    INSERT INTO related_elements (
      id,
      source_element_id,
      source_element_type,
      target_element_type,
      target_element_name
    ) VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const element of relatedElements) {
    stmt.run(
      uuidv4(),
      sourceElementId,
      sourceElementType,
      element.element_type,
      element.element_name
    );
  }
}

/**
 * Imports command data into the database
 */
async function importCommands(db: Database): Promise<void> {
  console.log('Importing commands...');
  
  const filePath = path.join(DATA_DIR, 'markdown_commands.json');
  const commands = await readJsonFile(filePath);
  
  // Create a map to track already imported commands by ID
  const importedCommands = new Map<string, string>(); // id -> name
  let importCount = 0;
  
  for (const command of commands) {
    // Check if this command ID already exists
    if (importedCommands.has(command.id)) {
      console.log(`  Skipping duplicate command ID: ${command.id} (${command.name})`);
      continue;
    }
    
    // Check if a command with this ID already exists in the database
    const existingCommand = db.query('SELECT id FROM commands WHERE id = ?').get(command.id);
    if (existingCommand) {
      console.log(`  Command with ID ${command.id} (${command.name}) already exists in database`);
      importedCommands.set(command.id, command.name);
      continue;
    }
    
    // First import the source info
    const sourceInfoId = importSourceInfo(db, command.source_info);
    
    // Insert the command
    const stmt = db.prepare(`
      INSERT INTO commands (
        id,
        name,
        description,
        syntax_canonical,
        purpose,
        status,
        created_at,
        updated_at,
        source_info_id,
        implicit_target,
        implicit_result_target,
        is_blocking,
        has_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      command.id,
      command.name,
      command.description || null,
      command.syntax_canonical || null,
      command.purpose || null,
      command.status,
      new Date(command.created_at).toISOString(),
      new Date(command.updated_at).toISOString(),
      sourceInfoId || null,
      command.implicit_target || null,
      command.implicit_result_target || null,
      command.is_blocking ? 1 : 0,
      command.has_body ? 1 : 0
    );
    
    // Record this command as imported
    importedCommands.set(command.id, command.name);
    importCount++;
    
    // Import arguments if any
    if (command.arguments && command.arguments.length > 0) {
      const argStmt = db.prepare(`
        INSERT INTO command_arguments (
          id,
          command_id,
          name,
          type,
          description,
          is_optional,
          default_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const arg of command.arguments) {
        argStmt.run(
          uuidv4(),
          command.id,
          arg.name,
          arg.type,
          arg.description || null,
          arg.is_optional ? 1 : 0,
          arg.default_value || null
        );
      }
    }
    
    // Import tags
    importTags(db, command.id, 'Command', command.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, command.id, 'Command', command.example_usage || [], 'example_usage');
    
    // Import related elements
    importRelatedElements(db, command.id, 'Command', command.related_elements || []);
  }
  
  console.log(`Imported ${importCount} commands (${commands.length - importCount} duplicates skipped)`);
}

/**
 * Imports expression data into the database
 */
async function importExpressions(db: Database): Promise<void> {
  console.log('Importing expressions...');
  
  const filePath = path.join(DATA_DIR, 'markdown_expressions.json');
  const expressions = await readJsonFile(filePath);
  
  // Create a map to track already imported expressions by ID
  const importedExpressions = new Map<string, string>(); // id -> name
  let importCount = 0;
  
  for (const expression of expressions) {
    // Check if this expression ID already exists
    if (importedExpressions.has(expression.id)) {
      console.log(`  Skipping duplicate expression ID: ${expression.id} (${expression.name})`);
      continue;
    }
    
    // Check if an expression with this ID already exists in the database
    const existingExpression = db.query('SELECT id FROM expressions WHERE id = ?').get(expression.id);
    if (existingExpression) {
      console.log(`  Expression with ID ${expression.id} (${expression.name}) already exists in database`);
      importedExpressions.set(expression.id, expression.name);
      continue;
    }
    
    // First import the source info
    const sourceInfoId = importSourceInfo(db, expression.source_info);
    
    // Insert the expression
    const stmt = db.prepare(`
      INSERT INTO expressions (
        id,
        name,
        description,
        category,
        evaluates_to_type,
        precedence,
        associativity,
        status,
        created_at,
        updated_at,
        source_info_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      expression.id,
      expression.name,
      expression.description || null,
      expression.category, // This is required
      expression.evaluates_to_type || null,
      expression.precedence || null,
      expression.associativity || null,
      expression.status,
      new Date(expression.created_at).toISOString(),
      new Date(expression.updated_at).toISOString(),
      sourceInfoId || null
    );
    
    // Record this expression as imported
    importedExpressions.set(expression.id, expression.name);
    importCount++;
    
    // Import operators if any
    if (expression.operators && expression.operators.length > 0) {
      const opStmt = db.prepare(`
        INSERT INTO expression_operators (
          id,
          expression_id,
          operator
        ) VALUES (?, ?, ?)
      `);
      
      for (const operator of expression.operators) {
        opStmt.run(
          uuidv4(),
          expression.id,
          operator
        );
      }
    }
    
    // Import tags
    importTags(db, expression.id, 'Expression', expression.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, expression.id, 'Expression', expression.syntax_patterns || [], 'syntax_patterns');
    importSyntaxExamples(db, expression.id, 'Expression', expression.example_usage || [], 'example_usage');
    
    // Import related elements
    importRelatedElements(db, expression.id, 'Expression', expression.related_elements || []);
  }
  
  console.log(`Imported ${importCount} expressions (${expressions.length - importCount} duplicates skipped)`);
}

/**
 * Imports feature data into the database
 */
async function importFeatures(db: Database): Promise<void> {
  console.log('Importing features...');
  
  const filePath = path.join(DATA_DIR, 'markdown_features.json');
  const features = await readJsonFile(filePath);
  
  // Create a map to track already imported features by ID
  const importedFeatures = new Map<string, string>(); // id -> name
  let importCount = 0;
  
  for (const feature of features) {
    // Check if this feature ID already exists
    if (importedFeatures.has(feature.id)) {
      console.log(`  Skipping duplicate feature ID: ${feature.id} (${feature.name})`);
      continue;
    }
    
    // Check if a feature with this ID already exists in the database
    const existingFeature = db.query('SELECT id FROM features WHERE id = ?').get(feature.id);
    if (existingFeature) {
      console.log(`  Feature with ID ${feature.id} (${feature.name}) already exists in database`);
      importedFeatures.set(feature.id, feature.name);
      continue;
    }
    
    // First import the source info
    const sourceInfoId = importSourceInfo(db, feature.source_info);
    
    // Insert the feature
    const stmt = db.prepare(`
      INSERT INTO features (
        id,
        name,
        description,
        syntax_canonical,
        trigger,
        structure_description,
        scope_impact,
        status,
        created_at,
        updated_at,
        source_info_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      feature.id,
      feature.name,
      feature.description || null,
      feature.syntax_canonical || null,
      feature.trigger || null,
      feature.structure_description || null,
      feature.scope_impact || null,
      feature.status,
      new Date(feature.created_at).toISOString(),
      new Date(feature.updated_at).toISOString(),
      sourceInfoId || null
    );
    
    // Record this feature as imported
    importedFeatures.set(feature.id, feature.name);
    importCount++;
    
    // Import tags
    importTags(db, feature.id, 'Feature', feature.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, feature.id, 'Feature', feature.example_usage || [], 'example_usage');
    
    // Import related elements
    importRelatedElements(db, feature.id, 'Feature', feature.related_elements || []);
  }
  
  console.log(`Imported ${importCount} features (${features.length - importCount} duplicates skipped)`);
}

/**
 * Imports keyword data into the database
 */
async function importKeywords(db: Database): Promise<void> {
  console.log('Importing keywords...');
  
  const filePath = path.join(DATA_DIR, 'markdown_keywords.json');
  const keywords = await readJsonFile(filePath);
  
  // Create a map to track already imported keywords by ID
  const importedKeywords = new Map<string, string>(); // id -> name
  let importCount = 0;
  
  for (const keyword of keywords) {
    // Check if this keyword ID already exists
    if (importedKeywords.has(keyword.id)) {
      console.log(`  Skipping duplicate keyword ID: ${keyword.id} (${keyword.name})`);
      continue;
    }
    
    // Check if a keyword with this ID already exists in the database
    const existingKeyword = db.query('SELECT id FROM keywords WHERE id = ?').get(keyword.id);
    if (existingKeyword) {
      console.log(`  Keyword with ID ${keyword.id} (${keyword.name}) already exists in database`);
      importedKeywords.set(keyword.id, keyword.name);
      continue;
    }
    
    // First import the source info
    const sourceInfoId = importSourceInfo(db, keyword.source_info);
    
    // Insert the keyword
    const stmt = db.prepare(`
      INSERT INTO keywords (
        id,
        name,
        description,
        context_of_use,
        is_optional_in_syntax,
        status,
        created_at,
        updated_at,
        source_info_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      keyword.id,
      keyword.name,
      keyword.description || null,
      keyword.context_of_use || null,
      keyword.is_optional_in_syntax ? 1 : 0,
      keyword.status,
      new Date(keyword.created_at).toISOString(),
      new Date(keyword.updated_at).toISOString(),
      sourceInfoId || null
    );
    
    // Record this keyword as imported
    importedKeywords.set(keyword.id, keyword.name);
    importCount++;
    
    // Import usage contexts
    if (keyword.usage_context && keyword.usage_context.length > 0) {
      const contextStmt = db.prepare(`
        INSERT INTO keyword_usage_contexts (
          id,
          keyword_id,
          context
        ) VALUES (?, ?, ?)
      `);
      
      for (const context of keyword.usage_context) {
        contextStmt.run(
          uuidv4(),
          keyword.id,
          context
        );
      }
    }
    
    // Import tags
    importTags(db, keyword.id, 'Keyword', keyword.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, keyword.id, 'Keyword', keyword.syntax_examples || [], 'syntax_examples');
    
    // Import related elements
    importRelatedElements(db, keyword.id, 'Keyword', keyword.related_elements || []);
  }
  
  console.log(`Imported ${importCount} keywords (${keywords.length - importCount} duplicates skipped)`);
}

/**
 * Imports special symbol data into the database
 */
async function importSpecialSymbols(db: Database): Promise<void> {
  console.log('Importing special symbols...');
  
  const filePath = path.join(DATA_DIR, 'markdown_special_symbols.json');
  const specialSymbols = await readJsonFile(filePath);
  
  // Create a map to track already imported special symbols by ID
  const importedSymbols = new Map<string, string>(); // id -> name
  let importCount = 0;
  
  for (const symbol of specialSymbols) {
    // Check if this symbol ID already exists
    if (importedSymbols.has(symbol.id)) {
      console.log(`  Skipping duplicate special symbol ID: ${symbol.id} (${symbol.name})`);
      continue;
    }
    
    // Check if a symbol with this ID already exists in the database
    const existingSymbol = db.query('SELECT id FROM special_symbols WHERE id = ?').get(symbol.id);
    if (existingSymbol) {
      console.log(`  Special symbol with ID ${symbol.id} (${symbol.name}) already exists in database`);
      importedSymbols.set(symbol.id, symbol.name);
      continue;
    }
    
    // First import the source info
    const sourceInfoId = importSourceInfo(db, symbol.source_info);
    
    // Insert the special symbol
    const stmt = db.prepare(`
      INSERT INTO special_symbols (
        id,
        name,
        symbol,
        symbol_type,
        description,
        typical_value_or_referent,
        scope_implications,
        status,
        created_at,
        updated_at,
        source_info_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      symbol.id,
      symbol.name,
      symbol.symbol,
      symbol.symbol_type,
      symbol.description || null,
      symbol.typical_value_or_referent || null,
      symbol.scope_implications || null,
      symbol.status,
      new Date(symbol.created_at).toISOString(),
      new Date(symbol.updated_at).toISOString(),
      sourceInfoId || null
    );
    
    // Record this symbol as imported
    importedSymbols.set(symbol.id, symbol.name);
    importCount++;
    
    // Import tags
    importTags(db, symbol.id, 'SpecialSymbol', symbol.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, symbol.id, 'SpecialSymbol', symbol.syntax_examples || [], 'syntax_examples');
    
    // Import usage contexts if any (as syntax examples)
    if (symbol.usage_context && symbol.usage_context.length > 0) {
      const contextStmt = db.prepare(`
        INSERT INTO syntax_examples (
          id,
          element_id,
          element_type,
          example
        ) VALUES (?, ?, ?, ?)
      `);
      
      for (const context of symbol.usage_context) {
        contextStmt.run(
          uuidv4(),
          symbol.id,
          'SpecialSymbol',
          context
        );
      }
    }
  }
  
  console.log(`Imported ${importCount} special symbols (${specialSymbols.length - importCount} duplicates skipped)`);
}

/**
 * Performs the complete import process
 */
async function importAll(db: Database): Promise<void> {
  try {
    // Begin a transaction for the entire import
    db.exec('BEGIN TRANSACTION;');
    
    // Import all data
    await importCommands(db);
    await importExpressions(db);
    await importFeatures(db);
    await importKeywords(db);
    await importSpecialSymbols(db);
    
    // Commit the transaction
    db.exec('COMMIT;');
    
    console.log('Import completed successfully');
  } catch (error) {
    // Rollback the transaction in case of error
    db.exec('ROLLBACK;');
    console.error('Import failed:', error);
    throw error;
  }
}

// Main function to run the database initialization and import
async function main() {
  console.log(`Initializing database at ${DB_PATH}...`);
  
  try {
    // Create the database with schema
    const db = initDatabase(DB_PATH);
    
    // Import all data
    await importAll(db);
    
    // Close the database connection
    db.close();
    
    console.log(`Database successfully created and populated at: ${DB_PATH}`);
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

// Run the script if executed directly
if (import.meta.main) {
  main();
}