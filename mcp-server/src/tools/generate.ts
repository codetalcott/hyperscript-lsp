import { GeneratorService } from '../services/generator-service.js';
import type { GeneratePattern } from '../types.js';

export const generateTool = {
  name: 'generate_hyperscript',
  description: 'Generate hyperscript code patterns and boilerplate',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        enum: [
          'event-handler',
          'fetch-request',
          'animation',
          'form-validation',
          'todo-item',
          'modal',
          'drag-drop',
          'infinite-scroll'
        ],
        description: 'Pattern to generate'
      },
      options: {
        type: 'object',
        description: 'Pattern-specific customization options',
        additionalProperties: true
      }
    },
    required: ['pattern']
  },
  
  async execute(args: { pattern: GeneratePattern; options?: any }) {
    const generator = new GeneratorService();
    
    try {
      const code = generator.generate(args.pattern, args.options);
      
      let text = `## Generated ${args.pattern.replace('-', ' ')} pattern\n\n`;
      
      if (args.options) {
        text += '**Customizations applied:**\n';
        Object.entries(args.options).forEach(([key, value]) => {
          text += `- ${key}: ${JSON.stringify(value)}\n`;
        });
        text += '\n';
      }
      
      text += '```hyperscript\n' + code + '\n```\n\n';
      
      // Add usage hints based on pattern
      const hints: Record<GeneratePattern, string> = {
        'event-handler': 'Add this to any element to handle events. Customize with different events and actions.',
        'fetch-request': 'Use this for AJAX requests. Customize the URL, method, and response handling.',
        'animation': 'Creates a reusable animation behavior. Attach with `_="install AnimationName"`.',
        'form-validation': 'Add to a form element. Customize the fields array for your form.',
        'todo-item': 'Complete todo list functionality. Customize the input and list IDs.',
        'modal': 'Modal dialog behavior. Customize the modal and trigger selectors.',
        'drag-drop': 'Drag and drop functionality. Customize the draggable and dropzone classes.',
        'infinite-scroll': 'Infinite scrolling for content. Customize the container and API URL.'
      };
      
      if (hints[args.pattern]) {
        text += `**Usage hint:** ${hints[args.pattern]}`;
      }
      
      return {
        content: [{
          type: 'text',
          text
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
};