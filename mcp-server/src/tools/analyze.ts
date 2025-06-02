import { AnalyzerService } from '../services/analyzer-service.js';
import type { AnalyzeResult } from '../types.js';

export const analyzeTool = {
  name: 'analyze_hyperscript',
  description: 'Analyze hyperscript code for syntax errors and potential issues',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Hyperscript code to analyze'
      }
    },
    required: ['code']
  },
  
  async execute(args: { code: string }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const analyzer = new AnalyzerService();
    const result = analyzer.analyze(args.code);
    
    if (result.diagnostics.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '✅ No syntax errors found! The code looks good.'
        }]
      };
    }
    
    const diagnosticText = result.diagnostics
      .map(d => {
        const icon = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️';
        return `${icon} Line ${d.line}: ${d.message}`;
      })
      .join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `Found ${result.diagnostics.length} issue(s):\n\n${diagnosticText}`
      }]
    };
  }
};