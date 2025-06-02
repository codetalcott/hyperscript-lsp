import { Database } from 'bun:sqlite';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', '..', 'src', 'hyperscript.db');

export class DatabaseService {
  private db: Database;
  
  constructor() {
    this.db = new Database(DB_PATH, { readonly: true });
  }
  
  searchElements(query: string, type?: string) {
    const results: any = {};
    
    if (!type || type === 'all' || type === 'command') {
      results.commands = this.db.query(`
        SELECT name, description, syntax_canonical as syntax 
        FROM commands 
        WHERE name LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(`%${query}%`, `%${query}%`);
    }
    
    if (!type || type === 'all' || type === 'keyword') {
      results.keywords = this.db.query(`
        SELECT name, description 
        FROM keywords 
        WHERE name LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(`%${query}%`, `%${query}%`);
    }
    
    if (!type || type === 'all' || type === 'expression') {
      results.expressions = this.db.query(`
        SELECT name, description, syntax 
        FROM expressions 
        WHERE name LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(`%${query}%`, `%${query}%`);
    }
    
    if (!type || type === 'all' || type === 'feature') {
      results.features = this.db.query(`
        SELECT name, description, structure_description as syntax 
        FROM features 
        WHERE name LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(`%${query}%`, `%${query}%`);
    }
    
    if (!type || type === 'all' || type === 'symbol') {
      results.specialSymbols = this.db.query(`
        SELECT name, description, symbol as syntax 
        FROM special_symbols 
        WHERE name LIKE ? OR symbol LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    
    return type && type !== 'all' ? results[type + 's'] || [] : results;
  }
  
  getElementInfo(name: string) {
    // Try each table to find the element
    const tables = [
      { table: 'commands', type: 'command', syntaxField: 'syntax_canonical' },
      { table: 'keywords', type: 'keyword', syntaxField: null },
      { table: 'expressions', type: 'expression', syntaxField: 'syntax' },
      { table: 'features', type: 'feature', syntaxField: 'structure_description' },
      { table: 'special_symbols', type: 'symbol', syntaxField: 'symbol' }
    ];
    
    for (const { table, type, syntaxField } of tables) {
      const query = syntaxField 
        ? `SELECT name, description, ${syntaxField} as syntax FROM ${table} WHERE name = ? OR ${syntaxField} = ?`
        : `SELECT name, description FROM ${table} WHERE name = ?`;
      
      const result = syntaxField 
        ? this.db.query(query).get(name, name)
        : this.db.query(query).get(name);
      
      if (result) {
        // Get examples (simplified for now)
        const examples: any[] = [];
        
        return {
          ...result,
          type,
          examples
        };
      }
    }
    
    return null;
  }
  
  getCompletions(prefix: string, type?: string) {
    const results: any[] = [];
    
    const addResults = (items: any[], itemType: string) => {
      items.forEach(item => {
        results.push({
          label: item.name,
          detail: item.description?.split('\n')[0],
          kind: itemType
        });
      });
    };
    
    if (!type || type === 'command') {
      const commands = this.db.query(`
        SELECT name, description 
        FROM commands 
        WHERE name LIKE ?
        LIMIT 20
      `).all(`${prefix}%`);
      addResults(commands, 'command');
    }
    
    if (!type || type === 'keyword') {
      const keywords = this.db.query(`
        SELECT name, description 
        FROM keywords 
        WHERE name LIKE ?
        LIMIT 20
      `).all(`${prefix}%`);
      addResults(keywords, 'keyword');
    }
    
    if (!type || type === 'expression') {
      const expressions = this.db.query(`
        SELECT name, description 
        FROM expressions 
        WHERE name LIKE ?
        LIMIT 20
      `).all(`${prefix}%`);
      addResults(expressions, 'expression');
    }
    
    return results;
  }
  
  close() {
    this.db.close();
  }
}