import MarkdownIt from 'markdown-it';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import frontMatter from 'front-matter';

// Importing Zod schemas
import { CodeExampleSchema, DifficultyEnum } from '../schemas';

// Define types from imported schemas
export type CodeExample = z.infer<typeof CodeExampleSchema>;

const md = new MarkdownIt();

/**
 * Reads a file's content
 * @param filePath Path to the file
 * @returns File content as string or null on error
 */
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

/**
 * Parses frontmatter from markdown content
 * @param content Markdown content with frontmatter
 * @returns Object containing parsed frontmatter and remaining content
 */
function parseFrontmatter(content: string): { 
  data: any; 
  content: string 
} {
  try {
    const parsed = frontMatter(content);
    return {
      data: parsed.attributes,
      content: parsed.body
    };
  } catch (error) {
    console.error("Error parsing frontmatter:", error);
    return {
      data: {},
      content
    };
  }
}

/**
 * Extracts example blocks from markdown content
 * @param markdownContent Markdown content to parse
 * @returns Array of example blocks
 */
function extractExampleBlocks(markdownContent: string): Array<{
  title?: string;
  description?: string;
  content: string;
  html_context?: string;
}> {
  const blocks: Array<{
    title?: string;
    description?: string;
    content: string;
    html_context?: string;
  }> = [];

  // Regular expression to find {% example %} blocks
  const exampleBlockRegex = /{% example(?:\s+"([^"]*)")?\s*%}([\s\S]*?){% endexample %}/g;
  
  let match;
  while ((match = exampleBlockRegex.exec(markdownContent)) !== null) {
    const title = match[1] || '';
    const content = match[2]?.trim() || '';

    // Process the content to separate HTML and hyperscript
    const { html_context, hyperscript_code } = extractHtmlAndHyperscript(content);

    blocks.push({
      title,
      content: hyperscript_code,
      html_context: html_context
    });
  }

  // If no example blocks were found with the special syntax,
  // fall back to looking for code blocks with hyperscript
  if (blocks.length === 0) {
    const tokens = md.parse(markdownContent, {});
    let currentDescription = '';
    let currentTitle = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (!token) continue;
      
      if (token.type === 'heading_open') {
        const headingLevel = parseInt(token.tag.substring(1));
        if (headingLevel <= 2 && i + 1 < tokens.length && tokens[i + 1]?.type === 'inline') {
          currentTitle = tokens[i + 1]?.content || '';
        }
      } else if (token.type === 'paragraph_open' && i + 1 < tokens.length && tokens[i + 1]?.type === 'inline') {
        currentDescription = tokens[i + 1]?.content || '';
      } else if (token.type === 'fence') {
        const lang = token.info?.trim().toLowerCase() || '';
        if (lang === 'hyperscript' || lang === '_' || lang === '') {
          blocks.push({
            title: currentTitle,
            description: currentDescription,
            content: token.content,
            html_context: extractHtmlContext(markdownContent, i, tokens)
          });
          
          // Reset description to avoid duplication
          currentDescription = '';
        }
      }
    }
  }

  return blocks;
}

/**
 * Attempts to find HTML context near a hyperscript code block
 * @param markdownContent Full markdown content
 * @param tokenIndex Index of the current hyperscript code block token
 * @param tokens All parsed tokens
 * @returns Extracted HTML context or undefined
 */
function extractHtmlContext(markdownContent: string, tokenIndex: number, tokens: any[]): string | undefined {
  // Look for HTML code blocks before or after the hyperscript block
  let htmlContent = '';
  
  // Check previous blocks
  for (let i = tokenIndex - 1; i >= 0; i--) {
    if (tokens[i].type === 'fence') {
      const lang = tokens[i].info?.trim().toLowerCase() || '';
      if (lang === 'html') {
        htmlContent = tokens[i].content;
        break;
      }
    }
    // Stop looking if we hit a heading or have gone back more than 3 blocks
    if (tokens[i].type === 'heading_open' || tokenIndex - i > 6) break;
  }
  
  // If no HTML found before, check after
  if (!htmlContent) {
    for (let i = tokenIndex + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'fence') {
        const lang = tokens[i].info?.trim().toLowerCase() || '';
        if (lang === 'html') {
          htmlContent = tokens[i].content;
          break;
        }
      }
      // Stop looking if we hit a heading or have gone forward more than 3 blocks
      if (tokens[i].type === 'heading_open' || i - tokenIndex > 6) break;
    }
  }
  
  return htmlContent || undefined;
}

