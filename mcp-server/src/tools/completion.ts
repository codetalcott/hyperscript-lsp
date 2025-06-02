import { DatabaseService } from '../services/database-service.js';
import { AnalyzerService } from '../services/analyzer-service.js';

export const completionTool = {
  name: 'get_completion',
  description: 'Get code completion suggestions for hyperscript at a specific position',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Current code context'
      },
      line: {
        type: 'number',
        description: 'Current line number (0-based)'
      },
      character: {
        type: 'number',
        description: 'Current character position in the line'
      }
    },
    required: ['code', 'line', 'character']
  },
  
  async execute(args: { code: string; line: number; character: number }) {
    const analyzer = new AnalyzerService();
    const db = new DatabaseService();
    
    try {
      // Get the word at the current position
      const currentWord = analyzer.findWordAtPosition(args.code, args.line, args.character);
      
      // Get completions from database
      const completions = db.getCompletions(currentWord);
      
      if (completions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No completions found for "${currentWord}"`
          }]
        };
      }
      
      const completionText = completions
        .slice(0, 10)
        .map(c => `• **${c.label}** (${c.kind}): ${c.detail || 'No description'}`)
        .join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `Found ${completions.length} completion(s) for "${currentWord}":\n\n${completionText}`
        }]
      };
    } finally {
      db.close();
    }
  }
};