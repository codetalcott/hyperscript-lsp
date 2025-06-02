import { validateExpressions, readExpressionsData } from './validate-expressions';
import { validateKeywords, readKeywordsData } from './validate-keywords';
import { validateSpecialSymbols, readSpecialSymbolsData } from './validate-special-symbols';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type UnifiedValidationReport = {
  timestamp: Date;
  summary: {
    totalElements: number;
    validElements: number;
    invalidElements: number;
    validPercentage: number;
    completenessScore: number;
  };
  typeDistribution: {
    expressions: number;
    keywords: number;
    specialSymbols: number;
    commands: number;
    features: number;
  };
  issues: {
    criticalIssues: number;
    highPriorityIssues: number;
    mediumPriorityIssues: number;
    lowPriorityIssues: number;
  };
  improvementSuggestions: {
    total: number;
    byCategory: Record<string, number>;
  };
  crossReferenceIntegrity: {
    missingReferences: number;
    invalidReferences: number;
    percentageValid: number;
  };
};

async function checkCommandsAndFeatures(): Promise<{commands: number; features: number}> {
  // Check how many command and feature files exist
  try {
    const commandsPath = path.join(__dirname, '../data/collected_json/markdown_commands.json');
    const featuresPath = path.join(__dirname, '../data/collected_json/markdown_features.json');
    
    let commands = 0;
    let features = 0;
    
    try {
      const commandsData = JSON.parse(await fs.readFile(commandsPath, 'utf-8'));
      commands = commandsData.length;
    } catch (e) {
      console.error('Error reading commands data:', e);
    }
    
    try {
      const featuresData = JSON.parse(await fs.readFile(featuresPath, 'utf-8'));
      features = featuresData.length;
    } catch (e) {
      console.error('Error reading features data:', e);
    }
    
    return { commands, features };
  } catch (error) {
    console.error('Error checking commands and features:', error);
    return { commands: 0, features: 0 };
  }
}

async function runUnifiedValidation(): Promise<UnifiedValidationReport> {
  console.log('Running unified validation of all language elements...');
  
  // Read all data
  const expressions = await readExpressionsData();
  const keywords = await readKeywordsData();
  const specialSymbols = await readSpecialSymbolsData();
  const { commands, features } = await checkCommandsAndFeatures();
  
  // Run individual validations
  const expressionsReport = validateExpressions(expressions);
  const keywordsReport = validateKeywords(keywords);
  const specialSymbolsReport = validateSpecialSymbols(specialSymbols);
  
  // Calculate total elements and valid percentages
  const totalElements = expressions.length + keywords.length + specialSymbols.length + commands + features;
  const validElements = expressionsReport.validExpressions + keywordsReport.validKeywords + specialSymbolsReport.validSymbols + commands + features;
  const validPercentage = totalElements > 0 ? (validElements / totalElements) * 100 : 0;
  
  // Count improvement suggestions
  const suggestionsByCategory: Record<string, number> = {};
  let totalSuggestions = 0;
  
  // Count from expressions report
  expressionsReport.suggestedImprovements.forEach(item => {
    item.suggestions.forEach(suggestion => {
      const category = getCategoryFromSuggestion(suggestion);
      suggestionsByCategory[category] = (suggestionsByCategory[category] || 0) + 1;
      totalSuggestions++;
    });
  });
  
  // Count from keywords report
  keywordsReport.suggestedImprovements.forEach(item => {
    item.suggestions.forEach(suggestion => {
      const category = getCategoryFromSuggestion(suggestion);
      suggestionsByCategory[category] = (suggestionsByCategory[category] || 0) + 1;
      totalSuggestions++;
    });
  });
  
  // Count from special symbols report
  specialSymbolsReport.suggestedImprovements.forEach(item => {
    item.suggestions.forEach(suggestion => {
      const category = getCategoryFromSuggestion(suggestion);
      suggestionsByCategory[category] = (suggestionsByCategory[category] || 0) + 1;
      totalSuggestions++;
    });
  });
  
  // Calculate issue priorities
  const criticalIssues = expressionsReport.invalidExpressions + keywordsReport.invalidKeywords + specialSymbolsReport.invalidSymbols;
  const highPriorityIssues = expressionsReport.expressionsWithoutSyntaxPatterns;
  const mediumPriorityIssues = expressionsReport.expressionsWithoutExamples + 
                              keywordsReport.usageContextDistribution.keywordsWithoutContext + 
                              specialSymbolsReport.usageContextStats.symbolsWithoutContext;
  const lowPriorityIssues = totalSuggestions - criticalIssues - highPriorityIssues - mediumPriorityIssues;
  
  // Calculate cross-reference integrity (a more advanced metric would check actual references)
  const missingReferences = keywordsReport.suggestedImprovements.filter(item => 
    item.suggestions.includes('Add related elements')
  ).length;
  
  // Calculate completeness score (weighted average)
  const elementWeights = {
    expressions: 0.3,
    keywords: 0.2,
    specialSymbols: 0.2,
    commands: 0.15,
    features: 0.15
  };
  
  const expressionsCompleteness = expressions.length > 0 ? 
    (expressionsReport.validExpressions / expressions.length) * 100 : 0;
  const keywordsCompleteness = keywords.length > 0 ? 
    (keywordsReport.validKeywords / keywords.length) * 100 : 0;
  const specialSymbolsCompleteness = specialSymbols.length > 0 ? 
    (specialSymbolsReport.validSymbols / specialSymbols.length) * 100 : 0;
  
  const completenessScore = 
    expressionsCompleteness * elementWeights.expressions +
    keywordsCompleteness * elementWeights.keywords +
    specialSymbolsCompleteness * elementWeights.specialSymbols +
    100 * elementWeights.commands + // Assuming commands are all valid
    100 * elementWeights.features;  // Assuming features are all valid
  
  return {
    timestamp: new Date(),
    summary: {
      totalElements,
      validElements,
      invalidElements: totalElements - validElements,
      validPercentage,
      completenessScore
    },
    typeDistribution: {
      expressions: expressions.length,
      keywords: keywords.length,
      specialSymbols: specialSymbols.length,
      commands,
      features
    },
    issues: {
      criticalIssues,
      highPriorityIssues,
      mediumPriorityIssues,
      lowPriorityIssues
    },
    improvementSuggestions: {
      total: totalSuggestions,
      byCategory: suggestionsByCategory
    },
    crossReferenceIntegrity: {
      missingReferences,
      invalidReferences: 0, // Would require deeper analysis
      percentageValid: keywords.length > 0 ? 
        ((keywords.length - missingReferences) / keywords.length) * 100 : 100
    }
  };
}