/**
 * Separates HTML and hyperscript code from combined content
 * @param content Combined content that may contain both HTML and hyperscript
 * @returns Object with separated HTML and hyperscript
 */
function extractHtmlAndHyperscript(content: string): {
  html_context: string;
  hyperscript_code: string;
} {
  // First, try to handle content that looks like combined HTML/hyperscript
  if (content.includes('<') && content.includes('>')) {
    // Load content into cheerio for HTML parsing
    const $ = cheerio.load(content, { xmlMode: false });
    const hyperscriptElements: string[] = [];
    
    // Extract elements with _= attribute (hyperscript)
    $('[_]').each((_, el) => {
      const hyperscriptCode = $(el).attr('_');
      if (hyperscriptCode) {
        hyperscriptElements.push(hyperscriptCode.trim());
      }
    });
    
    // If we found hyperscript code
    if (hyperscriptElements.length > 0) {
      return {
        html_context: content.trim(),
        hyperscript_code: hyperscriptElements.join('\n\n')
      };
    }
  }
  
  // Fall back to looking for explicit code blocks
  const htmlBlockRegex = /```html\n([\s\S]*?)```/g;
  const hyperscriptBlockRegex = /```(?:hyperscript|_)\n([\s\S]*?)```/g;
  
  let htmlMatch = htmlBlockRegex.exec(content);
  let hyperscriptMatch = hyperscriptBlockRegex.exec(content);
  
  const html_context = htmlMatch?.[1]?.trim() || content.trim();
  const hyperscript_code = hyperscriptMatch && hyperscriptMatch[1] ? hyperscriptMatch[1].trim() : '';
  
  // If no hyperscript found in code blocks and content has HTML, return empty hyperscript
  if (!hyperscript_code && content.includes('<') && content.includes('>')) {
    return { html_context, hyperscript_code: '' };
  }
  
  return { html_context, hyperscript_code: hyperscript_code || content.trim() };
}

/**
 * Parses a single cookbook markdown file
 * @param filePath Path to the markdown file
 * @param sourceDesc Source description for metadata
 * @returns Array of parsed CodeExample objects
 */
