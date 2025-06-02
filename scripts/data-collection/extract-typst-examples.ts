import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { writeExamplesToJson, type CodeExample } from './enhanced-cookbook-parser';

/**
 * Extract hyperscript examples from Typst file content
 * @param content Typst file content
 * @param sourceFile Source file path
 * @returns Array of code examples
 */
function extractExamplesFromTypst(content: string, sourceFile: string): CodeExample[] {
  const examples: CodeExample[] = [];
  const lines = content.split('\n');
  
  let currentTitle = '';
  let currentDescription = '';
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = '';
  let htmlContext = '';
  
  // Helper function to process code blocks
  const processCodeBlock = () => {
    if (codeBlockContent.trim()) {
      // For hyperscript blocks
      if (codeBlockLang === 'hyperscript' || codeBlockLang === '_') {
        examples.push(createExample(
          currentTitle || currentDescription || 'Hyperscript Example',
          currentDescription,
          codeBlockContent.trim(),
          htmlContext,
          sourceFile
        ));
        htmlContext = ''; // Reset HTML context
      }
      // For HTML blocks that might contain hyperscript
      else if (codeBlockLang === 'html' && codeBlockContent.includes('_=')) {
        const { hyperscript_code, html_context } = extractHyperscriptFromHtml(codeBlockContent);
        if (hyperscript_code) {
          examples.push(createExample(
            currentTitle || currentDescription || 'HTML with Hyperscript',
            currentDescription,
            hyperscript_code,
            html_context,
            sourceFile
          ));
        }
      }
      // Store HTML context for next hyperscript block if it's just HTML
      else if (codeBlockLang === 'html') {
        htmlContext = codeBlockContent.trim();
      }
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Track section headings for context
    if (trimmedLine.startsWith('===') || trimmedLine.startsWith('==') || trimmedLine.startsWith('=')) {
      currentTitle = trimmedLine.replace(/^=+\s*/, '').replace(/<[^>]+>$/, '').trim();
    }
    
    // Track figure captions
    if (line.includes('#figure(caption:') || line.includes('#figure[')) {
      const captionMatch = line.match(/caption:\s*\[([^\]]+)\]/);
      if (captionMatch) {
        currentDescription = captionMatch[1];
      }
    }
    
    // Check for code block start (in Typst, these are often within #figure[] blocks)
    if (trimmedLine.includes('```')) {
      if (!inCodeBlock && trimmedLine.includes('```')) {
        // Starting a code block
        inCodeBlock = true;
        // Extract language from the line
        const langMatch = trimmedLine.match(/```(\w+)/);
        codeBlockLang = langMatch ? langMatch[1].toLowerCase() : '';
        codeBlockContent = '';
        
        // If the code block starts and ends on the same line (unlikely but possible)
        const closeIndex = trimmedLine.lastIndexOf('```');
        const openIndex = trimmedLine.indexOf('```');
        if (closeIndex > openIndex + 3) {
          inCodeBlock = false;
          codeBlockContent = trimmedLine.substring(openIndex + 3 + codeBlockLang.length, closeIndex).trim();
          processCodeBlock();
        }
      } else if (inCodeBlock && trimmedLine.includes('```')) {
        // Ending a code block
        processCodeBlock();
        codeBlockContent = '';
        codeBlockLang = '';
      }
    } else if (inCodeBlock) {
      // Accumulate code block content
      codeBlockContent += line + '\n';
    }
    
    // Also check for inline code that looks like hyperscript
    if (!inCodeBlock && line.includes('`')) {
      const inlineCodeMatches = line.match(/`([^`]+)`/g);
      if (inlineCodeMatches) {
        for (const match of inlineCodeMatches) {
          const code = match.slice(1, -1); // Remove backticks
          // Check if this looks like hyperscript (has common keywords and is substantial)
          if (code.match(/\b(on|tell|set|get|put|trigger|toggle|add|remove|transition|increment)\b/) && 
              code.length > 30 &&
              !code.match(/^(https?:|www\.|\.focus|\.textContent|\.js|\.html|\.css)/)) {
            examples.push(createExample(
              currentTitle || 'Inline Hyperscript Example',
              'Inline hyperscript code from documentation',
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
  const hyperscriptMatches = htmlContent.match(/_="([^"]+)"/g);
  const hyperscriptCode: string[] = [];
  
  if (hyperscriptMatches) {
    for (const match of hyperscriptMatches) {
      const code = match.slice(3, -1); // Remove _=" and "
      hyperscriptCode.push(code);
    }
  }
  
  return {
    hyperscript_code: hyperscriptCode.join('\n\n'),
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
      source_description: `Hyperscript Book - ${path.basename(sourceFile)}`,
      document_path: sourceFile
    },
    difficulty: 'Beginner', // Default difficulty
    status: 'New' as const,
    created_at: new Date(),
    updated_at: new Date()
  };
}

/**
 * Main function to extract examples from Typst file
 */
async function extractTypstExamples(): Promise<void> {
  console.log('Starting Typst example extraction...\n');
  
  const typstFile = path.join(import.meta.dir, '../../www/hypermedia-section.typ');
  
  try {
    const content = await fs.readFile(typstFile, 'utf-8');
    const examples = extractExamplesFromTypst(content, typstFile);
    
    console.log(`Found ${examples.length} examples in hypermedia-section.typ`);
    
    // Load existing examples
    const existingExamplesPath = path.join(import.meta.dir, './data/collected_json/markdown_cookbook_examples.json');
    let existingExamples: CodeExample[] = [];
    try {
      const file = Bun.file(existingExamplesPath);
      if (await file.exists()) {
        existingExamples = await file.json() as CodeExample[];
        console.log(`Loaded ${existingExamples.length} existing examples`);
      }
    } catch (error) {
      console.error('Error loading existing examples:', error);
    }
    
    // Combine examples
    const combinedExamples = [...existingExamples, ...examples];
    
    // Write combined examples
    await writeExamplesToJson(combinedExamples, existingExamplesPath);
    
    console.log(`\nExtraction complete!`);
    console.log(`Total examples: ${combinedExamples.length} (${existingExamples.length} existing + ${examples.length} new)`);
    
  } catch (error) {
    console.error('Error processing Typst file:', error);
  }
}

// Run the extraction
if (import.meta.main) {
  extractTypstExamples()
    .then(() => console.log('\nTypst example extraction finished!'))
    .catch(err => console.error('Error:', err));
}