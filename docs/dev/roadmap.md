# Hyperscript LSP Roadmap: Completing Language Aspect Collection

This document outlines the plan for completing the collection of all hyperscript language aspects as defined in our schemas. The goal is to systematically identify, extract, and store all language components required for a complete LSP implementation.

## Current Status

We have successfully collected and structured data for:

-  Commands (src/scripts/data/collected_json/markdown_commands.json)
-  Features (src/scripts/data/collected_json/markdown_features.json)

Still needed to be collected:

-  Expressions (code exists in scrape-cheerio.ts but needs to be executed)
-  Keywords
-  Special Symbols

## Test-Driven Development Plan

The following plan adopts a test-driven approach to ensure we correctly capture all language aspects.

### 1. Expressions Collection (Priority: High)

The code for parsing expressions already exists in the scrape-cheerio.ts file but needs to be executed to generate the JSON data.

**Tests:**

1. Verify expression schema matches what's defined in schemas.ts
2. Test parsing of different expression categories (Arithmetic, Logical, etc.)
3. Validate JSON output against schema
4. Verify expression canonical forms are captured correctly

**Tasks:**

1. Run existing scrape-cheerio.ts script to generate markdown_expressions.json
2. Validate expressions against the schema
3. Manual review of expressions data for completeness and accuracy
4. Document any gaps or inconsistencies found

### 2. Keywords Collection (Priority: High)

Keywords are essential contextual elements in hyperscript syntax.

**Tests:**

1. Create tests to validate keyword schema implementation
2. Test keyword extraction from documentation sources
3. Validate context awareness and classification of keywords
4. Ensure relationships between keywords and other language elements are captured

**Tasks:**

1. Extend scrape-cheerio.ts to include keyword parsing:
   - Identify sources for keywords documentation
   - Implement parsing functions similar to parseCommandFile/parseFeatureFile
   - Generate markdown_keywords.json

2. Create a comprehensive list of hyperscript keywords by:
   - Analyzing existing commands and features
   - Reviewing language documentation
   - Examining code examples

3. Implement schema validation for keywords
4. Document keyword relationships to other language constructs

### 3. Special Symbols Collection (Priority: Medium)

Special symbols include important constructs like 'me', 'it', and others.

**Tests:**

1. Create tests for special symbol extraction
2. Validate symbol categorization (Variable, Keyword, Operator, etc.)
3. Test scope implications handling
4. Verify symbol usage examples are correctly extracted

**Tasks:**

1. Extend scrape-cheerio.ts to include special symbol parsing:
   - Define sources for special symbols documentation
   - Implement parsing logic
   - Generate markdown_special_symbols.json

2. Create a comprehensive list of hyperscript special symbols by:
   - Analyzing existing documentation
   - Reviewing code examples
   - Identifying implicit and explicit symbols

3. Implement schema validation for special symbols
4. Document symbol scope and usage patterns

### 4. Unified Testing Framework (Priority: Medium)

**Tests:**

1. Create integration tests that validate relationships between language elements
2. Test for consistency across all collected data
3. Validate cross-references between language elements

**Tasks:**

1. Develop a unified testing framework that:
   - Validates all language aspects against their schemas
   - Checks for consistency across language elements
   - Verifies completeness of the collection

2. Create a report generator that identifies gaps or inconsistencies

### 5. Completeness Validation (Priority: High)

**Tests:**

1. Test for coverage of all language constructs
2. Validate that all schema-defined properties are populated
3. Ensure proper linking between related language elements

**Tasks:**

1. Implement a comprehensive validation script that:
   - Compares collected data against a master list of language elements
   - Identifies missing or incomplete entries
   - Generates a completeness report

2. Manual review of edge cases and complex language constructs

## Implementation Timeline

1. **Week 1**: Complete Expressions collection and initial testing
2. **Week 2**: Implement Keywords collection and validation
3. **Week 3**: Implement Special Symbols collection and validation
4. **Week 4**: Develop unified testing framework and run completeness validation
5. **Week 5**: Address gaps, improve documentation, and prepare for integration

## Success Criteria

The collection will be considered complete when:

1. All five grammar element types are collected in their respective JSON files
2. All collected data passes schema validation
3. Comprehensive tests verify the correctness and relationships of language elements
4. Manual review confirms no significant language aspects are missing
5. The collected data is sufficient to power language server features:
   - Syntax highlighting
   - Autocompletion
   - Hover information
   - Navigation
   - Error diagnostics

## Integration with LSP

Once the collection is complete, the final step will be integration with the LSP implementation:

1. Develop indexing and query mechanisms for the collected data
2. Implement LSP features using the collected language aspects
3. Test LSP features against real-world hyperscript code
4. Refine and optimize based on performance metrics

This roadmap represents a systematic approach to ensuring our language server has a complete understanding of hyperscript syntax and semantics, enabling rich and accurate developer tooling.