export async function parseCookbookFile(filePath: string, sourceDesc: string): Promise<CodeExample[]> {
  const content = await readFileContent(filePath);
  if (!content) return [];
  
  // Parse frontmatter
  const { data: frontmatter, content: markdownContent } = parseFrontmatter(content);
  
  // Extract example blocks
  const exampleBlocks = extractExampleBlocks(markdownContent);
  
  // Convert to CodeExample objects
  const examples: CodeExample[] = [];
  for (const block of exampleBlocks) {
    // Skip empty blocks
    if (!block.content.trim()) continue;
    
    // Determine difficulty from frontmatter or default to Beginner
    let difficulty: z.infer<typeof DifficultyEnum> = 'Beginner';
    if (frontmatter.difficulty) {
      const normalizedDifficulty = frontmatter.difficulty.toString().toLowerCase();
      if (normalizedDifficulty.includes('intermediate')) {
        difficulty = 'Intermediate';
      } else if (normalizedDifficulty.includes('advanced')) {
        difficulty = 'Advanced';
      }
    }
    
    // Create a unique ID for the example
    const id = uuidv4();
    
    // Get the file name for the title if not specified
    const fileBasedTitle = path.basename(filePath, path.extname(filePath))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize first letter of each word
    
    const example = {
      id,
      title: block.title || frontmatter.title || fileBasedTitle,
      description: block.description || frontmatter.description || '',
      raw_code: block.content,
      html_context: block.html_context,
      source_info: {
        id: uuidv4(),
        source_url: frontmatter.source_url,
        source_description: `Hyperscript Cookbook - ${path.basename(filePath)}`,
        document_path: filePath
      },
      difficulty,
      status: 'New' as const,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    try {
      // Validate against the schema
      const validatedExample = CodeExampleSchema.parse(example);
      examples.push(validatedExample);
    } catch (e) {
      console.error(`[ERR] Validation failed for example in ${filePath}:`, e);
    }
  }
  
  return examples;
}

/**
 * Parses an entire directory of cookbook markdown files
 * @param directoryPath Path to the directory containing cookbook markdown files
 * @param sourceDesc Source description for metadata
 * @returns Array of parsed CodeExample objects
 */
export async function parseCookbookDirectory(directoryPath: string, sourceDesc: string): Promise<CodeExample[]> {
  console.log(`\nParsing cookbook examples from directory: ${directoryPath}...`);
  const allExamples: CodeExample[] = [];
  
  try {
    const files = await fs.readdir(directoryPath);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(directoryPath, file);
        console.log(`  Processing cookbook file: ${file}`);
        
        const examples = await parseCookbookFile(filePath, sourceDesc);
        if (examples.length > 0) {
          console.log(`    Found ${examples.length} examples in ${file}`);
          allExamples.push(...examples);
        } else {
          console.log(`    No examples found in ${file}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading cookbook directory ${directoryPath}:`, error);
  }
  
  console.log(`Parsed ${allExamples.length} cookbook examples from directory.`);
  return allExamples;
}

/**
 * Detects grammar elements used in a hyperscript code example
 * @param rawCode The hyperscript code to analyze
 * @param grammarElements Object containing all grammar elements for lookup
 * @returns Array of grammar element IDs found in the code
 */
export function detectGrammarElements(
  rawCode: string,
  grammarElements: {
    commands: any[];
    features: any[];
    expressions: any[];
    keywords: any[];
    specialSymbols: any[];
  }
): string[] {
  const elementIds: string[] = [];
  
  // Convert code to lowercase for case-insensitive matching
  const lowerCode = rawCode.toLowerCase();
  
  // Check for commands
  for (const command of grammarElements.commands) {
    if (lowerCode.includes(command.name.toLowerCase())) {
      elementIds.push(command.id);
    }
  }
  
  // Check for features
  for (const feature of grammarElements.features) {
    if (lowerCode.includes(feature.name.toLowerCase())) {
      elementIds.push(feature.id);
    }
  }
  
  // Check for expressions
  for (const expression of grammarElements.expressions) {
    if (lowerCode.includes(expression.name.toLowerCase())) {
      elementIds.push(expression.id);
    }
  }
  
  // Check for keywords
  for (const keyword of grammarElements.keywords) {
    // Use word boundary for keywords to avoid partial matches
    const regex = new RegExp(`\\b${keyword.name.toLowerCase()}\\b`, 'i');
    if (regex.test(lowerCode)) {
      elementIds.push(keyword.id);
    }
  }
  
  // Check for special symbols
  for (const symbol of grammarElements.specialSymbols) {
    if (lowerCode.includes(symbol.symbol.toLowerCase())) {
      elementIds.push(symbol.id);
    }
  }
  
  return elementIds;
}

/**
 * Writes extracted examples to a JSON file
 * @param examples Array of CodeExample objects
 * @param outputPath Path to the output JSON file
 */
export async function writeExamplesToJson(examples: CodeExample[], outputPath: string): Promise<void> {
  try {
    await Bun.write(outputPath, JSON.stringify(examples, null, 2));
    console.log(`Saved ${examples.length} examples to ${outputPath}`);
  } catch (error) {
    console.error(`Error writing examples to ${outputPath}:`, error);
  }
}

/**
 * Main function to process cookbook examples
 * @param cookbookPath Path to the cookbook directory
 * @param outputPath Path to save the extracted examples
 */
export async function processCookbookExamples(
  cookbookPath: string,
  outputPath: string
): Promise<void> {
  // Parse all cookbook files
  const examples = await parseCookbookDirectory(cookbookPath, 'Hyperscript Cookbook');
  
  // Write examples to JSON
  await writeExamplesToJson(examples, outputPath);
}

// If this file is run directly
if (import.meta.main) {
  const COOKBOOK_DIR_PATH = "../../www/cookbook";
  const OUTPUT_PATH = "./data/collected_json/markdown_cookbook_examples.json";
  
  processCookbookExamples(COOKBOOK_DIR_PATH, OUTPUT_PATH)
    .then(() => console.log("Cookbook example extraction complete!"))
    .catch(err => console.error("Error in cookbook example extraction:", err));
}