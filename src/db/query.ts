import { Database } from 'bun:sqlite';
import * as path from 'node:path';

const DB_PATH = path.join(import.meta.dir, '../hyperscript.db');

/**
 * Opens a connection to the SQLite database
 */
function openDatabase(): Database {
  const db = new Database(DB_PATH, { readonly: true });
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

/**
 * Gets element counts by type
 */
function getElementCounts(db: Database): Record<string, number> {
  const counts: Record<string, number> = {};
  
  // Count commands
  counts.commands = db.query('SELECT COUNT(*) as count FROM commands').get().count as number;
  
  // Count expressions
  counts.expressions = db.query('SELECT COUNT(*) as count FROM expressions').get().count as number;
  
  // Count features
  counts.features = db.query('SELECT COUNT(*) as count FROM features').get().count as number;
  
  // Count keywords
  counts.keywords = db.query('SELECT COUNT(*) as count FROM keywords').get().count as number;
  
  // Count special symbols
  counts.specialSymbols = db.query('SELECT COUNT(*) as count FROM special_symbols').get().count as number;
  
  // Count code examples
  counts.codeExamples = db.query('SELECT COUNT(*) as count FROM code_examples').get().count as number;
  
  return counts;
}

/**
 * Searches for elements across all tables
 */
function searchElements(db: Database, searchTerm: string): Record<string, any[]> {
  const results: Record<string, any[]> = {
    commands: [],
    expressions: [],
    features: [],
    keywords: [],
    specialSymbols: [],
    codeExamples: []
  };
  
  // Search in commands
  results.commands = db.query(`
    SELECT id, name, description, syntax_canonical
    FROM commands
    WHERE name LIKE ?
       OR description LIKE ?
       OR syntax_canonical LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  // Search in expressions
  results.expressions = db.query(`
    SELECT id, name, description, category
    FROM expressions
    WHERE name LIKE ?
       OR description LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  // Search in features
  results.features = db.query(`
    SELECT id, name, description, syntax_canonical
    FROM features
    WHERE name LIKE ?
       OR description LIKE ?
       OR syntax_canonical LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  // Search in keywords
  results.keywords = db.query(`
    SELECT id, name, description
    FROM keywords
    WHERE name LIKE ?
       OR description LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  // Search in special symbols
  results.specialSymbols = db.query(`
    SELECT id, name, symbol, description, symbol_type
    FROM special_symbols
    WHERE name LIKE ?
       OR description LIKE ?
       OR symbol LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  // Search in code examples
  results.codeExamples = db.query(`
    SELECT id, title, description, raw_code, difficulty
    FROM code_examples
    WHERE title LIKE ?
       OR description LIKE ?
       OR raw_code LIKE ?
    LIMIT 10
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`) as any[];
  
  return results;
}

/**
 * Gets all related elements for a given element
 */
function getRelatedElements(db: Database, elementId: string, elementType: string): any[] {
  return db.query(`
    SELECT 
      re.id,
      re.target_element_type,
      re.target_element_name
    FROM related_elements re
    WHERE re.source_element_id = ?
      AND re.source_element_type = ?
  `).all(elementId, elementType) as any[];
}

/**
 * Gets all examples for a given element
 */
function getElementExamples(db: Database, elementId: string, elementType: string): any[] {
  return db.query(`
    SELECT 
      id,
      example
    FROM syntax_examples
    WHERE element_id = ?
      AND element_type = ?
  `).all(elementId, elementType) as any[];
}

/**
 * Gets element details by ID and type
 */
function getElementDetails(db: Database, elementId: string, elementType: string): any {
  let element: any = null;
  
  switch (elementType) {
    case 'Command':
      element = db.query(`
        SELECT *
        FROM commands
        WHERE id = ?
      `).get(elementId);
      break;
    
    case 'Expression':
      element = db.query(`
        SELECT *
        FROM expressions
        WHERE id = ?
      `).get(elementId);
      
      // Get operators
      if (element) {
        element.operators = db.query(`
          SELECT operator
          FROM expression_operators
          WHERE expression_id = ?
        `).all(elementId).map((row: any) => row.operator);
      }
      break;
    
    case 'Feature':
      element = db.query(`
        SELECT *
        FROM features
        WHERE id = ?
      `).get(elementId);
      break;
    
    case 'Keyword':
      element = db.query(`
        SELECT *
        FROM keywords
        WHERE id = ?
      `).get(elementId);
      
      // Get usage contexts
      if (element) {
        element.usageContexts = db.query(`
          SELECT context
          FROM keyword_usage_contexts
          WHERE keyword_id = ?
        `).all(elementId).map((row: any) => row.context);
      }
      break;
    
    case 'SpecialSymbol':
      element = db.query(`
        SELECT *
        FROM special_symbols
        WHERE id = ?
      `).get(elementId);
      break;
    
    case 'CodeExample':
      element = db.query(`
        SELECT *
        FROM code_examples
        WHERE id = ?
      `).get(elementId);
      break;
    
    default:
      break;
  }
  
  if (element) {
    // Get tags
    element.tags = db.query(`
      SELECT tag
      FROM tags
      WHERE element_id = ?
        AND element_type = ?
    `).all(elementId, elementType).map((row: any) => row.tag);
    
    // Get examples if not a code example itself
    if (elementType !== 'CodeExample') {
      element.examples = getElementExamples(db, elementId, elementType);
      
      // Get related code examples
      element.codeExamples = getRelatedCodeExamples(db, elementId);
    }
    
    // Get related elements
    element.relatedElements = getRelatedElements(db, elementId, elementType);
    
    // If this is a code example, get related grammar elements
    if (elementType === 'CodeExample') {
      element.grammarElements = getCodeExampleGrammarElements(db, elementId);
    }
    
    // Get source info if applicable
    if (element.source_info_id) {
      element.sourceInfo = db.query(`
        SELECT *
        FROM source_info
        WHERE id = ?
      `).get(element.source_info_id);
    }
  }
  
  return element;
}

/**
 * Gets all code examples related to a grammar element
 */
function getRelatedCodeExamples(db: Database, grammarElementId: string): any[] {
  return db.query(`
    SELECT 
      ce.*
    FROM code_examples ce
    JOIN code_example_grammar_elements cege ON ce.id = cege.code_example_id
    WHERE cege.grammar_element_id = ?
    LIMIT 10
  `).all(grammarElementId) as any[];
}

/**
 * Gets all grammar elements used in a code example
 */
function getCodeExampleGrammarElements(db: Database, codeExampleId: string): any[] {
  const relations = db.query(`
    SELECT 
      grammar_element_id,
      grammar_element_type
    FROM code_example_grammar_elements
    WHERE code_example_id = ?
  `).all(codeExampleId) as any[];
  
  // For each relation, get the actual element details
  const elements = [];
  for (const relation of relations) {
    let element = null;
    switch (relation.grammar_element_type) {
      case 'Command':
        element = db.query(`
          SELECT id, name, description
          FROM commands
          WHERE id = ?
        `).get(relation.grammar_element_id);
        break;
      
      case 'Expression':
        element = db.query(`
          SELECT id, name, description, category
          FROM expressions
          WHERE id = ?
        `).get(relation.grammar_element_id);
        break;
      
      case 'Feature':
        element = db.query(`
          SELECT id, name, description
          FROM features
          WHERE id = ?
        `).get(relation.grammar_element_id);
        break;
      
      case 'Keyword':
        element = db.query(`
          SELECT id, name, description
          FROM keywords
          WHERE id = ?
        `).get(relation.grammar_element_id);
        break;
      
      case 'SpecialSymbol':
        element = db.query(`
          SELECT id, name, symbol, description
          FROM special_symbols
          WHERE id = ?
        `).get(relation.grammar_element_id);
        break;
    }
    
    if (element) {
      element.type = relation.grammar_element_type;
      elements.push(element);
    }
  }
  
  return elements;
}

/**
 * Gets all code examples in the database
 */
function getAllCodeExamples(db: Database, limit: number = 100, offset: number = 0): any[] {
  return db.query(`
    SELECT 
      id, 
      title, 
      description, 
      raw_code, 
      html_context,
      difficulty,
      status,
      created_at,
      updated_at
    FROM code_examples
    ORDER BY title
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];
}

/**
 * Searches for code examples by text in title, description, or code
 */
function searchCodeExamples(db: Database, searchTerm: string, limit: number = 10): any[] {
  return db.query(`
    SELECT 
      id, 
      title, 
      description, 
      raw_code, 
      html_context,
      difficulty,
      status
    FROM code_examples
    WHERE title LIKE ?
      OR description LIKE ?
      OR raw_code LIKE ?
    ORDER BY title
    LIMIT ?
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit) as any[];
}

/**
 * Gets code examples by difficulty level
 */
function getCodeExamplesByDifficulty(db: Database, difficulty: string, limit: number = 10): any[] {
  return db.query(`
    SELECT 
      id, 
      title, 
      description, 
      raw_code, 
      html_context,
      difficulty,
      status
    FROM code_examples
    WHERE difficulty = ?
    ORDER BY title
    LIMIT ?
  `).all(difficulty, limit) as any[];
}

/**
 * Gets code examples by tag
 */
function getCodeExamplesByTag(db: Database, tag: string, limit: number = 10): any[] {
  return db.query(`
    SELECT 
      ce.id, 
      ce.title, 
      ce.description, 
      ce.raw_code, 
      ce.html_context,
      ce.difficulty,
      ce.status
    FROM code_examples ce
    JOIN tags t ON ce.id = t.element_id
    WHERE t.tag = ?
      AND t.element_type = 'CodeExample'
    ORDER BY ce.title
    LIMIT ?
  `).all(tag, limit) as any[];
}

/**
 * Gets code examples by grammar element
 */
function getCodeExamplesByGrammarElement(db: Database, elementId: string, limit: number = 10): any[] {
  return db.query(`
    SELECT 
      ce.id, 
      ce.title, 
      ce.description, 
      ce.raw_code, 
      ce.html_context,
      ce.difficulty,
      ce.status
    FROM code_examples ce
    JOIN code_example_grammar_elements cege ON ce.id = cege.code_example_id
    WHERE cege.grammar_element_id = ?
    ORDER BY ce.title
    LIMIT ?
  `).all(elementId, limit) as any[];
}

/**
 * Find relevant examples that demonstrate similar patterns
 * to the provided code snippet
 */
function findSimilarExamples(db: Database, codeSnippet: string, limit: number = 5): any[] {
  // Extract potential keywords from the code snippet
  const lowerCode = codeSnippet.toLowerCase();
  const potentialKeywords = [];
  
  // Check for common commands
  const commonCommands = ["add", "remove", "toggle", "set", "put", "get", "fetch", "call", "log"];
  for (const cmd of commonCommands) {
    if (lowerCode.includes(cmd)) {
      potentialKeywords.push(cmd);
    }
  }
  
  // Check for event handling patterns
  if (lowerCode.includes("on ")) {
    potentialKeywords.push("on");
    
    // Try to extract event type
    const eventMatch = lowerCode.match(/on\s+([a-z]+)/);
    if (eventMatch && eventMatch[1]) {
      potentialKeywords.push(eventMatch[1]); // The event name (click, mouseover, etc.)
    }
  }
  
  // No keywords found, fallback to a more general search
  if (potentialKeywords.length === 0) {
    return searchCodeExamples(db, lowerCode.substring(0, 20), limit);
  }
  
  // Search for examples that contain these keywords
  let query = `
    SELECT 
      ce.id, 
      ce.title, 
      ce.description, 
      ce.raw_code, 
      ce.html_context,
      ce.difficulty,
      ce.status
    FROM code_examples ce
    WHERE 1=0
  `;
  
  const params = [];
  for (const keyword of potentialKeywords) {
    query += ` OR ce.raw_code LIKE ?`;
    params.push(`%${keyword}%`);
  }
  
  query += ` ORDER BY ce.title LIMIT ?`;
  params.push(limit);
  
  return db.query(query).all(...params) as any[];
}

/**
 * Gets code examples that might be useful for autocompletion
 * based on the current context
 */
function getAutocompletionExamples(
  db: Database, 
  prefix: string, 
  context: string = '', 
  limit: number = 3
): any[] {
  // First check if we have a command or feature match
  const commands = db.query(`
    SELECT id, name FROM commands
    WHERE name LIKE ?
    LIMIT 5
  `).all(`${prefix}%`) as any[];
  
  const features = db.query(`
    SELECT id, name FROM features
    WHERE name LIKE ?
    LIMIT 5
  `).all(`${prefix}%`) as any[];
  
  // Collect all matching element IDs
  const elementIds = [
    ...commands.map(c => c.id),
    ...features.map(f => f.id)
  ];
  
  if (elementIds.length === 0) {
    // No direct matches, try more general examples
    return findSimilarExamples(db, prefix + ' ' + context, limit);
  }
  
  // Find examples that use these elements
  let query = `
    SELECT 
      ce.id, 
      ce.title, 
      ce.description, 
      ce.raw_code, 
      ce.html_context,
      ce.difficulty,
      ce.status
    FROM code_examples ce
    JOIN code_example_grammar_elements cege ON ce.id = cege.code_example_id
    WHERE cege.grammar_element_id IN (${elementIds.map(() => '?').join(',')})
    ORDER BY ce.title
    LIMIT ?
  `;
  
  return db.query(query).all(...elementIds, limit) as any[];
}

/**
 * Run example queries on the database
 */
function runExampleQueries(): void {
  const db = openDatabase();
  
  try {
    console.log('=== DATABASE QUERY EXAMPLES ===\n');
    
    // Get counts of elements by type
    const counts = getElementCounts(db);
    console.log('Element Counts:');
    console.log(counts);
    console.log();
    
    // Search for elements containing 'set'
    console.log('Search Results for "set":');
    const searchResults = searchElements(db, 'set');
    
    // Display some results
    for (const type in searchResults) {
      if (searchResults[type].length > 0) {
        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)}:`);
        searchResults[type].forEach((element: any) => {
          console.log(`  - ${element.name || element.title}: ${element.description?.substring(0, 60)}...`);
        });
      }
    }
    console.log();
    
    // Get details for a specific element (if we have results)
    if (searchResults.commands.length > 0) {
      const elementId = searchResults.commands[0].id;
      console.log(`Details for command "${searchResults.commands[0].name}":`);
      const details = getElementDetails(db, elementId, 'Command');
      console.log(JSON.stringify(details, null, 2));
    }
    
    // Check if we have code examples
    if (counts.codeExamples > 0) {
      console.log('\n=== CODE EXAMPLE QUERIES ===\n');
      
      // Get some code examples
      const examples = getAllCodeExamples(db, 3);
      console.log(`First ${examples.length} code examples:`);
      for (const example of examples) {
        console.log(`- ${example.title}: ${example.description?.substring(0, 60)}...`);
      }
      
      // Show an example with its grammar elements
      if (examples.length > 0) {
        const exampleId = examples[0].id;
        console.log(`\nDetails for example "${examples[0].title}":`);
        const details = getElementDetails(db, exampleId, 'CodeExample');
        
        console.log(`Title: ${details.title}`);
        console.log(`Description: ${details.description}`);
        console.log(`Code: ${details.raw_code}`);
        
        if (details.grammarElements && details.grammarElements.length > 0) {
          console.log('\nRelated grammar elements:');
          for (const element of details.grammarElements) {
            console.log(`- ${element.type}: ${element.name}`);
          }
        } else {
          console.log('\nNo related grammar elements found.');
        }
      }
      
      // Show search by difficulty example
      const beginnerExamples = getCodeExamplesByDifficulty(db, 'Beginner', 3);
      console.log('\nBeginner examples:');
      for (const example of beginnerExamples) {
        console.log(`- ${example.title}`);
      }
      
      // Show autocompletion example
      const autocompleteExamples = getAutocompletionExamples(db, 'tog', 'on click');
      console.log('\nAutocompletion examples for "tog" with context "on click":');
      for (const example of autocompleteExamples) {
        console.log(`- ${example.title}: ${example.raw_code}`);
      }
    }
    
  } finally {
    db.close();
  }
}

// Export the query functions
export {
  openDatabase,
  getElementCounts,
  searchElements,
  getElementDetails,
  getRelatedElements,
  getElementExamples,
  getAllCodeExamples,
  searchCodeExamples,
  getCodeExamplesByDifficulty,
  getCodeExamplesByTag,
  getCodeExamplesByGrammarElement,
  getRelatedCodeExamples,
  getCodeExampleGrammarElements,
  findSimilarExamples,
  getAutocompletionExamples
};

// Run example queries if this script is executed directly
if (import.meta.main) {
  runExampleQueries();
}