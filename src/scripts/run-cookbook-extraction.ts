#!/usr/bin/env bun

import * as path from 'node:path';
import { $ } from 'bun';

// Ensure the data directories exist
import { mkdir } from 'node:fs/promises';

// Config
const COOKBOOK_DIR_PATH = "../../www/cookbook";
const OUTPUT_PATH = "./data/collected_json/markdown_cookbook_examples.json";
const DATA_DIR = path.join(import.meta.dir, './data/collected_json');

async function ensureDirectoryExists(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
    console.log(`Ensured directory exists: ${dir}`);
  } catch (error) {
    // Directory already exists or other error
    if ((error as any).code !== 'EEXIST') {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

async function runProcess(command: string, args: string[], description: string) {
  console.log(`\n=== ${description} ===`);
  try {
    const process = Bun.spawn({
      cmd: [command, ...args],
      stdout: 'inherit',
      stderr: 'inherit',
    });
    
    const exitCode = await process.exited;
    if (exitCode !== 0) {
      console.error(`Process '${description}' failed with exit code ${exitCode}`);
      return false;
    }
    console.log(`Process '${description}' completed successfully.`);
    return true;
  } catch (error) {
    console.error(`Error running process '${description}':`, error);
    return false;
  }
}

async function main() {
  console.log("Starting Hyperscript Cookbook Extraction Pipeline");
  console.log("=================================================");
  
  // Ensure data directory exists
  await ensureDirectoryExists(DATA_DIR);
  
  // Step 1: Run enhanced cookbook parser
  const parserSuccess = await runProcess(
    "bun", 
    ["run", "./enhanced-cookbook-parser.ts"], 
    "Extracting cookbook examples"
  );
  
  if (!parserSuccess) {
    console.error("Parser failed. Stopping pipeline.");
    process.exit(1);
  }
  
  // Step 2: Validate the extracted examples
  const validationSuccess = await runProcess(
    "bun", 
    ["run", "./validation/validate-cookbook-examples.ts"], 
    "Validating extracted examples"
  );
  
  if (!validationSuccess) {
    console.warn("Validation had issues, but continuing with enrichment...");
  }
  
  // Step 3: Enrich examples with grammar element detection
  const enrichmentSuccess = await runProcess(
    "bun", 
    ["run", "./enrich-cookbook-examples.ts"], 
    "Enriching examples with grammar element detection"
  );
  
  if (!enrichmentSuccess) {
    console.error("Enrichment failed. Database import may have incomplete data.");
    process.exit(1);
  }
  
  // Step 4: Reinitialize the database
  const dbInitSuccess = await runProcess(
    "bun", 
    ["run", "../db/schema.ts"], 
    "Reinitializing database schema"
  );
  
  if (!dbInitSuccess) {
    console.error("Database initialization failed. Stopping pipeline.");
    process.exit(1);
  }
  
  // Step 5: Import data into the database
  const importSuccess = await runProcess(
    "bun", 
    ["run", "../db/ingest.ts"], 
    "Importing all data into database"
  );
  
  if (!importSuccess) {
    console.error("Database import failed.");
    process.exit(1);
  }
  
  console.log("\n=================================================");
  console.log("Cookbook extraction pipeline completed successfully!");
  console.log("You can now query the database for cookbook examples.");
}

// Run the main function
if (import.meta.main) {
  main().catch(error => {
    console.error("Unhandled error in cookbook extraction pipeline:", error);
    process.exit(1);
  });
}