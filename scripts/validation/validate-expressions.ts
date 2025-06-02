import { ExpressionDefinitionSchema, ExpressionCategoryEnum } from '../../schemas';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const EXPRESSIONS_JSON_PATH = path.join(__dirname, '../data/collected_json/markdown_expressions.json');

type ValidationReport = {
  totalExpressions: number;
  validExpressions: number;
  invalidExpressions: number;
  missingRequiredFields: Record<string, number>;
  validationErrors: Array<{ 
    name: string; 
    error: string; 
  }>;
  categoryDistribution: Record<string, number>;
  expressionsWithoutSyntaxPatterns: number;
  expressionsWithoutExamples: number;
  suggestedImprovements: Array<{
    name: string;
    suggestions: string[];
  }>;
};

async function readExpressionsData(): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(EXPRESSIONS_JSON_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading expressions data:', error);
    return [];
  }
}

function validateExpressions(expressions: any[]): ValidationReport {
  const report: ValidationReport = {
    totalExpressions: expressions.length,
    validExpressions: 0,
    invalidExpressions: 0,
    missingRequiredFields: {},
    validationErrors: [],
    categoryDistribution: {},
    expressionsWithoutSyntaxPatterns: 0,
    expressionsWithoutExamples: 0,
    suggestedImprovements: [],
  };

  // Initialize category distribution with all possible values from enum
  const categories = Object.values(ExpressionCategoryEnum.Values);
  categories.forEach(category => {
    report.categoryDistribution[category] = 0;
  });

  for (const expression of expressions) {
    try {
      // Convert string dates to Date objects if needed
      if (expression.created_at && typeof expression.created_at === 'string') {
        expression.created_at = new Date(expression.created_at);
      }
      if (expression.updated_at && typeof expression.updated_at === 'string') {
        expression.updated_at = new Date(expression.updated_at);
      }
      
      // Validate against schema
      ExpressionDefinitionSchema.parse(expression);
      report.validExpressions++;

      // Track category distribution
      const category = expression.category;
      if (category) {
        report.categoryDistribution[category] = (report.categoryDistribution[category] || 0) + 1;
      }

      // Check for expressions without syntax patterns
      if (!expression.syntax_patterns || expression.syntax_patterns.length === 0) {
        report.expressionsWithoutSyntaxPatterns++;
      }

      // Check for expressions without examples
      if (!expression.example_usage || expression.example_usage.length === 0) {
        report.expressionsWithoutExamples++;
      }

      // Generate improvement suggestions
      const suggestions: string[] = [];
      if (!expression.description || expression.description === 'N/A' || expression.description.length < 20) {
        suggestions.push('Add a more detailed description');
      }
      if (!expression.syntax_patterns || expression.syntax_patterns.length === 0) {
        suggestions.push('Add syntax patterns');
      }
      if (!expression.example_usage || expression.example_usage.length === 0) {
        suggestions.push('Add example usage');
      }
      if (!expression.evaluates_to && expression.category !== 'Other') {
        suggestions.push('Add information about what this expression evaluates to');
      }

      if (suggestions.length > 0) {
        report.suggestedImprovements.push({
          name: expression.name,
          suggestions
        });
      }

    } catch (error) {
      report.invalidExpressions++;
      
      if (error instanceof z.ZodError) {
        // Track missing required fields
        error.errors.forEach(err => {
          const field = err.path.join('.');
          report.missingRequiredFields[field] = (report.missingRequiredFields[field] || 0) + 1;
        });

        report.validationErrors.push({
          name: expression.name || 'Unknown',
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        report.validationErrors.push({
          name: expression.name || 'Unknown',
          error: (error as Error).message
        });
      }
    }
  }

  return report;
}

async function main() {
  console.log('Validating expressions data...');
  const expressions = await readExpressionsData();
  
  if (expressions.length === 0) {
    console.error('No expressions data found. Make sure to run scrape-cheerio.ts first.');
    return;
  }

  const report = validateExpressions(expressions);
  
  console.log('\n=== Expressions Validation Report ===');
  console.log(`Total Expressions: ${report.totalExpressions}`);
  console.log(`Valid Expressions: ${report.validExpressions}`);
  console.log(`Invalid Expressions: ${report.invalidExpressions}`);
  
  if (report.invalidExpressions > 0) {
    console.log('\n--- Missing Required Fields ---');
    Object.entries(report.missingRequiredFields)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        console.log(`${field}: ${count} expressions`);
      });
    
    console.log('\n--- Validation Errors ---');
    report.validationErrors.forEach(error => {
      console.log(`${error.name}: ${error.error}`);
    });
  }
  
  console.log('\n--- Category Distribution ---');
  Object.entries(report.categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`${category}: ${count} expressions (${((count / report.totalExpressions) * 100).toFixed(1)}%)`);
    });
  
  console.log('\n--- Missing Documentation ---');
  console.log(`Expressions without syntax patterns: ${report.expressionsWithoutSyntaxPatterns}`);
  console.log(`Expressions without examples: ${report.expressionsWithoutExamples}`);
  
  console.log('\n--- Improvement Suggestions ---');
  report.suggestedImprovements.forEach(item => {
    console.log(`${item.name}:`);
    item.suggestions.forEach(suggestion => {
      console.log(`  - ${suggestion}`);
    });
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export { validateExpressions, readExpressionsData };