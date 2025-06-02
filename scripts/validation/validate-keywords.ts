import { KeywordDefinitionSchema } from '../../schemas';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const KEYWORDS_JSON_PATH = path.join(__dirname, '../data/collected_json/markdown_keywords.json');

type ValidationReport = {
  totalKeywords: number;
  validKeywords: number;
  invalidKeywords: number;
  missingRequiredFields: Record<string, number>;
  validationErrors: Array<{ 
    name: string; 
    error: string; 
  }>;
  usageContextDistribution: {
    keywordsWithoutContext: number;
    keywordsWithSingleContext: number;
    keywordsWithMultipleContexts: number;
    avgContextsPerKeyword: number;
  };
  relatedElementsDistribution: {
    elementTypes: Record<string, number>;
    totalRelatedElements: number;
    avgRelatedElementsPerKeyword: number;
  };
  suggestedImprovements: Array<{
    name: string;
    suggestions: string[];
  }>;
};

async function readKeywordsData(): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(KEYWORDS_JSON_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading keywords data:', error);
    return [];
  }
}

function validateKeywords(keywords: any[]): ValidationReport {
  const report: ValidationReport = {
    totalKeywords: keywords.length,
    validKeywords: 0,
    invalidKeywords: 0,
    missingRequiredFields: {},
    validationErrors: [],
    usageContextDistribution: {
      keywordsWithoutContext: 0,
      keywordsWithSingleContext: 0,
      keywordsWithMultipleContexts: 0,
      avgContextsPerKeyword: 0,
    },
    relatedElementsDistribution: {
      elementTypes: {},
      totalRelatedElements: 0,
      avgRelatedElementsPerKeyword: 0,
    },
    suggestedImprovements: [],
  };

  let totalContexts = 0;
  let totalRelatedElements = 0;

  for (const keyword of keywords) {
    try {
      // Convert string dates to Date objects if needed
      if (keyword.created_at && typeof keyword.created_at === 'string') {
        keyword.created_at = new Date(keyword.created_at);
      }
      if (keyword.updated_at && typeof keyword.updated_at === 'string') {
        keyword.updated_at = new Date(keyword.updated_at);
      }
      
      // Validate against schema
      KeywordDefinitionSchema.parse(keyword);
      report.validKeywords++;

      // Track usage context stats
      const contextCount = keyword.usage_context?.length || 0;
      totalContexts += contextCount;
      
      if (contextCount === 0) {
        report.usageContextDistribution.keywordsWithoutContext++;
      } else if (contextCount === 1) {
        report.usageContextDistribution.keywordsWithSingleContext++;
      } else {
        report.usageContextDistribution.keywordsWithMultipleContexts++;
      }

      // Track related elements stats
      if (keyword.related_elements && keyword.related_elements.length > 0) {
        totalRelatedElements += keyword.related_elements.length;
        
        keyword.related_elements.forEach((element: any) => {
          const elementType = element.element_type;
          report.relatedElementsDistribution.elementTypes[elementType] = 
            (report.relatedElementsDistribution.elementTypes[elementType] || 0) + 1;
        });
      }

      // Generate improvement suggestions
      const suggestions: string[] = [];
      if (!keyword.description || keyword.description === 'N/A' || keyword.description.length < 20) {
        suggestions.push('Add a more detailed description');
      }
      if (!keyword.usage_context || keyword.usage_context.length === 0) {
        suggestions.push('Add usage context examples');
      }
      if (!keyword.syntax_examples || keyword.syntax_examples.length === 0) {
        suggestions.push('Add syntax examples');
      }
      if (!keyword.related_elements || keyword.related_elements.length === 0) {
        suggestions.push('Add related elements');
      }

      if (suggestions.length > 0) {
        report.suggestedImprovements.push({
          name: keyword.name,
          suggestions
        });
      }

    } catch (error) {
      report.invalidKeywords++;
      
      if (error instanceof z.ZodError) {
        // Track missing required fields
        error.errors.forEach(err => {
          const field = err.path.join('.');
          report.missingRequiredFields[field] = (report.missingRequiredFields[field] || 0) + 1;
        });

        report.validationErrors.push({
          name: keyword.name || 'Unknown',
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        report.validationErrors.push({
          name: keyword.name || 'Unknown',
          error: (error as Error).message
        });
      }
    }
  }

  // Calculate averages
  report.usageContextDistribution.avgContextsPerKeyword = 
    keywords.length > 0 ? totalContexts / keywords.length : 0;
  
  report.relatedElementsDistribution.totalRelatedElements = totalRelatedElements;
  report.relatedElementsDistribution.avgRelatedElementsPerKeyword = 
    keywords.length > 0 ? totalRelatedElements / keywords.length : 0;

  return report;
}

async function main() {
  console.log('Validating keywords data...');
  const keywords = await readKeywordsData();
  
  if (keywords.length === 0) {
    console.error('No keywords data found. Make sure to run scrape-cheerio.ts first.');
    return;
  }

  const report = validateKeywords(keywords);
  
  console.log('\n=== Keywords Validation Report ===');
  console.log(`Total Keywords: ${report.totalKeywords}`);
  console.log(`Valid Keywords: ${report.validKeywords}`);
  console.log(`Invalid Keywords: ${report.invalidKeywords}`);
  
  if (report.invalidKeywords > 0) {
    console.log('\n--- Missing Required Fields ---');
    Object.entries(report.missingRequiredFields)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        console.log(`${field}: ${count} keywords`);
      });
    
    console.log('\n--- Validation Errors ---');
    report.validationErrors.forEach(error => {
      console.log(`${error.name}: ${error.error}`);
    });
  }
  
  console.log('\n--- Usage Context Distribution ---');
  console.log(`Keywords without context: ${report.usageContextDistribution.keywordsWithoutContext}`);
  console.log(`Keywords with a single context: ${report.usageContextDistribution.keywordsWithSingleContext}`);
  console.log(`Keywords with multiple contexts: ${report.usageContextDistribution.keywordsWithMultipleContexts}`);
  console.log(`Average contexts per keyword: ${report.usageContextDistribution.avgContextsPerKeyword.toFixed(2)}`);
  
  console.log('\n--- Related Elements Distribution ---');
  console.log(`Total related elements: ${report.relatedElementsDistribution.totalRelatedElements}`);
  console.log(`Average related elements per keyword: ${report.relatedElementsDistribution.avgRelatedElementsPerKeyword.toFixed(2)}`);
  console.log('Related element types:');
  Object.entries(report.relatedElementsDistribution.elementTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
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

export { validateKeywords, readKeywordsData };