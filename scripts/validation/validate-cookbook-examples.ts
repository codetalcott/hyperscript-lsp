import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CodeExampleSchema } from '../../schemas';

// Define the type from the schema
type CodeExample = z.infer<typeof CodeExampleSchema>;

// Path to the cookbook examples JSON file
const COOKBOOK_EXAMPLES_PATH = "../data/collected_json/markdown_cookbook_examples.json";

/**
 * Validates that examples match the CodeExampleSchema
 * @param examples Array of cookbook examples to validate
 * @returns Array of valid examples
 */
async function validateExamples(examples: any[]): Promise<CodeExample[]> {
  console.log(`\nValidating ${examples.length} cookbook examples against schema...`);
  
  const validExamples: CodeExample[] = [];
  const invalidExamples: any[] = [];
  
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    
    try {
      // Validate against the schema
      const validatedExample = CodeExampleSchema.parse(example);
      validExamples.push(validatedExample);
    } catch (e) {
      console.error(`\n[ERR] Example #${i + 1} "${example.title || 'Untitled'}" failed validation:`);
      if (e instanceof z.ZodError) {
        console.error(e.errors.map(err => `  - ${err.path.join('.')}: ${err.message}`).join('\n'));
      } else {
        console.error(e);
      }
      invalidExamples.push(example);
    }
  }
  
  console.log(`\nValidation complete: ${validExamples.length} valid, ${invalidExamples.length} invalid examples.`);
  
  // Log detailed information about invalid examples
  if (invalidExamples.length > 0) {
    console.log("\nInvalid examples details:");
    for (let i = 0; i < invalidExamples.length; i++) {
      const example = invalidExamples[i];
      console.log(`\n#${i + 1}: ${example.title || 'Untitled'}`);
      console.log(`Source: ${example.source_info?.document_path || 'Unknown'}`);
      
      // Check for common issues
      if (!example.id) console.log("  - Missing ID");
      if (!example.title) console.log("  - Missing title");
      if (!example.description) console.log("  - Missing description");
      if (!example.raw_code) console.log("  - Missing code content");
      if (!example.source_info) console.log("  - Missing source information");
    }
  }
  
  return validExamples;
}

/**
 * Checks for completeness of example data
 * @param examples Array of valid cookbook examples
 */
function checkCompleteness(examples: CodeExample[]): void {
  console.log("\nChecking completeness of cookbook examples...");
  
  // Check for examples with missing HTML context
  const missingHtmlContext = examples.filter(ex => !ex.html_context);
  console.log(`Examples missing HTML context: ${missingHtmlContext.length} (${(missingHtmlContext.length / examples.length * 100).toFixed(1)}%)`);
  
  // Check for examples with very short descriptions
  const shortDescriptions = examples.filter(ex => ex.description.length < 20);
  console.log(`Examples with short descriptions (<20 chars): ${shortDescriptions.length} (${(shortDescriptions.length / examples.length * 100).toFixed(1)}%)`);
  
  // Check for examples with very short code
  const shortCode = examples.filter(ex => ex.raw_code.length < 10);
  console.log(`Examples with very short code (<10 chars): ${shortCode.length} (${(shortCode.length / examples.length * 100).toFixed(1)}%)`);
  
  // Count examples by difficulty
  const byDifficulty = examples.reduce((acc, ex) => {
    acc[ex.difficulty] = (acc[ex.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("\nExamples by difficulty:");
  for (const [difficulty, count] of Object.entries(byDifficulty)) {
    console.log(`  - ${difficulty}: ${count} (${(count / examples.length * 100).toFixed(1)}%)`);
  }
}

/**
 * Main validation function
 */
async function validateCookbookExamples(): Promise<void> {
  console.log("Starting cookbook examples validation...");
  
  try {
    // Read the examples JSON file
    const examplesPath = path.resolve(__dirname, COOKBOOK_EXAMPLES_PATH);
    const examplesFile = Bun.file(examplesPath);
    
    if (!(await examplesFile.exists())) {
      console.error(`\nError: Examples file not found at ${examplesPath}`);
      console.log("Run the cookbook extraction script first to generate the examples file.");
      process.exit(1);
    }
    
    const examplesJson = await examplesFile.json();
    
    if (!Array.isArray(examplesJson)) {
      console.error("\nError: Examples file does not contain an array of examples.");
      process.exit(1);
    }
    
    // Validate the examples
    const validExamples = await validateExamples(examplesJson);
    
    // Check for completeness
    checkCompleteness(validExamples);
    
    console.log("\nValidation process complete!");
    if (validExamples.length === examplesJson.length) {
      console.log("All examples passed validation.");
    } else {
      console.log(`${validExamples.length} of ${examplesJson.length} examples passed validation.`);
    }
  } catch (e) {
    console.error("An error occurred during validation:", e);
    process.exit(1);
  }
}

// Run the validation if this file is called directly
if (import.meta.main) {
  validateCookbookExamples()
    .then(() => {
      // Success
    })
    .catch(error => {
      console.error("Unhandled error in validation process:", error);
      process.exit(1);
    });
}

export { validateExamples, checkCompleteness };