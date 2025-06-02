import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

// Path configurations
const DATA_DIR = path.join(import.meta.dir, './data/collected_json');
const EXAMPLES_FILE = path.join(DATA_DIR, 'markdown_cookbook_examples.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'markdown_commands.json');
const EXPRESSIONS_FILE = path.join(DATA_DIR, 'markdown_expressions.json');
const FEATURES_FILE = path.join(DATA_DIR, 'markdown_features.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'markdown_keywords.json');
const SPECIAL_SYMBOLS_FILE = path.join(DATA_DIR, 'markdown_special_symbols.json');
const ENRICHED_EXAMPLES_FILE = path.join(DATA_DIR, 'markdown_cookbook_examples_enriched.json');

// Types for grammar elements
interface GrammarElement {
  id: string;
  name: string;
  elementType: string;
}

interface CommandDefinition extends GrammarElement {
  elementType: 'Command';
}

interface ExpressionDefinition extends GrammarElement {
  elementType: 'Expression';
  symbol?: string; // For special symbols
}

interface FeatureDefinition extends GrammarElement {
  elementType: 'Feature';
}

interface KeywordDefinition extends GrammarElement {
  elementType: 'Keyword';
}

interface SpecialSymbolDefinition extends GrammarElement {
  elementType: 'SpecialSymbol';
  symbol: string;
}

interface CodeExample {
  id: string;
  title: string;
  description: string;
  raw_code: string;
  html_context?: string;
  difficulty?: string;
  source_info?: any;
  related_grammar_element_ids?: string[];
  tags?: string[];
  created_at: Date;
  updated_at: Date;
  status: string;
}

interface GrammarElements {
  commands: CommandDefinition[];
  expressions: ExpressionDefinition[];
  features: FeatureDefinition[];
  keywords: KeywordDefinition[];
  specialSymbols: SpecialSymbolDefinition[];
}

/**
 * Reads a JSON file and returns its parsed content
 */
async function readJsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      console.error(`File not found: ${filePath}`);
      return [];
    }
    return await file.json() as T[];
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    return [];
  }
}

/**
 * Loads all grammar elements from JSON files
 */
async function loadGrammarElements(): Promise<GrammarElements> {
  console.log('Loading grammar elements...');

  const commands = await readJsonFile<CommandDefinition>(COMMANDS_FILE);
  const expressions = await readJsonFile<ExpressionDefinition>(EXPRESSIONS_FILE);
  const features = await readJsonFile<FeatureDefinition>(FEATURES_FILE);
  const keywords = await readJsonFile<KeywordDefinition>(KEYWORDS_FILE);
  const specialSymbols = await readJsonFile<SpecialSymbolDefinition>(SPECIAL_SYMBOLS_FILE);

  console.log(`Loaded ${commands.length} commands, ${expressions.length} expressions, ${features.length} features, ${keywords.length} keywords, and ${specialSymbols.length} special symbols.`);

  return {
    commands,
    expressions,
    features,
    keywords,
    specialSymbols
  };
}

/**
 * Detects grammar elements used in a code example
 */
function detectGrammarElements(example: CodeExample, elements: GrammarElements): string[] {
  const detectedElementIds: string[] = [];
  const codeText = example.raw_code.toLowerCase();

  // Helper function to check if a pattern is in the code with word boundaries
  const containsPattern = (pattern: string): boolean => {
    const escapedPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .toLowerCase();
    const regex = new RegExp(`\\b${escapedPattern}\\b`, 'i');
    return regex.test(codeText);
  };

  // Check for commands
  for (const command of elements.commands) {
    if (containsPattern(command.name)) {
      detectedElementIds.push(command.id);
    }
  }

  // Check for features
  for (const feature of elements.features) {
    if (containsPattern(feature.name)) {
      detectedElementIds.push(feature.id);
    }
  }

  // Check for keywords (with more careful matching since they're common words)
  for (const keyword of elements.keywords) {
    // We're more careful with keywords since they can be common words
    if (containsPattern(keyword.name)) {
      detectedElementIds.push(keyword.id);
    }
  }

  // Check for special symbols
  for (const symbol of elements.specialSymbols) {
    if (symbol.symbol === '@') {
      // Special case for @ symbol
      if (codeText.includes('@')) {
        detectedElementIds.push(symbol.id);
      }
    } else if (containsPattern(symbol.symbol)) {
      detectedElementIds.push(symbol.id);
    }
  }

  // Check for expressions (more challenging - we'll do basic checks)
  for (const expression of elements.expressions) {
    // Expressions often need more context to detect accurately
    if (containsPattern(expression.name)) {
      detectedElementIds.push(expression.id);
    }
  }

  return detectedElementIds;
}