function getCategoryFromSuggestion(suggestion: string): string {
  if (suggestion.includes('syntax')) return 'syntax';
  if (suggestion.includes('example')) return 'examples';
  if (suggestion.includes('description')) return 'descriptions';
  if (suggestion.includes('scope')) return 'scope';
  if (suggestion.includes('evaluates')) return 'typing';
  if (suggestion.includes('context')) return 'context';
  if (suggestion.includes('related')) return 'relationships';
  return 'other';
}

async function main() {
  const report = await runUnifiedValidation();
  
  console.log('\n===== UNIFIED VALIDATION REPORT =====');
  console.log(`Generated on: ${report.timestamp.toISOString()}`);
  
  console.log('\n--- SUMMARY ---');
  console.log(`Total Language Elements: ${report.summary.totalElements}`);
  console.log(`Valid Elements: ${report.summary.validElements} (${report.summary.validPercentage.toFixed(1)}%)`);
  console.log(`Invalid Elements: ${report.summary.invalidElements}`);
  console.log(`Overall Completeness Score: ${report.summary.completenessScore.toFixed(1)}%`);
  
  console.log('\n--- ELEMENT TYPE DISTRIBUTION ---');
  console.log(`Expressions: ${report.typeDistribution.expressions}`);
  console.log(`Keywords: ${report.typeDistribution.keywords}`);
  console.log(`Special Symbols: ${report.typeDistribution.specialSymbols}`);
  console.log(`Commands: ${report.typeDistribution.commands}`);
  console.log(`Features: ${report.typeDistribution.features}`);
  
  console.log('\n--- ISSUES ---');
  console.log(`Critical Issues: ${report.issues.criticalIssues}`);
  console.log(`High Priority Issues: ${report.issues.highPriorityIssues}`);
  console.log(`Medium Priority Issues: ${report.issues.mediumPriorityIssues}`);
  console.log(`Low Priority Issues: ${report.issues.lowPriorityIssues}`);
  
  console.log('\n--- IMPROVEMENT SUGGESTIONS ---');
  console.log(`Total Suggestions: ${report.improvementSuggestions.total}`);
  console.log('By Category:');
  Object.entries(report.improvementSuggestions.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
  
  console.log('\n--- CROSS-REFERENCE INTEGRITY ---');
  console.log(`Missing References: ${report.crossReferenceIntegrity.missingReferences}`);
  console.log(`Invalid References: ${report.crossReferenceIntegrity.invalidReferences}`);
  console.log(`Percentage Valid: ${report.crossReferenceIntegrity.percentageValid.toFixed(1)}%`);
  
  // Save report to file
  const reportPath = path.join(__dirname, '../data/validation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { runUnifiedValidation };