import MarkdownIt from 'markdown-it';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';

// Import the parser functions and types from enhanced-cookbook-parser
import { 
  parseCookbookFile, 
  writeExamplesToJson,
  type CodeExample 
} from './enhanced-cookbook-parser';

const md = new MarkdownIt();

/**
 * Extract hyperscript examples from markdown content
 * @param content Markdown content to parse
 * @param sourceFile Source file name for metadata
 * @returns Array of code examples
 */
function extractExamplesFromMarkdown(content: string, sourceFile: string): CodeExample[] {
  const examples: CodeExample[] = [];
  const tokens = md.parse(content, {});
  
  let currentTitle = '';
  let currentDescription = '';
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (!token) continue;
    
    // Track headings for context
    if (token.type === 'heading_open' && i + 1 < tokens.length && tokens[i + 1]?.type === 'inline') {
      currentTitle = tokens[i + 1]?.content || '';
    }
    
    // Track paragraphs for descriptions
    if (token.type === 'paragraph_open' && i + 1 < tokens.length && tokens[i + 1]?.type === 'inline') {
      const inlineContent = tokens[i + 1]?.content || '';
      // Only use as description if it's not too long and comes before code
      if (inlineContent.length < 200) {
        currentDescription = inlineContent;
      }
    }
    
    // Look for code blocks
    if (token.type === 'fence') {
      const lang = token.info?.trim().toLowerCase() || '';
      const code = token.content.trim();
      
      // For hyperscript code blocks
      if (lang === 'hyperscript' || lang === '_' || lang === '') {
        // Check if this looks like hyperscript (contains common keywords)
        if (code.match(/\b(on|tell|set|get|put|trigger|toggle|add|remove|transition)\b/)) {
          examples.push(createExample(
            currentTitle || `Example from ${sourceFile}`,
            currentDescription,
            code,
            '',
            sourceFile
          ));
          currentDescription = ''; // Reset description after use
        }
      }
      
      // For HTML blocks that might contain hyperscript
      if (lang === 'html' && code.includes('_=')) {
        const { hyperscript_code, html_context } = extractHyperscriptFromHtml(code);
        if (hyperscript_code) {
          examples.push(createExample(
            currentTitle || `HTML Example from ${sourceFile}`,
            currentDescription,
            hyperscript_code,
            html_context,
            sourceFile
          ));
          currentDescription = ''; // Reset description after use
        }
      }
    }
    
    // Look for inline code that might be hyperscript
    if (token.type === 'inline' && token.content.includes('`')) {
      const inlineCodeMatches = token.content.match(/`([^`]+)`/g);
      if (inlineCodeMatches) {
        for (const match of inlineCodeMatches) {
          const code = match.slice(1, -1); // Remove backticks
          // Check if this looks like hyperscript
          if (code.match(/\b(on|tell|set|get|put|trigger|toggle|add|remove|transition)\b/) && code.length > 20) {
            examples.push(createExample(
              currentTitle || `Inline Example from ${sourceFile}`,
              currentDescription || 'Inline hyperscript example',
              code,
              '',
              sourceFile
            ));
          }
        }
      }
    }
  }
  
  return examples;
}

/**
 * Extract hyperscript from HTML content
 */
function extractHyperscriptFromHtml(htmlContent: string): { hyperscript_code: string; html_context: string } {
  const $ = cheerio.load(htmlContent, { xmlMode: false });
  const hyperscriptElements: string[] = [];
  
  $('[_]').each((_, el) => {
    const hyperscriptCode = $(el).attr('_');
    if (hyperscriptCode) {
      hyperscriptElements.push(hyperscriptCode.trim());
    }
  });
  
  return {
    hyperscript_code: hyperscriptElements.join('\n\n'),
    html_context: htmlContent
  };
}

/**
 * Create a CodeExample object
 */
function createExample(
  title: string, 
  description: string, 
  code: string, 
  htmlContext: string,
  sourceFile: string
): CodeExample {
  return {
    id: uuidv4(),
    title: title.substring(0, 100), // Limit title length
    description: description.substring(0, 200), // Limit description length
    raw_code: code,
    html_context: htmlContext || undefined,
    source_info: {
      id: uuidv4(),
      source_description: `Hyperscript Documentation - ${path.basename(sourceFile)}`,
      document_path: sourceFile
    },
    difficulty: 'Beginner', // Default difficulty
    status: 'New' as const,
    created_at: new Date(),
    updated_at: new Date()
  };
}

/**
 * Extract examples specifically from comparison.md (only hyperscript examples)
 */
async function extractFromComparison(filePath: string): Promise<CodeExample[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const examples: CodeExample[] = [];
  
  // In comparison.md, hyperscript examples are typically shown alongside other frameworks
  // We need to be more selective
  const lines = content.split('\n');
  let inHyperscriptSection = false;
  let currentExample = '';
  let currentTitle = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for hyperscript section headers
    if (line.match(/hyperscript/i) && line.match(/^#+/)) {
      inHyperscriptSection = true;
      currentTitle = line.replace(/^#+\s*/, '').trim();
    } else if (line.match(/^#+/) && !line.match(/hyperscript/i)) {
      inHyperscriptSection = false;
    }
    
    // Look for code blocks
    if (line.trim() === '```hyperscript' || line.trim() === '```_') {
      let j = i + 1;
      currentExample = '';
      while (j < lines.length && lines[j].trim() !== '```') {
        currentExample += lines[j] + '\n';
        j++;
      }
      if (currentExample.trim()) {
        examples.push(createExample(
          currentTitle || 'Hyperscript Comparison Example',
          'Example showing hyperscript compared to other frameworks',
          currentExample.trim(),
          '',
          filePath
        ));
      }
      i = j; // Skip to end of code block
    }
    
    // Also look for HTML with hyperscript
    if (line.trim() === '```html' && inHyperscriptSection) {
      let j = i + 1;
      let htmlContent = '';
      while (j < lines.length && lines[j].trim() !== '```') {
        htmlContent += lines[j] + '\n';
        j++;
      }
      if (htmlContent.includes('_=')) {
        const { hyperscript_code, html_context } = extractHyperscriptFromHtml(htmlContent);
        if (hyperscript_code) {
          examples.push(createExample(
            currentTitle || 'Hyperscript HTML Example',
            'Hyperscript embedded in HTML',
            hyperscript_code,
            html_context,
            filePath
          ));
        }
      }
      i = j; // Skip to end of code block
    }
  }
  
  return examples;
}

