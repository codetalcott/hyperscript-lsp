import MarkdownIt from 'markdown-it';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises'; // For directory listing and file reading
import * as path from 'node:path';      // For path manipulation

// Importing Zod schemas from the project root schemas.ts file
import {
  SourceInfoSchema,
  CommandDefinitionSchema,
  CodeExampleSchema,
  FeatureDefinitionSchema,
  ExpressionDefinitionSchema,
  ExpressionCategoryEnum,
  KeywordDefinitionSchema,
  SpecialSymbolDefinitionSchema,
  SpecialSymbolTypeEnum
} from '../schemas';

// Define types from imported schemas
export type CommandDefinition = z.infer<typeof CommandDefinitionSchema>;
export type CodeExample = z.infer<typeof CodeExampleSchema>;
export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;
export type ExpressionDefinition = z.infer<typeof ExpressionDefinitionSchema>; 
export type KeywordDefinition = z.infer<typeof KeywordDefinitionSchema>;
export type SpecialSymbolDefinition = z.infer<typeof SpecialSymbolDefinitionSchema>;


// **IMPORTANT**: Update these paths to point to the actual files/directories in your local clone
const LOCAL_REPO_ROOT_PATH = "../../www"; 
const COMMANDS_DIR_PATH = `${LOCAL_REPO_ROOT_PATH}/commands`;
const COOKBOOK_DIR_PATH = `${LOCAL_REPO_ROOT_PATH}/cookbook`;
const FEATURES_DIR_PATH = `${LOCAL_REPO_ROOT_PATH}/features`;
const EXPRESSIONS_DIR_PATH = `${LOCAL_REPO_ROOT_PATH}/expressions`;

// Keywords are extracted from commands and features documentation
// These are common keywords in hyperscript that we want to specifically identify
const POTENTIAL_KEYWORDS = [
  'on', 'in', 'with', 'for', 'from', 'to', 'into', 'end', 'then', 'else', 'when',
  'after', 'before', 'until', 'while', 'unless', 'as', 'at', 'async', 'and', 'or',
  'not', 'by', 'if', 'repeat', 'of', 'target'
];

// Ensure we capture all the keywords listed in the completeness-check.ts
const ADDITIONAL_KEYWORDS = [
  'else', 'when', 'after', 'before', 'until', 'while', 'unless', 'at', 'async', 
  'and', 'or', 'if', 'repeat', 'of', 'target'
];

// Special symbols that we specifically want to identify
// These are typically context-sensitive references
const SPECIAL_SYMBOLS = [
  { name: 'me', symbol: 'me', type: 'Variable' as const, referent: 'The current element that owns the hyperscript code' },
  { name: 'my', symbol: 'my', type: 'Variable' as const, referent: 'Possessive form of "me", for accessing properties' },
  { name: 'it', symbol: 'it', type: 'Variable' as const, referent: 'The result of the previous command or implicit object in current context' },
  { name: 'its', symbol: 'its', type: 'Variable' as const, referent: 'Possessive form of "it", for accessing properties' },
  { name: 'you', symbol: 'you', type: 'Variable' as const, referent: 'The target of an event' },
  { name: 'your', symbol: 'your', type: 'Variable' as const, referent: 'Possessive form of "you", for accessing properties' },
  { name: 'result', symbol: 'result', type: 'Variable' as const, referent: 'Alternative to "it", stores the result of the previous command' },
  { name: '@', symbol: '@', type: 'Delimiter' as const, referent: 'Symbol used to denote element-scoped variables' }
];

const md = new MarkdownIt();

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
        console.error(`File not found: ${filePath}`);
        return null;
    }
    return await file.text();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

function extractTextFromTokens(tokens: any[], startIndex: number, stopTokenType?: string): string {
    let text = '';
    for (let i = startIndex; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) continue;
        
        if (stopTokenType && token.type === stopTokenType && token.level <= tokens[startIndex]?.level ) break;

        if (token.type === 'inline' && token.children) {
            token.children.forEach((child: any) => {
                if (!child) return;
                if (child.type === 'text' || child.type === 'code_inline') {
                    text += child.content || '';
                }
            });
        } else if (token.type?.endsWith('_close') && !stopTokenType && token.level < tokens[startIndex]?.level) {
            break;
        }
    }
    return text.trim();
}

