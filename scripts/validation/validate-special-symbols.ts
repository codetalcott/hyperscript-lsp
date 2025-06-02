import { SpecialSymbolDefinitionSchema, SpecialSymbolTypeEnum } from '../../schemas';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const SPECIAL_SYMBOLS_JSON_PATH = path.join(__dirname, '../data/collected_json/markdown_special_symbols.json');

type ValidationReport = {
  totalSymbols: number;
  validSymbols: number;
  invalidSymbols: number;
  missingRequiredFields: Record<string, number>;
  validationErrors: Array<{ 
    name: string; 
    error: string; 
  }>;
  typeDistribution: Record<string, number>;
  usageContextStats: {
    symbolsWithoutContext: number;
    symbolsWithSingleContext: number;
    symbolsWithMultipleContexts: number;
    avgContextsPerSymbol: number;
  };
  scopeImplicationsStats: {
    symbolsWithScopeImplications: number;
    symbolsWithoutScopeImplications: number;
    percentageWithScopeImplications: number;
  };
  suggestedImprovements: Array<{
    name: string;
    suggestions: string[];
  }>;
};

async function readSpecialSymbolsData(): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(SPECIAL_SYMBOLS_JSON_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading special symbols data:', error);
    return [];
  }
}

function validateSpecialSymbols(symbols: any[]): ValidationReport {
  const report: ValidationReport = {
    totalSymbols: symbols.length,
    validSymbols: 0,
    invalidSymbols: 0,
    missingRequiredFields: {},
    validationErrors: [],
    typeDistribution: {},
    usageContextStats: {
      symbolsWithoutContext: 0,
      symbolsWithSingleContext: 0,
      symbolsWithMultipleContexts: 0,
      avgContextsPerSymbol: 0,
    },
    scopeImplicationsStats: {
      symbolsWithScopeImplications: 0,
      symbolsWithoutScopeImplications: 0,
      percentageWithScopeImplications: 0,
    },
    suggestedImprovements: [],
  };

  // Initialize type distribution with all possible values from enum
  const symbolTypes = Object.values(SpecialSymbolTypeEnum.Values);
  symbolTypes.forEach(type => {
    report.typeDistribution[type] = 0;
  });

  let totalContexts = 0;

  for (const symbol of symbols) {
    try {
      // Convert string dates to Date objects if needed
      if (symbol.created_at && typeof symbol.created_at === 'string') {
        symbol.created_at = new Date(symbol.created_at);
      }
      if (symbol.updated_at && typeof symbol.updated_at === 'string') {
        symbol.updated_at = new Date(symbol.updated_at);
      }
      
      // Validate against schema
      SpecialSymbolDefinitionSchema.parse(symbol);
      report.validSymbols++;

      // Track symbol type distribution
      const symbolType = symbol.symbol_type;
      if (symbolType) {
        report.typeDistribution[symbolType] = (report.typeDistribution[symbolType] || 0) + 1;
      }

      // Track usage context stats
      const contextCount = symbol.usage_context?.length || 0;
      totalContexts += contextCount;
      
      if (contextCount === 0) {
        report.usageContextStats.symbolsWithoutContext++;
      } else if (contextCount === 1) {
        report.usageContextStats.symbolsWithSingleContext++;
      } else {
        report.usageContextStats.symbolsWithMultipleContexts++;
      }

      // Track scope implications stats
      if (symbol.scope_implications) {
        report.scopeImplicationsStats.symbolsWithScopeImplications++;
      } else {
        report.scopeImplicationsStats.symbolsWithoutScopeImplications++;
      }

      // Generate improvement suggestions
      const suggestions: string[] = [];
      if (!symbol.description || symbol.description === 'N/A' || symbol.description.length < 20) {
        suggestions.push('Add a more detailed description');
      }
      if (!symbol.usage_context || symbol.usage_context.length === 0) {
        suggestions.push('Add usage context examples');
      }
      if (!symbol.syntax_examples || symbol.syntax_examples.length === 0) {
        suggestions.push('Add syntax examples');
      }
      if (!symbol.scope_implications && symbol.symbol_type === 'Variable') {
        suggestions.push('Add scope implications for this variable symbol');
      }
      if (!symbol.typical_value_or_referent) {
        suggestions.push('Add information about what this symbol typically refers to');
      }

      if (suggestions.length > 0) {
        report.suggestedImprovements.push({
          name: symbol.name,
          suggestions
        });
      }

    } catch (error) {
      report.invalidSymbols++;
      
      if (error instanceof z.ZodError) {
        // Track missing required fields
        error.errors.forEach(err => {
          const field = err.path.join('.');
          report.missingRequiredFields[field] = (report.missingRequiredFields[field] || 0) + 1;
        });

        report.validationErrors.push({
          name: symbol.name || 'Unknown',
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        report.validationErrors.push({
          name: symbol.name || 'Unknown',
          error: (error as Error).message
        });
      }
    }
  }

  // Calculate averages and percentages
  report.usageContextStats.avgContextsPerSymbol = 
    symbols.length > 0 ? totalContexts / symbols.length : 0;
  
  report.scopeImplicationsStats.percentageWithScopeImplications = 
    symbols.length > 0 ? 
    (report.scopeImplicationsStats.symbolsWithScopeImplications / symbols.length) * 100 : 0;

  return report;
}

async function main() {
  console.log('Validating special symbols data...');
  const symbols = await readSpecialSymbolsData();
  
  if (symbols.length === 0) {
    console.error('No special symbols data found. Make sure to run scrape-cheerio.ts first.');
    return;
  }

  const report = validateSpecialSymbols(symbols);
  
  console.log('\n=== Special Symbols Validation Report ===');
  console.log(`Total Special Symbols: ${report.totalSymbols}`);
  console.log(`Valid Special Symbols: ${report.validSymbols}`);
  console.log(`Invalid Special Symbols: ${report.invalidSymbols}`);
  
  if (report.invalidSymbols > 0) {
    console.log('\n--- Missing Required Fields ---');
    Object.entries(report.missingRequiredFields)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        console.log(`${field}: ${count} symbols`);
      });
    
    console.log('\n--- Validation Errors ---');
    report.validationErrors.forEach(error => {
      console.log(`${error.name}: ${error.error}`);
    });
  }
  
  console.log('\n--- Symbol Type Distribution ---');
  Object.entries(report.typeDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`${type}: ${count} symbols (${((count / report.totalSymbols) * 100).toFixed(1)}%)`);
    });
  
  console.log('\n--- Usage Context Statistics ---');
  console.log(`Symbols without context: ${report.usageContextStats.symbolsWithoutContext}`);
  console.log(`Symbols with a single context: ${report.usageContextStats.symbolsWithSingleContext}`);
  console.log(`Symbols with multiple contexts: ${report.usageContextStats.symbolsWithMultipleContexts}`);
  console.log(`Average contexts per symbol: ${report.usageContextStats.avgContextsPerSymbol.toFixed(2)}`);
  
  console.log('\n--- Scope Implications Statistics ---');
  console.log(`Symbols with scope implications: ${report.scopeImplicationsStats.symbolsWithScopeImplications}`);
  console.log(`Symbols without scope implications: ${report.scopeImplicationsStats.symbolsWithoutScopeImplications}`);
  console.log(`Percentage with scope implications: ${report.scopeImplicationsStats.percentageWithScopeImplications.toFixed(1)}%`);
  
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

export { validateSpecialSymbols, readSpecialSymbolsData };