/**
 * Main function to extract examples from all documentation files
 */
async function extractAllDocExamples(): Promise<void> {
  console.log('Starting documentation example extraction...\n');
  
  const allExamples: CodeExample[] = [];
  const files = [
    { path: '../../www/a-fun-guide.md', name: 'A Fun Guide' },
    { path: '../../www/comparison.md', name: 'Comparison', special: true },
    { path: '../../www/docs.md', name: 'Documentation' },
    { path: '../../www/index.md', name: 'Index' }
  ];
  
  for (const file of files) {
    const filePath = path.join(import.meta.dir, file.path);
    console.log(`Processing ${file.name}...`);
    
    try {
      let examples: CodeExample[];
      
      if (file.special && file.name === 'Comparison') {
        // Special handling for comparison.md
        examples = await extractFromComparison(filePath);
      } else {
        // Use general extraction for other files
        const content = await fs.readFile(filePath, 'utf-8');
        examples = extractExamplesFromMarkdown(content, filePath);
      }
      
      console.log(`  Found ${examples.length} examples in ${file.name}`);
      allExamples.push(...examples);
    } catch (error) {
      console.error(`  Error processing ${file.name}:`, error);
    }
  }
  
  // Load existing cookbook examples
  const cookbookExamplesPath = path.join(import.meta.dir, './data/collected_json/markdown_cookbook_examples.json');
  let existingExamples: CodeExample[] = [];
  try {
    const file = Bun.file(cookbookExamplesPath);
    if (await file.exists()) {
      existingExamples = await file.json() as CodeExample[];
      console.log(`\nLoaded ${existingExamples.length} existing cookbook examples`);
    }
  } catch (error) {
    console.error('Error loading existing examples:', error);
  }
  
  // Combine all examples
  const combinedExamples = [...existingExamples, ...allExamples];
  
  // Write combined examples to file
  const outputPath = path.join(import.meta.dir, './data/collected_json/markdown_cookbook_examples.json');
  await writeExamplesToJson(combinedExamples, outputPath);
  
  console.log(`\nExtraction complete!`);
  console.log(`Total examples: ${combinedExamples.length} (${existingExamples.length} existing + ${allExamples.length} new)`);
}

// Run the extraction
if (import.meta.main) {
  extractAllDocExamples()
    .then(() => console.log('\nDoc example extraction finished!'))
    .catch(err => console.error('Error in doc example extraction:', err));
}