/**
 * Enriches code examples with detected grammar elements
 */
async function enrichExamples(): Promise<void> {
  console.log('Starting example enrichment process...');

  // Load examples
  const examples = await readJsonFile<CodeExample>(EXAMPLES_FILE);
  if (examples.length === 0) {
    console.error('No examples found to process.');
    return;
  }
  console.log(`Loaded ${examples.length} examples from ${EXAMPLES_FILE}`);

  // Load grammar elements
  const elements = await loadGrammarElements();

  // Process each example
  const enrichedExamples: CodeExample[] = [];
  for (const example of examples) {
    // Detect grammar elements in the example
    const detectedElements = detectGrammarElements(example, elements);

    // Create an enriched copy of the example
    const enrichedExample: CodeExample = {
      ...example,
      related_grammar_element_ids: detectedElements,
      updated_at: new Date()
    };

    // Add tags based on detected elements
    if (!enrichedExample.tags) {
      enrichedExample.tags = [];
    }

    // Add difficulty tags if not present
    if (!enrichedExample.tags.includes(enrichedExample.difficulty?.toLowerCase() || 'beginner')) {
      enrichedExample.tags.push(enrichedExample.difficulty?.toLowerCase() || 'beginner');
    }

    // Add tags for grammar element types
    const elementTypes = new Set<string>();
    for (const id of detectedElements) {
      const command = elements.commands.find(c => c.id === id);
      if (command) {
        elementTypes.add('command');
        continue;
      }

      const feature = elements.features.find(f => f.id === id);
      if (feature) {
        elementTypes.add('feature');
        continue;
      }

      const expression = elements.expressions.find(e => e.id === id);
      if (expression) {
        elementTypes.add('expression');
        continue;
      }

      const keyword = elements.keywords.find(k => k.id === id);
      if (keyword) {
        elementTypes.add('keyword');
        continue;
      }

      const symbol = elements.specialSymbols.find(s => s.id === id);
      if (symbol) {
        elementTypes.add('special-symbol');
      }
    }

    // Add element type tags
    for (const type of elementTypes) {
      if (!enrichedExample.tags.includes(type)) {
        enrichedExample.tags.push(type);
      }
    }

    enrichedExamples.push(enrichedExample);
  }

  // Write the enriched examples to file
  try {
    console.log(`Writing ${enrichedExamples.length} enriched examples to ${ENRICHED_EXAMPLES_FILE}`);
    await Bun.write(ENRICHED_EXAMPLES_FILE, JSON.stringify(enrichedExamples, null, 2));
    console.log('Successfully wrote enriched examples file.');

    // Also update the original file
    await Bun.write(EXAMPLES_FILE, JSON.stringify(enrichedExamples, null, 2));
    console.log('Updated original examples file with enriched data.');
  } catch (error) {
    console.error('Error writing enriched examples file:', error);
  }

  // Print some statistics
  const totalDetectedElements = enrichedExamples.reduce(
    (total, example) => total + (example.related_grammar_element_ids?.length || 0), 
    0
  );
  
  console.log(`\nEnrichment Statistics:`);
  console.log(`Total examples processed: ${enrichedExamples.length}`);
  console.log(`Total grammar elements detected: ${totalDetectedElements}`);
  console.log(`Average elements per example: ${(totalDetectedElements / enrichedExamples.length).toFixed(2)}`);
  
  const examplesWithNoElements = enrichedExamples.filter(
    example => !example.related_grammar_element_ids || example.related_grammar_element_ids.length === 0
  ).length;
  
  console.log(`Examples with no detected elements: ${examplesWithNoElements} (${(examplesWithNoElements / enrichedExamples.length * 100).toFixed(1)}%)`);
}

// Main execution
if (import.meta.main) {
  enrichExamples()
    .then(() => console.log('Example enrichment complete!'))
    .catch(err => console.error('Error in example enrichment process:', err));
}