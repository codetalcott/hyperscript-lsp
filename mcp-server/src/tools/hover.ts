import { DatabaseService } from '../services/database-service.js';

export const hoverTool = {
  name: 'get_hover_info',
  description: 'Get detailed documentation for a hyperscript element',
  inputSchema: {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: 'Element name to get documentation for'
      }
    },
    required: ['element']
  },
  
  async execute(args: { element: string }) {
    const db = new DatabaseService();
    
    try {
      const info = db.getElementInfo(args.element);
      
      if (!info) {
        return {
          content: [{
            type: 'text',
            text: `No information found for "${args.element}". Try searching for it with the search tool.`
          }]
        };
      }
      
      let text = `## ${info.name} (${info.type})\n\n`;
      
      if (info.description) {
        text += `${info.description}\n\n`;
      }
      
      if (info.syntax) {
        text += `**Syntax:** \`${info.syntax}\`\n\n`;
      }
      
      if (info.examples && info.examples.length > 0) {
        text += `**Examples:**\n\n`;
        info.examples.forEach((ex: any) => {
          if (ex.title) {
            text += `*${ex.title}*\n`;
          }
          text += `\`\`\`hyperscript\n${ex.code}\n\`\`\`\n\n`;
        });
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