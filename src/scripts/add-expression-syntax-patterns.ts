#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import * as path from 'node:path';

const SCRIPT_DIR = import.meta.dir;
const DB_PATH = path.join(SCRIPT_DIR, '..', 'hyperscript.db');

// Expression syntax patterns based on hyperscript documentation
const EXPRESSION_SYNTAX_PATTERNS = {
  'attribute-ref': '[@<attribute-name>[=<value>]]',
  'query-reference': '<css-selector>',
  'it': 'it',
  'as': '<expression> as <type>',
  'block-literal': '```\n<content>\n```',
  'positional': 'first | last | <number>',
  'closest': 'closest <css-selector> [to <element>]',
  'id-reference': '#<id-name>',
  'logical-operator': '<expression> (and | or) <expression>',
  'async': 'async <expression>',
  'string': '"<text>" | \'<text>\' | `<text>`',
  'beep': 'beep!',
  'of': '<property> of <object>',
  'comparison-operator': '<expression> (is | is not | < | > | <= | >= | == | !=) <expression>',
  'time-expression': '<number> (s | ms | seconds | milliseconds)',
  'me': 'me',
  'relative-positional': 'next | previous | first | last',
  'cookies': 'cookies',
  'you': 'you',
  'no': 'no <expression>',
  'class-reference': '.<class-name>',
  'possessive': '<element>\'s <property>'
};

async function addSyntaxPatterns() {
  const db = new Database(DB_PATH);
  
  try {
    // First, add the syntax column if it doesn't exist
    console.log("Adding syntax column to expressions table if needed...");
    try {
      db.run(`
        ALTER TABLE expressions 
        ADD COLUMN syntax TEXT
      `);
      console.log("Added syntax column to expressions table");
    } catch (error) {
      console.log("Syntax column already exists or error adding it");
    }
    
    // Update each expression with its syntax pattern
    const updateStmt = db.prepare(`
      UPDATE expressions 
      SET syntax = ? 
      WHERE name = ?
    `);
    
    let updated = 0;
    for (const [name, syntax] of Object.entries(EXPRESSION_SYNTAX_PATTERNS)) {
      const result = updateStmt.run(syntax, name);
      if (result.changes > 0) {
        console.log(`✓ Updated ${name} with syntax: ${syntax}`);
        updated++;
      } else {
        console.log(`✗ Could not find expression: ${name}`);
      }
    }
    
    console.log(`\nTotal expressions updated: ${updated}/${Object.keys(EXPRESSION_SYNTAX_PATTERNS).length}`);
    
    // Verify the updates
    console.log("\nVerifying updates:");
    const expressions = db.query(`
      SELECT name, syntax 
      FROM expressions 
      WHERE syntax IS NOT NULL 
      ORDER BY name
    `).all();
    
    console.log(`Found ${expressions.length} expressions with syntax patterns`);
    
  } catch (error) {
    console.error("Error adding syntax patterns:", error);
  } finally {
    db.close();
  }
}

// Run the script
addSyntaxPatterns();