import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Define the master list of expected language elements
// This would ideally be obtained from a more comprehensive source
const EXPECTED_ELEMENTS = {
  commands: [
    'add', 'append', 'async', 'beep', 'break', 'call', 'continue', 'default',
    'decrement', 'fetch', 'go', 'halt', 'hide', 'if', 'increment', 'js',
    'log', 'make', 'measure', 'pick', 'put', 'remove', 'render', 'repeat',
    'return', 'send', 'settle', 'set', 'show', 'take', 'tell', 'throw',
    'toggle', 'transition', 'trigger', 'wait'
  ],
  features: [
    'behavior', 'def', 'event-source', 'init', 'js', 'on', 'set', 'socket', 'worker'
  ],
  specialSymbols: [
    'me', 'my', 'it', 'its', 'result', 'you', 'your', '@'
  ],
  keywords: [
    'on', 'in', 'with', 'for', 'from', 'to', 'into', 'end', 'then', 'else', 'when',
    'after', 'before', 'until', 'while', 'unless', 'as', 'at', 'async', 'and', 'or',
    'not', 'by', 'if', 'repeat', 'of', 'target'
  ],
  expressions: [
    'attribute-ref', 'query-reference', 'it', 'as', 'block-literal', 'positional',
    'closest', 'id-reference', 'logical-operator', 'async', 'string',
    'beep', 'of', 'comparison-operator', 'time-expression', 'me',
    'relative-positional', 'cookies', 'you', 'no', 'class-reference', 'possessive'
  ]
};

type CompletenessReport = {
  timestamp: Date;
  summary: {
    totalExpectedElements: number;
    totalFoundElements: number;
    missingElements: number;
    extraElements: number;
    overallCompleteness: number;
  };
  byType: {
    [key: string]: {
      expected: number;
      found: number;
      missing: string[];
      unexpected: string[];
      completeness: number;
    }
  };
  recommendations: string[];
};

async function readCollectedElements(): Promise<{ [key: string]: string[] }> {
  const dataDir = path.join(__dirname, '../data/collected_json');
  const result: { [key: string]: string[] } = {
    commands: [],
    features: [],
    expressions: [],
    keywords: [],
    specialSymbols: []
  };
  
  try {
    // Read commands
    try {
      const commandsData = JSON.parse(await fs.readFile(path.join(dataDir, 'markdown_commands.json'), 'utf-8'));
      result.commands = commandsData.map((cmd: any) => cmd.name);
    } catch (e) {
      console.error('Error reading commands data:', e);
    }
    
    // Read features
    try {
      const featuresData = JSON.parse(await fs.readFile(path.join(dataDir, 'markdown_features.json'), 'utf-8'));
      result.features = featuresData.map((feature: any) => feature.name);
    } catch (e) {
      console.error('Error reading features data:', e);
    }
    
    // Read expressions
    try {
      const expressionsData = JSON.parse(await fs.readFile(path.join(dataDir, 'markdown_expressions.json'), 'utf-8'));
      result.expressions = expressionsData.map((expr: any) => expr.name);
    } catch (e) {
      console.error('Error reading expressions data:', e);
    }
    
    // Read keywords
    try {
      const keywordsData = JSON.parse(await fs.readFile(path.join(dataDir, 'markdown_keywords.json'), 'utf-8'));
      result.keywords = keywordsData.map((keyword: any) => keyword.name);
    } catch (e) {
      console.error('Error reading keywords data:', e);
    }
    
    // Read special symbols
    try {
      const symbolsData = JSON.parse(await fs.readFile(path.join(dataDir, 'markdown_special_symbols.json'), 'utf-8'));
      result.specialSymbols = symbolsData.map((symbol: any) => symbol.name);
    } catch (e) {
      console.error('Error reading special symbols data:', e);
    }
    
    return result;
  } catch (error) {
    console.error('Error reading collected elements:', error);
    return result;
  }
}

