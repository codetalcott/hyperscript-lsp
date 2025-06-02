import { Database } from 'bun:sqlite';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase } from './schema';

// Path to the JSON files
const DATA_DIR = path.join(import.meta.dir, '../scripts/data/collected_json');
const DB_PATH = path.join(import.meta.dir, '../hyperscript.db');

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
 * Imports code example grammar element relationships
 */
function importCodeExampleGrammarElements(
  db: Database,
  codeExampleId: string,
  grammarElementIds: string[]
): void {
  if (!grammarElementIds || grammarElementIds.length === 0) return;
  
  const stmt = db.prepare(`
    INSERT INTO code_example_grammar_elements (
      id,
      code_example_id,
      grammar_element_id,
      grammar_element_type
    ) VALUES (?, ?, ?, ?)
  `);
  
  for (const elementId of grammarElementIds) {
    // Determine the element type based on the ID
    // This could be more sophisticated with proper lookups
    let elementType = 'Unknown';
    
    // Try to determine element type from database
    const commandCheck = db.query('SELECT 1 FROM commands WHERE id = ?').get(elementId);
    if (commandCheck) {
      elementType = 'Command';
    } else {
      const expressionCheck = db.query('SELECT 1 FROM expressions WHERE id = ?').get(elementId);
      if (expressionCheck) {
        elementType = 'Expression';
      } else {
        const featureCheck = db.query('SELECT 1 FROM features WHERE id = ?').get(elementId);
        if (featureCheck) {
          elementType = 'Feature';
        } else {
          const keywordCheck = db.query('SELECT 1 FROM keywords WHERE id = ?').get(elementId);
          if (keywordCheck) {
            elementType = 'Keyword';
          } else {
            const symbolCheck = db.query('SELECT 1 FROM special_symbols WHERE id = ?').get(elementId);
            if (symbolCheck) {
              elementType = 'SpecialSymbol';
            }
          }
        }
      }
    }
    
    stmt.run(
      uuidv4(),
      codeExampleId,
      elementId,
      elementType
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
  
  for (const command of commands) {
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
  
  console.log(`Imported ${commands.length} commands`);
}

/**
 * Imports expression data into the database
 */
async function importExpressions(db: Database): Promise<void> {
  console.log('Importing expressions...');
  
  const filePath = path.join(DATA_DIR, 'markdown_expressions.json');
  const expressions = await readJsonFile(filePath);
  
  for (const expression of expressions) {
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
  
  console.log(`Imported ${expressions.length} expressions`);
}

/**
 * Imports feature data into the database
 */
async function importFeatures(db: Database): Promise<void> {
  console.log('Importing features...');
  
  const filePath = path.join(DATA_DIR, 'markdown_features.json');
  const features = await readJsonFile(filePath);
  
  for (const feature of features) {
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
    
    // Import tags
    importTags(db, feature.id, 'Feature', feature.tags);
    
    // Import syntax examples
    importSyntaxExamples(db, feature.id, 'Feature', feature.example_usage || [], 'example_usage');
    
    // Import related elements
    importRelatedElements(db, feature.id, 'Feature', feature.related_elements || []);
  }
  
  console.log(`Imported ${features.length} features`);
}

/**
 * Imports keyword data into the database
 */
async function importKeywords(db: Database): Promise<void> {
  console.log('Importing keywords...');
  
  const filePath = path.join(DATA_DIR, 'markdown_keywords.json');
  const keywords = await readJsonFile(filePath);
  
  for (const keyword of keywords) {
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
  
  console.log(`Imported ${keywords.length} keywords`);
}

/**
 * Imports special symbol data into the database
 */
async function importSpecialSymbols(db: Database): Promise<void> {
  console.log('Importing special symbols...');
  
  const filePath = path.join(DATA_DIR, 'markdown_special_symbols.json');
  const specialSymbols = await readJsonFile(filePath);
  
  for (const symbol of specialSymbols) {
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
  
  console.log(`Imported ${specialSymbols.length} special symbols`);
}

/**
 * Imports code examples into the database
 */
async function importCodeExamples(db: Database): Promise<void> {
  console.log('Importing code examples...');
  
  const filePath = path.join(DATA_DIR, 'markdown_cookbook_examples.json');
  
  try {
    const examples = await readJsonFile(filePath);
    
    for (const example of examples) {
      // First import the source info
      const sourceInfoId = importSourceInfo(db, example.source_info);
      
      // Insert the code example
      const stmt = db.prepare(`
        INSERT INTO code_examples (
          id,
          title,
          description,
          raw_code,
          html_context,
          observed_behavior,
          difficulty,
          status,
          created_at,
          updated_at,
          source_info_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        example.id,
        example.title,
        example.description || null,
        example.raw_code,
        example.html_context || null,
        example.observed_behavior || null,
        example.difficulty || 'Beginner',
        example.status,
        new Date(example.created_at).toISOString(),
        new Date(example.updated_at).toISOString(),
        sourceInfoId || null
      );
      
      // Import related grammar elements if any
      if (example.related_grammar_element_ids && example.related_grammar_element_ids.length > 0) {
        importCodeExampleGrammarElements(db, example.id, example.related_grammar_element_ids);
      }
      
      // Import tags
      importTags(db, example.id, 'CodeExample', example.tags || []);
    }
    
    console.log(`Imported ${examples.length} code examples`);
  } catch (error) {
    console.warn(`Could not import code examples: ${error}`);
    console.log('Code examples may not have been extracted yet. Run the cookbook extraction script first.');
  }
}

/**
 * Imports ambiguity reports into the database
 */
async function importAmbiguityReports(db: Database): Promise<void> {
  console.log('Checking for ambiguity reports...');
  
  const filePath = path.join(DATA_DIR, 'markdown_ambiguity_reports.json');
  
  try {
    const reports = await readJsonFile(filePath);
    
    for (const report of reports) {
      // First import the source info
      const sourceInfoId = importSourceInfo(db, report.source_info);
      
      // Insert the ambiguity report
      const stmt = db.prepare(`
        INSERT INTO ambiguity_reports (
          id,
          title,
          description,
          severity,
          status,
          resolution_suggestion,
          created_at,
          updated_at,
          source_info_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        report.id,
        report.title,
        report.description,
        report.severity || null,
        report.status,
        report.resolution_suggestion || null,
        new Date(report.created_at).toISOString(),
        new Date(report.updated_at).toISOString(),
        sourceInfoId || null
      );
      
      // Import ambiguous constructs
      if (report.ambiguous_constructs && report.ambiguous_constructs.length > 0) {
        const constructStmt = db.prepare(`
          INSERT INTO ambiguous_constructs (
            id,
            ambiguity_report_id,
            construct
          ) VALUES (?, ?, ?)
        `);
        
        for (const construct of report.ambiguous_constructs) {
          constructStmt.run(
            uuidv4(),
            report.id,
            construct
          );
        }
      }
      
      // Import tags
      importTags(db, report.id, 'AmbiguityReport', report.tags || []);
    }
    
    console.log(`Imported ${reports.length} ambiguity reports`);
  } catch (error) {
    console.warn(`Could not import ambiguity reports: ${error}`);
    console.log('Ambiguity reports may not exist yet.');
  }
}

/**
 * Performs the complete import process
 */
async function importAll(): Promise<void> {
  console.log(`Initializing database at ${DB_PATH}...`);
  
  // Initialize the database
  const db = initDatabase(DB_PATH);
  
  try {
    // Begin a transaction for the entire import
    db.exec('BEGIN TRANSACTION;');
    
    // Import all data
    await importCommands(db);
    await importExpressions(db);
    await importFeatures(db);
    await importKeywords(db);
    await importSpecialSymbols(db);
    await importCodeExamples(db);
    await importAmbiguityReports(db);
    
    // Commit the transaction
    db.exec('COMMIT;');
    
    console.log('Import completed successfully');
  } catch (error) {
    // Rollback the transaction in case of error
    db.exec('ROLLBACK;');
    console.error('Import failed:', error);
  } finally {
    // Close the database connection
    db.close();
  }
}

// If this script is run directly, perform the import
if (import.meta.main) {
  await importAll();
}