async function parseCommandFile(markdownContent: string, filePath: string, sourceDesc: string): Promise<CommandDefinition | null> {
  const tokens = md.parse(markdownContent, {});
  const commandName = path.basename(filePath, path.extname(filePath));
  let description = '';
  const syntaxCandidates: string[] = [];
  const exampleUsage: string[] = [];
  let firstCodeBlockIsSyntax = true;
  let inSyntaxSection = false;
  let inExamplesSection = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    
    if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
        const headingText = extractTextFromTokens(tokens, i + 1, 'heading_close').toLowerCase();
        inSyntaxSection = headingText.includes('syntax');
        inExamplesSection = headingText.includes('example');
        if (inSyntaxSection || inExamplesSection) continue;
    }
    if (token.type === 'paragraph_open' && !inSyntaxSection && !inExamplesSection && description.length < 1000) {
      description += extractTextFromTokens(tokens, i + 1, 'paragraph_close') + '\n';
    } else if (token.type === 'fence') {
      const lang = token.info?.trim().toLowerCase() || '';
      if (lang.includes('hyperscript') || lang.includes('html') || lang === '' || inSyntaxSection || inExamplesSection) {
        if (firstCodeBlockIsSyntax || inSyntaxSection) {
          syntaxCandidates.push(token.content?.trim() || '');
          firstCodeBlockIsSyntax = false;
          inSyntaxSection = false;
        } else {
          exampleUsage.push(token.content?.trim() || '');
        }
      }
    }
  }
  description = description.trim();
  const syntaxCanonical = syntaxCandidates.length > 0 ? syntaxCandidates[0] : (exampleUsage.length > 0 && syntaxCandidates.length === 0 ? exampleUsage.shift() : undefined);

  if (!commandName) return null;
  const commandEntryData = {
    id: uuidv4(),
    elementType: 'Command' as const,
    name: commandName,
    description: description || "N/A",
    syntax_canonical: syntaxCanonical,
    example_usage: exampleUsage.length > 0 ? exampleUsage : undefined,
    tags: ['official-command-md', commandName.toLowerCase()],
    source_info: {
      id: uuidv4(),
      source_url: `local_file_system:${filePath}`,
      source_description: `${sourceDesc} - Command: ${commandName}`,
      retrieved_at: new Date(),
      document_path: filePath,
    },
    status: 'Draft' as const,
    created_at: new Date(),
    updated_at: new Date(),
    purpose: description || undefined,
  };
  try {
    const validatedCommand = CommandDefinitionSchema.parse(commandEntryData);
    return validatedCommand;
  } catch (e) {
    console.error(`  [ERR-MD] Zod validation failed for command "${commandName}" from ${filePath}:`, (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '));
    return null;
  }
}

async function parseCommandsDirectory(directoryPath: string, sourceDesc: string): Promise<CommandDefinition[]> {
  console.log(`\nParsing commands from Markdown directory: ${directoryPath}...`);
  const allCommands: CommandDefinition[] = [];
  try {
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(directoryPath, file);
        const content = await readFileContent(filePath);
        if (content) {
          console.log(`  Processing command file: ${file}`);
          const command = await parseCommandFile(content, filePath, sourceDesc);
          if (command) {
            allCommands.push(command);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading commands directory ${directoryPath}:`, error);
  }
  console.log(`Parsed ${allCommands.length} commands from directory.`);
  return allCommands;
}

async function parseFeatureFile(markdownContent: string, filePath: string, sourceDesc: string): Promise<FeatureDefinition | null> {
  const tokens = md.parse(markdownContent, {});
  const featureName = path.basename(filePath, path.extname(filePath));
  let description = '';
  const syntaxCandidates: string[] = [];
  const exampleUsage: string[] = [];
  let keyAspectsText = '';
  let argumentsText = '';
  let firstCodeBlockIsSyntax = true;
  let inSyntaxSection = false;
  let inExamplesSection = false;
  let inKeyAspectsSection = false;
  let inArgumentsSection = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    
    if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
        const headingText = extractTextFromTokens(tokens, i + 1, 'heading_close').toLowerCase();
        inSyntaxSection = headingText.includes('syntax');
        inExamplesSection = headingText.includes('example');
        inKeyAspectsSection = headingText.includes('key aspect') || headingText.includes('detail');
        inArgumentsSection = headingText.includes('argument') || headingText.includes('structure');
        if (inSyntaxSection || inExamplesSection || inKeyAspectsSection || inArgumentsSection) continue;
    }
    if (token.type === 'paragraph_open') {
      const paraText = extractTextFromTokens(tokens, i + 1, 'paragraph_close');
      if (inKeyAspectsSection) keyAspectsText += paraText + '\n';
      else if (inArgumentsSection) argumentsText += paraText + '\n';
      else if (!inSyntaxSection && !inExamplesSection && description.length < 1000) description += paraText + '\n';
    } else if (token.type === 'bullet_list_open') {
        let listText = '';
        let listIdx = i + 1;
        while(listIdx < tokens.length && tokens[listIdx] && tokens[listIdx]?.type !== 'bullet_list_close') {
            if(tokens[listIdx]?.type === 'list_item_open') {
                listText += '- ' + extractTextFromTokens(tokens, listIdx + 1, 'list_item_close') + '\n';
            }
            listIdx++;
        }
        if (inKeyAspectsSection) keyAspectsText += listText;
        else if (inArgumentsSection) argumentsText += listText;
    } else if (token.type === 'fence') {
      const lang = token.info?.trim().toLowerCase() || '';
      if (lang.includes('hyperscript') || lang.includes('html') || lang === '' || inSyntaxSection || inExamplesSection) {
        if (firstCodeBlockIsSyntax || inSyntaxSection) {
          syntaxCandidates.push(token.content?.trim() || '');
          firstCodeBlockIsSyntax = false;
          inSyntaxSection = false;
        } else {
          exampleUsage.push(token.content?.trim() || '');
        }
      }
    }
  }
  description = description.trim();
  keyAspectsText = keyAspectsText.trim();
  argumentsText = argumentsText.trim();
  const syntaxCanonical = syntaxCandidates.length > 0 ? syntaxCandidates[0] : (exampleUsage.length > 0 && syntaxCandidates.length === 0 ? exampleUsage.shift() : undefined);

  if (!featureName) return null;
  const featureEntryData = {
    id: uuidv4(),
    elementType: 'Feature' as const,
    name: featureName,
    description: description || "N/A",
    syntax_canonical: syntaxCanonical,
    purpose: description.split('\n')[0] || undefined,
    key_aspects: keyAspectsText ? keyAspectsText.split('\n').filter(s => s.trim() !== '') : undefined,
    arguments_or_structure: argumentsText || undefined,
    example_usage: exampleUsage.length > 0 ? exampleUsage : undefined,
    tags: ['official-feature-md', featureName.toLowerCase()],
    source_info: {
      id: uuidv4(),
      source_url: `local_file_system:${filePath}`,
      source_description: `${sourceDesc} - Feature: ${featureName}`,
      retrieved_at: new Date(),
      document_path: filePath,
    },
    status: 'Draft' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };
  try {
    const validatedFeature = FeatureDefinitionSchema.parse(featureEntryData);
    return validatedFeature;
  } catch (e) {
    console.error(`  [ERR-MD] Zod validation failed for feature "${featureName}" from ${filePath}:`, (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '));
    return null;
  }
}

async function parseFeaturesDirectory(directoryPath: string, sourceDesc: string): Promise<FeatureDefinition[]> {
  console.log(`\nParsing features from Markdown directory: ${directoryPath}...`);
  const allFeatures: FeatureDefinition[] = [];
  try {
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(directoryPath, file);
        const content = await readFileContent(filePath);
        if (content) {
          console.log(`  Processing feature file: ${file}`);
          const feature = await parseFeatureFile(content, filePath, sourceDesc);
          if (feature) {
            allFeatures.push(feature);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading features directory ${directoryPath}:`, error);
  }
  console.log(`Parsed ${allFeatures.length} features from directory.`);
  return allFeatures;
}

async function parseExpressionFile(markdownContent: string, filePath: string, sourceDesc: string): Promise<ExpressionDefinition | null> {
  const tokens = md.parse(markdownContent, {});
  // Expression name might be from filename, or from a H1/H2 if the file covers multiple related expressions
  let expressionName = path.basename(filePath, path.extname(filePath));
  let description = '';
  const syntaxPatterns: string[] = []; // For expressions, these are the core examples of the syntax
  const exampleUsage: string[] = []; // For fuller snippets showing context
  let evaluatesTo = '';
  let notes = '';
  let title = ''; 
  let operations: string[] = [];

  // Attempt to find a main heading for a more descriptive name
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    
    if (token.type === 'heading_open' && (token.tag === 'h1' || token.tag === 'h2')) {
        const headingText = extractTextFromTokens(tokens, i + 1, 'heading_close');
        if (expressionName === 'index') expressionName = headingText; // If filename is index.md, use heading
        else title = headingText; // Otherwise, first major heading might be a title
        break; // Assume first main heading is most relevant
    }
  }

  let inSyntaxSection = false;
  let inExamplesSection = false;
  let inEvaluationSection = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    
    if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
        const headingText = extractTextFromTokens(tokens, i + 1, 'heading_close').toLowerCase();
        inSyntaxSection = headingText.includes('syntax') || headingText.includes('pattern');
        inExamplesSection = headingText.includes('example');
        inEvaluationSection = headingText.includes('evaluates to') || headingText.includes('return');
        if (inSyntaxSection || inExamplesSection || inEvaluationSection) continue;
    }

    if (token.type === 'paragraph_open') {
      const paraText = extractTextFromTokens(tokens, i + 1, 'paragraph_close');
      if (inEvaluationSection) evaluatesTo += paraText + '\n';
      else if (!inSyntaxSection && !inExamplesSection && description.length < 1000) description += paraText + '\n';
      else notes += paraText + '\n'; // General notes or non-primary description
    } else if (token.type === 'fence') {
      const lang = token.info?.trim().toLowerCase() || '';
      // For expressions, any code block might be a syntax pattern or an example
      if (lang.includes('hyperscript') || lang.includes('html') || lang === '') {
         if (inSyntaxSection || syntaxPatterns.length < 2) { // Prioritize syntax section or first few blocks
            syntaxPatterns.push(token.content?.trim() || '');
            inSyntaxSection = false;
         } else {
            exampleUsage.push(token.content?.trim() || '');
         }
      }
    }
  }
  description = description.trim();
  evaluatesTo = evaluatesTo.trim();
  notes = notes.trim();

  // Determine operations if any
  for (const pattern of syntaxPatterns) {
    const possibleOperators = ['+', '-', '*', '/', '=', '!=', '<', '>', '<=', '>=', 'is', 'is not', 'and', 'or', 'not'];
    for (const op of possibleOperators) {
      if (pattern.includes(op) && !operations.includes(op)) {
        operations.push(op);
      }
    }
  }

  // Determine category based on expression name and content
  let categoryValue: z.infer<typeof ExpressionCategoryEnum> = 'Other';
  
  // Check for arithmetic expressions
  if (expressionName.includes('arithmetic') || 
      operations.some(op => ['+', '-', '*', '/', '%'].includes(op)) ||
      expressionName === 'time-expression') {
    categoryValue = 'Arithmetic';
  } 
  // Check for logical expressions
  else if (expressionName.includes('logical') || 
           expressionName === 'logical-operator' || 
           operations.some(op => ['and', 'or', 'not'].includes(op))) {
    categoryValue = 'Logical';
  } 
  // Check for comparison expressions
  else if (expressionName.includes('comparison') || 
           expressionName === 'comparison-operator' || 
           operations.some(op => ['is', '=', '!=', '<', '>', '<=', '>=', 'is not'].includes(op))) {
    categoryValue = 'Comparison';
  } 
  // Check for string manipulation
  else if (expressionName.includes('string') || 
           description.toLowerCase().includes('string manipulation') ||
           title.toLowerCase().includes('string')) {
    categoryValue = 'StringManipulation';
  } 
  // Check for object access expressions
  else if (expressionName.includes('reference') || 
           expressionName.includes('of') || 
           expressionName.includes('possessive') ||
           expressionName === 'attribute-ref' || 
           expressionName === 'id-reference' || 
           expressionName === 'class-reference') {
    categoryValue = 'ObjectAccess';
  }

  if (!expressionName) return null;
  const expressionEntryData = {
    id: uuidv4(),
    elementType: 'Expression' as const,
    name: expressionName,
    category: categoryValue,
    description: description || "N/A",
    syntax_patterns: syntaxPatterns.length > 0 ? syntaxPatterns : (exampleUsage.length > 0 ? [exampleUsage.shift() as string] : []), // Ensure syntax_patterns has at least one if possible
    evaluates_to: evaluatesTo || undefined,
    notes: notes || undefined,
    example_usage: exampleUsage.length > 0 ? exampleUsage : undefined,
    operators: operations.length > 0 ? operations : undefined,
    tags: ['official-expression-md', expressionName.toLowerCase()],
    source_info: {
      id: uuidv4(),
      source_url: `local_file_system:${filePath}`,
      source_description: `${sourceDesc} - Expression: ${expressionName}`,
      retrieved_at: new Date(),
      document_path: filePath,
    },
    status: 'Draft' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  try {
    const validatedExpression = ExpressionDefinitionSchema.parse(expressionEntryData);
    return validatedExpression;
  } catch (e) {
    console.error(`  [ERR-MD] Zod validation error for expression "${expressionName}" from ${filePath}:`, (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '));
    return null;
  }
}

async function parseExpressionsDirectory(directoryPath: string, sourceDesc: string): Promise<ExpressionDefinition[]> {
  console.log(`\nParsing expressions from Markdown directory: ${directoryPath}...`);
  const allExpressions: ExpressionDefinition[] = [];
  try {
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(directoryPath, file);
        const content = await readFileContent(filePath);
        if (content) {
          console.log(`  Processing expression file: ${file}`);
          const expression = await parseExpressionFile(content, filePath, sourceDesc);
          if (expression) {
            allExpressions.push(expression);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading expressions directory ${directoryPath}:`, error);
  }
  console.log(`Parsed ${allExpressions.length} expressions from directory.`);
  return allExpressions;
}

// Extract keywords from command and feature syntax patterns
async function parseKeywordFromSyntax(pattern: string, relatedElement: { type: string, name: string }): Promise<KeywordDefinition | null> {
  if (!pattern) return null;
  
  // Simple tokenization to extract words that might be keywords
  const tokens = pattern.split(/[\s<>\(\)\[\]{}]/);
  
  for (const keyword of POTENTIAL_KEYWORDS) {
    if (tokens.includes(keyword)) {
      // Skip keywords that are actually commands or expressions themselves
      if (relatedElement.type === 'Command' && relatedElement.name === keyword) continue;
      
      // Get the context from the pattern
      const keywordIndex = pattern.indexOf(keyword);
      const startContext = Math.max(0, keywordIndex - 15);
      const endContext = Math.min(pattern.length, keywordIndex + keyword.length + 15);
      const usageContext = pattern.substring(startContext, endContext);
      
      return {
        id: uuidv4(),
        elementType: 'Keyword' as const,
        name: keyword,
        description: `Keyword "${keyword}" used in ${relatedElement.type.toLowerCase()} syntax patterns.`,
        usage_context: [usageContext],
        syntax_examples: [pattern],
        tags: ['extracted-keyword', keyword, `used-in-${relatedElement.type.toLowerCase()}`],
        source_info: {
          id: uuidv4(),
          source_url: `local_keyword_extraction:${keyword}`,
          source_description: `Extracted from ${relatedElement.type} ${relatedElement.name}`,
          retrieved_at: new Date(),
        },
        status: 'Draft' as const,
        created_at: new Date(),
        updated_at: new Date(),
        related_elements: [{
          element_type: relatedElement.type as any,
          element_name: relatedElement.name
        }]
      };
    }
  }
  
  return null;
}

/**
 * Ensures all required keywords are included in the collected keywords list
 * For any missing keyword, creates a default definition
 */
async function ensureAllKeywordsArePresent(collectedKeywords: KeywordDefinition[]): Promise<void> {
  console.log("\nChecking for missing keywords...");
  const existingKeywordNames = collectedKeywords.map(k => k.name);
  
  // Check for missing keywords from both lists
  const allRequiredKeywords = [...new Set([...POTENTIAL_KEYWORDS, ...ADDITIONAL_KEYWORDS])];
  const missingKeywords = allRequiredKeywords.filter(name => !existingKeywordNames.includes(name));
  
  if (missingKeywords.length > 0) {
    console.log(`Adding ${missingKeywords.length} missing keywords: ${missingKeywords.join(', ')}`);
    
    // Create default entries for missing keywords
    for (const keywordName of missingKeywords) {
      const keywordDef: KeywordDefinition = {
        id: uuidv4(),
        elementType: 'Keyword' as const,
        name: keywordName,
        description: `Hyperscript keyword "${keywordName}".`,
        usage_context: [],
        syntax_examples: [],
        tags: ['default-keyword', keywordName],
        source_info: {
          id: uuidv4(),
          source_url: 'default_keyword_entry',
          source_description: `Default entry for keyword: ${keywordName}`,
          retrieved_at: new Date(),
        },
        status: 'Draft' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      collectedKeywords.push(keywordDef);
    }
  } else {
    console.log("All required keywords are present.");
  }
}

// Process all the collected commands and features to extract keywords
async function extractKeywords(
  commands: CommandDefinition[], 
  features: FeatureDefinition[]
): Promise<KeywordDefinition[]> {
  console.log("\nExtracting keywords from commands and features...");
  const keywordMap: Map<string, KeywordDefinition> = new Map();
  
  // Process commands
  for (const command of commands) {
    if (command.syntax_canonical) {
      const keyword = await parseKeywordFromSyntax(command.syntax_canonical, { 
        type: 'Command', 
        name: command.name 
      });
      
      if (keyword) {
        if (keywordMap.has(keyword.name)) {
          // Update existing keyword entry with this new reference
          const existing = keywordMap.get(keyword.name);
          if (existing) {
            // Initialize usage_context if it doesn't exist
            if (!existing.usage_context) {
              existing.usage_context = [];
            }
            // Add this usage context if it's not already included
            if (!existing.usage_context.includes(keyword.usage_context[0])) {
              existing.usage_context.push(keyword.usage_context[0]);
            }
            
            // Add this syntax example if it's not already included
            if (!existing.syntax_examples.includes(keyword.syntax_examples[0])) {
              existing.syntax_examples.push(keyword.syntax_examples[0]);
            }
            
            // Add this related element
            if (!existing.related_elements) {
              existing.related_elements = [];
            }
            existing.related_elements.push(keyword.related_elements![0]);
          }
        } else {
          // Add new keyword entry
          keywordMap.set(keyword.name, keyword);
        }
      }
    }
    
    // Also look in example usage
    if (command.example_usage) {
      for (const example of command.example_usage) {
        const keyword = await parseKeywordFromSyntax(example, { 
          type: 'Command', 
          name: command.name 
        });
        
        if (keyword) {
          if (keywordMap.has(keyword.name)) {
            // Update existing keyword entry with this new reference
            const existing = keywordMap.get(keyword.name);
            if (existing) {
              // Add this usage context if it's not already included
              if (!existing.usage_context.includes(keyword.usage_context[0])) {
                existing.usage_context.push(keyword.usage_context[0]);
              }
              
              // Add this syntax example if it's not already included
              if (!existing.syntax_examples.includes(keyword.syntax_examples[0])) {
                existing.syntax_examples.push(keyword.syntax_examples[0]);
              }
              
              // Add this related element if it's not already included
              if (!existing.related_elements) {
                existing.related_elements = [];
              }
              
              const hasRelation = existing.related_elements.some(
                rel => rel.element_type === keyword.related_elements![0].element_type && 
                      rel.element_name === keyword.related_elements![0].element_name
              );
              
              if (!hasRelation) {
                existing.related_elements.push(keyword.related_elements![0]);
              }
            }
          } else {
            // Add new keyword entry
            keywordMap.set(keyword.name, keyword);
          }
        }
      }
    }
  }
  
  // Process features
  for (const feature of features) {
    if (feature.syntax_canonical) {
      const keyword = await parseKeywordFromSyntax(feature.syntax_canonical, { 
        type: 'Feature', 
        name: feature.name 
      });
      
      if (keyword) {
        if (keywordMap.has(keyword.name)) {
          // Update existing keyword entry with this new reference
          const existing = keywordMap.get(keyword.name);
          if (existing) {
            // Add this usage context if it's not already included
            if (!existing.usage_context.includes(keyword.usage_context[0])) {
              existing.usage_context.push(keyword.usage_context[0]);
            }
            
            // Add this syntax example if it's not already included
            if (!existing.syntax_examples.includes(keyword.syntax_examples[0])) {
              existing.syntax_examples.push(keyword.syntax_examples[0]);
            }
            
            // Add this related element
            if (!existing.related_elements) {
              existing.related_elements = [];
            }
            existing.related_elements.push(keyword.related_elements![0]);
          }
        } else {
          // Add new keyword entry
          keywordMap.set(keyword.name, keyword);
        }
      }
    }
    
    // Also look in example usage
    if (feature.example_usage) {
      for (const example of feature.example_usage) {
        const keyword = await parseKeywordFromSyntax(example, { 
          type: 'Feature', 
          name: feature.name 
        });
        
        if (keyword) {
          if (keywordMap.has(keyword.name)) {
            // Update existing keyword entry with this new reference
            const existing = keywordMap.get(keyword.name);
            if (existing) {
              // Add this usage context if it's not already included
              if (!existing.usage_context.includes(keyword.usage_context[0])) {
                existing.usage_context.push(keyword.usage_context[0]);
              }
              
              // Add this syntax example if it's not already included
              if (!existing.syntax_examples.includes(keyword.syntax_examples[0])) {
                existing.syntax_examples.push(keyword.syntax_examples[0]);
              }
              
              // Add this related element if it's not already included
              if (!existing.related_elements) {
                existing.related_elements = [];
              }
              
              const hasRelation = existing.related_elements.some(
                rel => rel.element_type === keyword.related_elements![0].element_type && 
                      rel.element_name === keyword.related_elements![0].element_name
              );
              
              if (!hasRelation) {
                existing.related_elements.push(keyword.related_elements![0]);
              }
            }
          } else {
            // Add new keyword entry
            keywordMap.set(keyword.name, keyword);
          }
        }
      }
    }
  }
  
  // Convert the map to an array
  const keywords: KeywordDefinition[] = Array.from(keywordMap.values());
  console.log(`Extracted ${keywords.length} keywords from commands and features.`);
  return keywords;
}

// Find special symbols like 'me', 'it', etc. in examples
function parseSpecialSymbolFromText(text: string, relatedElement: { type: string, name: string }): SpecialSymbolDefinition[] {
  if (!text) return [];
  
  const results: SpecialSymbolDefinition[] = [];
  
  for (const specialSymbol of SPECIAL_SYMBOLS) {
    // Simple text-based search for special symbols
    const regex = new RegExp(`\\b${specialSymbol.symbol}\\b`, 'g');
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      // Get some context around the first match
      const matchIndex = text.indexOf(specialSymbol.symbol);
      if (matchIndex === -1) continue; // Shouldn't happen if we found matches
      
      const startContext = Math.max(0, matchIndex - 15);
      const endContext = Math.min(text.length, matchIndex + specialSymbol.symbol.length + 15);
      const usageContext = text.substring(startContext, endContext);
      
      results.push({
        id: uuidv4(),
        elementType: 'SpecialSymbol' as const,
        name: specialSymbol.name,
        symbol: specialSymbol.symbol,
        symbol_type: specialSymbol.type,
        description: `The special symbol "${specialSymbol.symbol}" typically ${specialSymbol.referent.toLowerCase()}`,
        typical_value_or_referent: specialSymbol.referent,
        scope_implications: specialSymbol.type === 'Variable' 
          ? 'Depends on the current execution context' 
          : undefined,
        usage_context: [usageContext],
        syntax_examples: [text],
        tags: ['extracted-special-symbol', specialSymbol.symbol, specialSymbol.type.toLowerCase()],
        source_info: {
          id: uuidv4(),
          source_url: `local_symbol_extraction:${specialSymbol.symbol}`,
          source_description: `Extracted from ${relatedElement.type} ${relatedElement.name}`,
          retrieved_at: new Date(),
        },
        status: 'Draft' as const,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
  
  return results;
}

// Process all the collected expressions and examples to extract special symbols
async function extractSpecialSymbols(
  expressions: ExpressionDefinition[],
  commands: CommandDefinition[],
  features: FeatureDefinition[]
): Promise<SpecialSymbolDefinition[]> {
  console.log("\nExtracting special symbols from expressions, commands, and features...");
  const symbolMap: Map<string, SpecialSymbolDefinition> = new Map();
  
  // Process expressions, looking for special symbols (me, it, etc.)
  for (const expression of expressions) {
    // Check if this expression itself is a special symbol
    const isSpecialSymbol = SPECIAL_SYMBOLS.find(s => s.name === expression.name);
    
    if (isSpecialSymbol) {
      // This expression is a special symbol (e.g., 'me', 'it')
      const symbolDef: SpecialSymbolDefinition = {
        id: uuidv4(),
        elementType: 'SpecialSymbol' as const,
        name: expression.name,
        symbol: isSpecialSymbol.symbol,
        symbol_type: isSpecialSymbol.type,
        description: expression.description,
        typical_value_or_referent: isSpecialSymbol.referent,
        scope_implications: expression.notes || 
                          (isSpecialSymbol.type === 'Variable' ? 'Depends on the current execution context' : undefined),
        usage_context: [],
        syntax_examples: expression.syntax_patterns || [],
        tags: ['special-symbol', 'expression-documented', expression.name, isSpecialSymbol.type.toLowerCase()],
        source_info: {
          id: uuidv4(),
          source_url: `local_file_system:${expression.name}`,
          source_description: `Expression Documentation: ${expression.name}`,
          retrieved_at: new Date(),
        },
        status: 'Draft' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      // Add example usage as context
      if (expression.example_usage) {
        symbolDef.usage_context = expression.example_usage;
      } else if (expression.syntax_patterns && expression.syntax_patterns.length > 0) {
        symbolDef.usage_context = expression.syntax_patterns;
      }
      
      symbolMap.set(expression.name, symbolDef);
    }
    
    // Also look for usage of other special symbols in this expression's examples
    if (expression.example_usage) {
      for (const example of expression.example_usage) {
        const foundSymbols = parseSpecialSymbolFromText(example, { 
          type: 'Expression', 
          name: expression.name 
        });
        
        for (const symbol of foundSymbols) {
          if (symbolMap.has(symbol.name)) {
            // Update existing symbol entry with this new reference
            const existing = symbolMap.get(symbol.name);
            if (existing) {
              // Add this usage context if it's not already included
              if (!existing.usage_context.includes(symbol.usage_context[0])) {
                existing.usage_context.push(symbol.usage_context[0]);
              }
              
              // Add this syntax example if it's not already included
              if (!existing.syntax_examples.includes(symbol.syntax_examples[0])) {
                existing.syntax_examples.push(symbol.syntax_examples[0]);
              }
            }
          } else {
            // Add new symbol entry
            symbolMap.set(symbol.name, symbol);
          }
        }
      }
    }
  }
  
  // Process commands for special symbol usage
  for (const command of commands) {
    if (command.example_usage) {
      for (const example of command.example_usage) {
        const foundSymbols = parseSpecialSymbolFromText(example, { 
          type: 'Command', 
          name: command.name 
        });
        
        for (const symbol of foundSymbols) {
          if (symbolMap.has(symbol.name)) {
            // Update existing symbol entry with this new reference
            const existing = symbolMap.get(symbol.name);
            if (existing) {
              // Add this usage context if it's not already included
              if (!existing.usage_context.includes(symbol.usage_context[0])) {
                existing.usage_context.push(symbol.usage_context[0]);
              }
              
              // Add this syntax example if it's not already included
              if (!existing.syntax_examples.includes(symbol.syntax_examples[0])) {
                existing.syntax_examples.push(symbol.syntax_examples[0]);
              }
            }
          } else {
            // Add new symbol entry
            symbolMap.set(symbol.name, symbol);
          }
        }
      }
    }
  }
  
  // Process features for special symbol usage
  for (const feature of features) {
    if (feature.example_usage) {
      for (const example of feature.example_usage) {
        const foundSymbols = parseSpecialSymbolFromText(example, { 
          type: 'Feature', 
          name: feature.name 
        });
        
        for (const symbol of foundSymbols) {
          if (symbolMap.has(symbol.name)) {
            // Update existing symbol entry with this new reference
            const existing = symbolMap.get(symbol.name);
            if (existing) {
              // Add this usage context if it's not already included
              if (!existing.usage_context.includes(symbol.usage_context[0])) {
                existing.usage_context.push(symbol.usage_context[0]);
              }
              
              // Add this syntax example if it's not already included
              if (!existing.syntax_examples.includes(symbol.syntax_examples[0])) {
                existing.syntax_examples.push(symbol.syntax_examples[0]);
              }
            }
          } else {
            // Add new symbol entry
            symbolMap.set(symbol.name, symbol);
          }
        }
      }
    }
  }
  
  // Add any special symbols that weren't found in the documentation
  for (const specialSymbol of SPECIAL_SYMBOLS) {
    if (!symbolMap.has(specialSymbol.name)) {
      symbolMap.set(specialSymbol.name, {
        id: uuidv4(),
        elementType: 'SpecialSymbol' as const,
        name: specialSymbol.name,
        symbol: specialSymbol.symbol,
        symbol_type: specialSymbol.type,
        description: `The special symbol "${specialSymbol.symbol}" typically ${specialSymbol.referent.toLowerCase()}`,
        typical_value_or_referent: specialSymbol.referent,
        scope_implications: specialSymbol.type === 'Variable' 
          ? 'Depends on the current execution context' 
          : undefined,
        usage_context: [],
        syntax_examples: [],
        tags: ['special-symbol', 'default-entry', specialSymbol.symbol, specialSymbol.type.toLowerCase()],
        source_info: {
          id: uuidv4(),
          source_url: 'local_symbol_predefined',
          source_description: `Predefined Special Symbol: ${specialSymbol.name}`,
          retrieved_at: new Date(),
        },
        status: 'Draft' as const,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
  
  // Convert the map to an array
  const symbols: SpecialSymbolDefinition[] = Array.from(symbolMap.values());
  console.log(`Extracted ${symbols.length} special symbols.`);
  return symbols;
}


async function parseCookbookFile(markdownContent: string, filePath: string, sourceDesc: string): Promise<CodeExample | null> {
  const tokens = md.parse(markdownContent, {});
  let title: string | null = null;
  let description = '';
  const codeBlocks: Array<{ lang: string, content: string }> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    
    if (token.type === 'heading_open' && (token.tag === 'h1' || token.tag === 'h2')) {
      if (!title) {
        title = extractTextFromTokens(tokens, i + 1, 'heading_close');
      }
    } else if (token.type === 'paragraph_open') {
      description += extractTextFromTokens(tokens, i + 1, 'paragraph_close') + '\n';
    } else if (token.type === 'fence') {
      codeBlocks.push({ 
        lang: token.info?.trim() || '', 
        content: token.content?.trim() || '' 
      });
    }
  }
  if (!title) {
    title = path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  description = description.trim();
  if (codeBlocks.length === 0) return null;
  const rawCode = codeBlocks.map(cb => `\`\`\`${cb.lang || ''}\n${cb.content}\n\`\`\``).join('\n\n');
  const exampleEntryData = {
    id: uuidv4(),
    title: title,
    description: description || "N/A",
    raw_code: rawCode,
    html_context: "",
    source_info: {
      id: uuidv4(),
      source_url: `local_file_system:${filePath}`,
      source_description: `${sourceDesc} - Example: ${title}`,
      retrieved_at: new Date(),
      document_path: filePath,
    },
    tags: ['official-cookbook-md', title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')],
    status: 'New' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };
  try {
    const validatedExample = CodeExampleSchema.parse(exampleEntryData);
    return validatedExample;
  } catch (e) {
    console.error(`  [ERR-MD] Zod validation error for example "${title}" from ${filePath}:`, (e as z.ZodError).errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '));
    return null;
  }
}

async function parseCookbookDirectory(directoryPath: string, sourceDesc: string): Promise<CodeExample[]> {
  console.log(`\nParsing examples from Markdown directory: ${directoryPath}...`);
  const allExamples: CodeExample[] = [];
  try {
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.html')) {
        const filePath = path.join(directoryPath, file);
        const content = await readFileContent(filePath);
        if (content) {
          console.log(`  Processing cookbook file: ${file}`);
          if (file.endsWith('.md')) {
            const example = await parseCookbookFile(content, filePath, sourceDesc);
            if (example) {
              allExamples.push(example);
            }
          } else {
              console.warn(`  Skipping HTML file in cookbook: ${file}. Implement HTML parsing if needed.`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading cookbook directory ${directoryPath}:`, error);
  }
  console.log(`Parsed ${allExamples.length} cookbook examples from directory.`);
  return allExamples;
}


(async () => {
  let collectedCommands: CommandDefinition[] = [];
  let collectedExamples: CodeExample[] = [];
  let collectedFeatures: FeatureDefinition[] = [];
  let collectedExpressions: ExpressionDefinition[] = [];
  let collectedKeywords: KeywordDefinition[] = [];
  let collectedSpecialSymbols: SpecialSymbolDefinition[] = [];

  console.log("Starting Hyperscript.org Local Markdown Parser...");

  const commands = await parseCommandsDirectory(COMMANDS_DIR_PATH, 'Local Clone MD - Commands');
  collectedCommands.push(...commands);

  const examples = await parseCookbookDirectory(COOKBOOK_DIR_PATH, 'Local Clone MD - Cookbook');
  collectedExamples.push(...examples);

  const features = await parseFeaturesDirectory(FEATURES_DIR_PATH, 'Local Clone MD - Features');
  collectedFeatures.push(...features);

  const expressions = await parseExpressionsDirectory(EXPRESSIONS_DIR_PATH, 'Local Clone MD - Expressions');
  collectedExpressions.push(...expressions);

  // Extract keywords from commands and features
  const keywords = await extractKeywords(collectedCommands, collectedFeatures);
  collectedKeywords.push(...keywords);
  
  // Ensure all required keywords are included
  await ensureAllKeywordsArePresent(collectedKeywords);
  
  // Extract special symbols from expressions, commands, and features
  const specialSymbols = await extractSpecialSymbols(collectedExpressions, collectedCommands, collectedFeatures);
  collectedSpecialSymbols.push(...specialSymbols);

  console.log("\n--- Parsing Complete ---");
  console.log(`Total Commands Collected: ${collectedCommands.length}`);
  console.log(`Total Examples Collected: ${collectedExamples.length}`);
  console.log(`Total Features Collected: ${collectedFeatures.length}`);
  console.log(`Total Expressions Collected: ${collectedExpressions.length}`);
  console.log(`Total Keywords Collected: ${collectedKeywords.length}`);
  console.log(`Total Special Symbols Collected: ${collectedSpecialSymbols.length}`);

  if (collectedCommands.length > 0) {
    const commandsFilePath = "./data/collected_json/markdown_commands.json";
    try {
      await Bun.write(commandsFilePath, JSON.stringify(collectedCommands, null, 2));
      console.log(`\nSaved commands to ${commandsFilePath}`);
    } catch (e) { console.error("Error writing commands file:", e)}
  }
  if (collectedExamples.length > 0) {
    const examplesFilePath = "./data/collected_json/markdown_examples.json";
     try {
      await Bun.write(examplesFilePath, JSON.stringify(collectedExamples, null, 2));
      console.log(`Saved examples to ${examplesFilePath}`);
    } catch (e) { console.error("Error writing examples file:", e)}
  }
  if (collectedFeatures.length > 0) {
    const featuresFilePath = "./data/collected_json/markdown_features.json";
     try {
      await Bun.write(featuresFilePath, JSON.stringify(collectedFeatures, null, 2));
      console.log(`Saved features to ${featuresFilePath}`);
    } catch (e) { console.error("Error writing features file:", e)}
  }
  if (collectedExpressions.length > 0) {
    const expressionsFilePath = "./data/collected_json/markdown_expressions.json";
     try {
      await Bun.write(expressionsFilePath, JSON.stringify(collectedExpressions, null, 2));
      console.log(`Saved expressions to ${expressionsFilePath}`);
    } catch (e) { console.error("Error writing expressions file:", e)}
  }
  if (collectedKeywords.length > 0) {
    const keywordsFilePath = "./data/collected_json/markdown_keywords.json";
     try {
      await Bun.write(keywordsFilePath, JSON.stringify(collectedKeywords, null, 2));
      console.log(`Saved keywords to ${keywordsFilePath}`);
    } catch (e) { console.error("Error writing keywords file:", e)}
  }
  if (collectedSpecialSymbols.length > 0) {
    const specialSymbolsFilePath = "./data/collected_json/markdown_special_symbols.json";
     try {
      await Bun.write(specialSymbolsFilePath, JSON.stringify(collectedSpecialSymbols, null, 2));
      console.log(`Saved special symbols to ${specialSymbolsFilePath}`);
    } catch (e) { console.error("Error writing special symbols file:", e)}
  }

  if (collectedCommands.length > 0) {
    console.log("\nFirst Command (Markdown):");
    console.log(JSON.stringify(collectedCommands[0], null, 2));
  }
  if (collectedExamples.length > 0) {
    console.log("\nFirst Example (Markdown):");
    console.log(JSON.stringify(collectedExamples[0], null, 2));
  }
  if (collectedFeatures.length > 0) {
    console.log("\nFirst Feature (Markdown):");
    console.log(JSON.stringify(collectedFeatures[0], null, 2));
  }
  if (collectedExpressions.length > 0) {
    console.log("\nFirst Expression (Markdown):");
    console.log(JSON.stringify(collectedExpressions[0], null, 2));
  }
  if (collectedKeywords.length > 0) {
    console.log("\nFirst Keyword (Extracted):");
    console.log(JSON.stringify(collectedKeywords[0], null, 2));
  }
  if (collectedSpecialSymbols.length > 0) {
    console.log("\nFirst Special Symbol (Extracted):");
    console.log(JSON.stringify(collectedSpecialSymbols[0], null, 2));
  }

})();