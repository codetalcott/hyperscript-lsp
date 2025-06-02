import { Database } from 'bun:sqlite';
import * as path from 'node:path';

const SCRIPT_DIR = import.meta.dir;
const DB_PATH = path.join(SCRIPT_DIR, '..', 'hyperscript.db');

// Open the database connection
const db = new Database(DB_PATH, { readonly: true });

/**
 * Simulates LSP autocompletion for commands
 * @param prefix Command prefix to search for
 * @returns Array of matching command information
 */
function autocompleteCommands(prefix: string = '') {
  const query = `
    SELECT 
      name, 
      description,
      syntax_canonical
    FROM 
      commands
    WHERE 
      name LIKE ? 
    ORDER BY 
      name
  `;
  
  return db.query(query).all(`${prefix}%`);
}

/**
 * Simulates LSP autocompletion for features
 * @param prefix Feature prefix to search for
 * @returns Array of matching feature information
 */
function autocompleteFeatures(prefix: string = '') {
  const query = `
    SELECT 
      name, 
      description,
      syntax_canonical
    FROM 
      features
    WHERE 
      name LIKE ? 
    ORDER BY 
      name
  `;
  
  return db.query(query).all(`${prefix}%`);
}

/**
 * Simulates LSP hover information for any hyperscript element
 * @param elementName Element name to search for
 * @returns Information for the element if found
 */
function getHoverInfo(elementName: string) {
  // Try to find the element in each table
  const queries = [
    {
      type: 'Command',
      query: `SELECT name, description, syntax_canonical, purpose FROM commands WHERE name = ?`
    },
    {
      type: 'Expression',
      query: `SELECT name, description, category FROM expressions WHERE name = ?`
    },
    {
      type: 'Feature',
      query: `SELECT name, description, syntax_canonical FROM features WHERE name = ?`
    },
    {
      type: 'Keyword',
      query: `SELECT name, description, context_of_use FROM keywords WHERE name = ?`
    },
    {
      type: 'Special Symbol',
      query: `SELECT name, description, symbol, symbol_type FROM special_symbols WHERE name = ? OR symbol = ?`
    }
  ];
  
  for (const { type, query } of queries) {
    const result = type === 'Special Symbol' 
      ? db.query(query).get(elementName, elementName)
      : db.query(query).get(elementName);
    
    if (result) {
      return { type, ...result };
    }
  }
  
  return null;
}

/**
 * Get syntax examples for an element
 * @param elementName Element name to get examples for
 * @param elementType Type of the element
 * @returns Array of syntax examples
 */
function getSyntaxExamples(elementName: string, elementType: string) {
  // First get the element ID
  const query = `SELECT id FROM ${elementType.toLowerCase()}s WHERE name = ?`;
  const element = db.query(query).get(elementName);
  
  if (!element) return [];
  
  // Get syntax examples for this element
  const examplesQuery = `
    SELECT 
      example
    FROM 
      syntax_examples
    WHERE 
      element_id = ? AND
      element_type = ?
  `;
  
  return db.query(examplesQuery).all(element.id, elementType);
}

// Example: Get autocompletion for commands starting with 't'
const commandCompletions = autocompleteCommands('t');
console.log('Command autocompletions for "t":');
commandCompletions.forEach((cmd: any) => {
  console.log(`- ${cmd.name}: ${cmd.description ? cmd.description.substring(0, 60) + '...' : 'No description'}`);
});

// Example: Get hover info for 'toggle'
const toggleInfo = getHoverInfo('toggle');
console.log('\nHover information for "toggle":');
console.log(toggleInfo);

// Example: Get syntax examples for 'toggle'
if (toggleInfo) {
  const examples = getSyntaxExamples('toggle', toggleInfo.type);
  console.log('\nSyntax examples for "toggle":');
  examples.forEach((ex: any, i: number) => {
    console.log(`\nExample ${i + 1}:`);
    console.log(ex.example);
  });
}

// Example: Get autocompletion for features starting with 'b'
const featureCompletions = autocompleteFeatures('b');
console.log('\nFeature autocompletions for "b":');
featureCompletions.forEach((feature: any) => {
  console.log(`- ${feature.name}: ${feature.description ? feature.description.substring(0, 60) + '...' : 'No description'}`);
});

// Close the database
db.close();

console.log('\nThese examples demonstrate how we can use the database for LSP functionality:');
console.log('1. Autocompletion - Suggest commands, features, expressions, etc.');
console.log('2. Hover information - Show documentation when hovering over elements');
console.log('3. Syntax examples - Provide usage examples for hyperscript elements');