function checkCompleteness(collectedElements: { [key: string]: string[] }): CompletenessReport {
  const report: CompletenessReport = {
    timestamp: new Date(),
    summary: {
      totalExpectedElements: 0,
      totalFoundElements: 0,
      missingElements: 0,
      extraElements: 0,
      overallCompleteness: 0
    },
    byType: {},
    recommendations: []
  };
  
  // Calculate for each type
  let totalExpected = 0;
  let totalFound = 0;
  let totalMissing = 0;
  let totalExtra = 0;
  
  for (const type in EXPECTED_ELEMENTS) {
    const expected = EXPECTED_ELEMENTS[type as keyof typeof EXPECTED_ELEMENTS];
    const found = collectedElements[type] || [];
    
    // Find missing elements (in expected but not in found)
    const missing = expected.filter(element => !found.includes(element));
    
    // Find unexpected elements (in found but not in expected)
    const unexpected = found.filter(element => !expected.includes(element));
    
    // Calculate completeness percentage
    const completeness = expected.length > 0 ? 
      ((expected.length - missing.length) / expected.length) * 100 : 100;
    
    report.byType[type] = {
      expected: expected.length,
      found: found.length,
      missing,
      unexpected,
      completeness
    };
    
    // Update totals
    totalExpected += expected.length;
    totalFound += found.length;
    totalMissing += missing.length;
    totalExtra += unexpected.length;
    
    // Generate recommendations for this type
    if (missing.length > 0) {
      report.recommendations.push(`Add missing ${type}: ${missing.join(', ')}`);
    }
    
    if (unexpected.length > 0) {
      report.recommendations.push(`Verify unexpected ${type}: ${unexpected.join(', ')}`);
    }
  }
  
  // Calculate overall completeness
  report.summary = {
    totalExpectedElements: totalExpected,
    totalFoundElements: totalFound,
    missingElements: totalMissing,
    extraElements: totalExtra,
    overallCompleteness: totalExpected > 0 ? 
      ((totalExpected - totalMissing) / totalExpected) * 100 : 100
  };
  
  // Add overall recommendations
  if (report.summary.overallCompleteness < 100) {
    report.recommendations.push(
      `Focus on completing the missing elements to improve overall completeness (${report.summary.overallCompleteness.toFixed(1)}%)`
    );
  }
  
  // Add cross-reference recommendations
  const typesWithLowCoverage = Object.entries(report.byType)
    .filter(([_, data]) => data.completeness < 90)
    .map(([type, _]) => type);
  
  if (typesWithLowCoverage.length > 0) {
    report.recommendations.push(
      `Prioritize completing the following element types: ${typesWithLowCoverage.join(', ')}`
    );
  }
  
  return report;
}

async function main() {
  console.log('Running completeness check for language elements...');
  
  const collectedElements = await readCollectedElements();
  const report = checkCompleteness(collectedElements);
  
  console.log('\n===== COMPLETENESS REPORT =====');
  console.log(`Generated on: ${report.timestamp.toISOString()}`);
  
  console.log('\n--- SUMMARY ---');
  console.log(`Total Expected Elements: ${report.summary.totalExpectedElements}`);
  console.log(`Total Found Elements: ${report.summary.totalFoundElements}`);
  console.log(`Missing Elements: ${report.summary.missingElements}`);
  console.log(`Unexpected Elements: ${report.summary.extraElements}`);
  console.log(`Overall Completeness: ${report.summary.overallCompleteness.toFixed(1)}%`);
  
  console.log('\n--- BY ELEMENT TYPE ---');
  for (const type in report.byType) {
    const data = report.byType[type];
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`Expected: ${data.expected}, Found: ${data.found}`);
    console.log(`Completeness: ${data.completeness.toFixed(1)}%`);
    
    if (data.missing.length > 0) {
      console.log(`Missing: ${data.missing.join(', ')}`);
    }
    
    if (data.unexpected.length > 0) {
      console.log(`Unexpected: ${data.unexpected.join(', ')}`);
    }
  }
  
  console.log('\n--- RECOMMENDATIONS ---');
  report.recommendations.forEach((recommendation, index) => {
    console.log(`${index + 1}. ${recommendation}`);
  });
  
  // Save report to file
  const reportPath = path.join(__dirname, '../data/completeness-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkCompleteness };