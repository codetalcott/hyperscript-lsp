import { DatabaseService } from '../services/database-service.js';

export const searchTool = {
  name: 'search_language_elements',
  description: 'Search for hyperscript language elements in the database',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      type: {
        type: 'string',
        enum: ['command', 'keyword', 'expression', 'feature', 'symbol', 'all'],
        description: 'Type of element to search for (default: all)'
      }
    },
    required: ['query']
  },
  
  async execute(args: { query: string; type?: string }) {
    const db = new DatabaseService();
    
    try {
      const results = db.searchElements(args.query, args.type || 'all');
      
      let text = `## Search results for "${args.query}"`;
      if (args.type && args.type !== 'all') {
        text += ` (${args.type}s only)`;
      }
      text += '\n\n';
      
      const formatSection = (items: any[], title: string) => {
        if (!items || items.length === 0) return '';
        
        let section = `### ${title} (${items.length})\n\n`;
        items.forEach(item => {
          section += `• **${item.name}**`;
          if (item.syntax) {
            section += ` - \`${item.syntax}\``;
          }
          if (item.description) {
            const desc = item.description.split('\n')[0];
            section += `\n  ${desc.length > 100 ? desc.substring(0, 100) + '...' : desc}`;
          }
          section += '\n';
        });
        section += '\n';
        return section;
      };
      
      if (args.type === 'all' || !args.type) {
        text += formatSection(results.commands, 'Commands');
        text += formatSection(results.keywords, 'Keywords');
        text += formatSection(results.expressions, 'Expressions');
        text += formatSection(results.features, 'Features');
        text += formatSection(results.specialSymbols, 'Special Symbols');
        
        const total = (results.commands?.length || 0) + 
                     (results.keywords?.length || 0) + 
                     (results.expressions?.length || 0) + 
                     (results.features?.length || 0) + 
                     (results.specialSymbols?.length || 0);
        
        if (total === 0) {
          text = `No results found for "${args.query}"`;
        }
      } else {
        const items = Array.isArray(results) ? results : [];
        text += formatSection(items, args.type.charAt(0).toUpperCase() + args.type.slice(1) + 's');
        
        if (items.length === 0) {
          text = `No ${args.type}s found for "${args.query}"`;
        }
      }
      
      return {
        content: [{
          type: 'text',
          text
        }]
      };
    } finally {
      db.close();
    }
  }
};