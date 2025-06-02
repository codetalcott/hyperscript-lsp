import { Database } from 'bun:sqlite';
import * as path from 'node:path';

const SCRIPT_DIR = import.meta.dir;
const DB_PATH = path.join(SCRIPT_DIR, '..', 'hyperscript.db');

// Open the database connection
const db = new Database(DB_PATH, { readonly: true });

// Function to count records in a table
function countRecords(table: string): number {
  return (db.query(`SELECT COUNT(*) as count FROM ${table}`).get() as any).count;
}

// Function to print table stats
function printTableStats(table: string, nameField: string = 'name'): void {
  const count = countRecords(table);
  console.log(`${table}: ${count} records`);
  
  if (count > 0) {
    const items = db.query(`SELECT ${nameField} FROM ${table} LIMIT 10`).all();
    console.log(`Sample ${nameField}s: ${items.map((item: any) => item[nameField]).join(', ')}`);
  }
}

// Print database overview
console.log("=== HYPERSCRIPT DATABASE OVERVIEW ===");

// Get counts for all tables
const tables = [
  'commands',
  'command_arguments',
  'expressions',
  'expression_operators',
  'features',
  'keywords',
  'keyword_usage_contexts',
  'special_symbols',
  'syntax_examples',
  'related_elements',
  'tags',
  'source_info'
];

console.log("\n--- TABLE COUNTS ---");
for (const table of tables) {
  const count = countRecords(table);
  console.log(`${table}: ${count} records`);
}

console.log("\n--- HYPERSCRIPT LANGUAGE ELEMENTS ---");

// Query commands
console.log("\nCOMMANDS:");
const commands = db.query('SELECT id, name, description, purpose FROM commands').all();
console.log(`Total commands: ${commands.length}`);
console.log("Sample commands:");
commands.slice(0, 5).forEach((cmd: any) => {
  console.log(`- ${cmd.name}: ${cmd.description ? cmd.description.split('\n')[0].substring(0, 80) + '...' : 'No description'}`);
});

// Query expressions
console.log("\nEXPRESSIONS:");
const expressions = db.query('SELECT id, name, description, category FROM expressions').all();
console.log(`Total expressions: ${expressions.length}`);
console.log("Sample expressions:");
expressions.slice(0, 5).forEach((expr: any) => {
  console.log(`- ${expr.name} (${expr.category}): ${expr.description ? expr.description.split('\n')[0].substring(0, 80) + '...' : 'No description'}`);
});

// Query features
console.log("\nFEATURES:");
const features = db.query('SELECT id, name, description FROM features').all();
console.log(`Total features: ${features.length}`);
console.log("Sample features:");
features.slice(0, 5).forEach((feature: any) => {
  console.log(`- ${feature.name}: ${feature.description ? feature.description.split('\n')[0].substring(0, 80) + '...' : 'No description'}`);
});

// Query keywords
console.log("\nKEYWORDS:");
const keywords = db.query('SELECT id, name, description FROM keywords').all();
console.log(`Total keywords: ${keywords.length}`);
console.log("Sample keywords:");
keywords.slice(0, 5).forEach((keyword: any) => {
  console.log(`- ${keyword.name}: ${keyword.description ? keyword.description.split('\n')[0].substring(0, 80) + '...' : 'No description'}`);
});

// Query special symbols
console.log("\nSPECIAL SYMBOLS:");
const specialSymbols = db.query('SELECT id, name, symbol, description FROM special_symbols').all();
console.log(`Total special symbols: ${specialSymbols.length}`);
console.log("Sample special symbols:");
specialSymbols.slice(0, 5).forEach((symbol: any) => {
  console.log(`- ${symbol.name} (${symbol.symbol}): ${symbol.description ? symbol.description.split('\n')[0].substring(0, 80) + '...' : 'No description'}`);
});

// Check for duplicate keywords
const keywordCounts = db.query('SELECT name, COUNT(*) as count FROM keywords GROUP BY name HAVING count > 1').all();
console.log("\nDuplicate keywords:", keywordCounts.length);
console.log(keywordCounts);

// Close the database
db.close();