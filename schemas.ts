import { z } from 'zod';

// --- Reusable Enums ---
const ElementScopeEnum = z.enum(['Local', 'Element', 'Global']);
const StatusEnum = z.enum(['Draft', 'Review', 'Approved', 'Deprecated']);
const DifficultyEnum = z.enum(['Beginner', 'Intermediate', 'Advanced']);

// --- 1. Source Information ---
const SourceInfoSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the source reference itself."),
  source_url: z.string().url().optional().describe("URL where the information or example was found."),
  source_description: z.string().describe("Description of the source (e.g., 'Official Docs - Commands', 'Cookbook - Example X', 'GitHub Issue #Y', 'Community Blog Post Z')."),
  hyperscript_version_context: z.string().optional().describe("Hyperscript version relevant to this entry, if known (e.g., '0.9.12', 'latest')."),
  retrieved_at: z.date().optional().describe("Date when the information was retrieved or recorded."),
  document_path: z.string().optional().describe("Specific path or section within a larger document if applicable (e.g., '/docs/commands#fetch').")
});

// --- 2. Base for Grammar Elements ---
const GrammarElementBaseSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for this grammar element definition."),
  name: z.string().describe("The primary name of the grammar element (e.g., command name, keyword, symbol)."),
  description: z.string().optional().describe("Explanation of what the element is and its general purpose."),
  syntax_canonical: z.string().optional().describe("The preferred or most common syntactic form."),
  syntax_variations: z.array(z.string()).optional().describe("Other valid ways the element can be written."),
  tags: z.array(z.string()).default([]).describe("Keywords for categorization (e.g., 'dom-manipulation', 'event-handling', 'control-flow')."),
  notes: z.string().optional().describe("Additional observations, LSP implications, common pitfalls, or areas of confusion."),
  references: z.array(z.string().url()).optional().describe("Direct links to documentation or discussions about this specific element."),
  status: StatusEnum.default('Draft'),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

// --- 3. Specific Grammar Element Schemas ---

// 3.1 Command Definition
const CommandArgumentSchema = z.object({
  name: z.string().describe("Name of the argument/parameter."),
  type: z.string().describe("Expected type of the argument (e.g., 'Expression', 'Selector', 'StringLiteral', 'Number')."),
  description: z.string().optional().describe("Explanation of the argument."),
  is_optional: z.boolean().default(false).describe("Whether the argument is optional."),
  default_value: z.string().optional().describe("Default value if the argument is omitted."),
});

const CommandDefinitionSchema = GrammarElementBaseSchema.extend({
  elementType: z.literal("Command").describe("Discriminator field."),
  purpose: z.string().optional().describe("Specific goal or action this command performs."),
  arguments: z.array(CommandArgumentSchema).optional().describe("Formal arguments the command accepts."),
  implicit_target: z.string().optional().describe("Default target if not specified (e.g., 'me', 'it')."),
  implicit_result_target: z.enum(["it", "result", "none"]).optional().describe("Where the command's result is typically placed (e.g., 'it', 'result', or 'none')."),
  example_usage: z.array(z.string()).optional().describe("Short, illustrative code snippets of the command."),
  related_elements: z.array(z.string()).optional().describe("Names of other commands, keywords, or expressions often used with this one."),
  is_blocking: z.boolean().optional().describe("Does this command potentially halt execution (e.g., 'wait', 'fetch' before 'then')?"),
  has_body: z.boolean().optional().describe("Can this command contain a block of sub-commands (e.g., 'if', 'repeat')?"),
});

// 3.2 Expression Definition
const ExpressionCategoryEnum = z.enum(['Arithmetic', 'Logical', 'Comparison', 'StringManipulation', 'ObjectAccess', 'Other']);

const ExpressionDefinitionSchema = GrammarElementBaseSchema.extend({
  elementType: z.literal("Expression").describe("Discriminator field."),
  category: ExpressionCategoryEnum.describe("The general type of expression."),
  operators: z.array(z.string()).optional().describe("For logical, comparison, arithmetic expressions (e.g., '+', 'is', 'and')."),
  evaluates_to_type: z.string().optional().describe("The typical JavaScript data type this expression results in (e.g., 'String', 'Number', 'Boolean', 'Element', 'Array', 'Object', 'Promise', 'Any')."),
  example_usage: z.array(z.string()).optional().describe("Short, illustrative code snippets of the expression."),
  related_elements: z.array(z.string()).optional().describe("Names of commands or other expressions often used with this one."),
  precedence: z.number().int().optional().describe("Operator precedence, if applicable."),
  associativity: z.enum(['Left', 'Right', 'None']).optional().describe("Operator associativity, if applicable."),
});

// 3.3 Feature Definition
const FeatureDefinitionSchema = GrammarElementBaseSchema.extend({
  elementType: z.literal("Feature").describe("Discriminator field."),
  trigger: z.string().optional().describe("How the feature is initiated (e.g., 'on <event>', 'init', 'behavior <Name>')."),
  structure_description: z.string().optional().describe("Textual description of its typical syntactic structure (e.g., 'on <event-name> [filter] <commands> end')."),
  scope_impact: z.string().optional().describe("How this feature affects variable scope or the 'me'/'it' context."),
  example_usage: z.array(z.string()).optional().describe("Illustrative code snippets of the feature."),
});

// 3.4 Keyword Definition
const KeywordDefinitionSchema = GrammarElementBaseSchema.extend({
  elementType: z.literal("Keyword").describe("Discriminator field."),
  context_of_use: z.string().optional().describe("Where/how this keyword is typically used (e.g., 'part of \"if\" command', 'loop modifier', 'preposition in \"put\" command')."),
  is_optional_in_syntax: z.boolean().optional().describe("Is this keyword sometimes optional in its common syntactic constructs?"),
  example_usage: z.array(z.string()).optional().describe("Illustrative code snippets showing the keyword in context."),
});

// 3.5 Special Symbol Definition
const SpecialSymbolTypeEnum = z.enum(['Variable', 'Keyword', 'Operator', 'Delimiter', 'Other']);

const SpecialSymbolDefinitionSchema = GrammarElementBaseSchema.extend({
  elementType: z.literal("SpecialSymbol").describe("Discriminator field."),
  symbol_type: SpecialSymbolTypeEnum.describe("The category of the special symbol."),
  typical_value_or_referent: z.string().optional().describe("What it typically represents or resolves to (e.g., for 'it': 'result of previous command'; for 'me': 'the current HTML element')."),
  scope_implications: z.string().optional().describe("How it interacts with or depends on scope."),
  example_usage: z.array(z.string()).optional().describe("Illustrative code snippets of the symbol."),
});

// --- 4. Discriminated Union for all Grammar Elements ---
const GrammarElementSchema = z.discriminatedUnion("elementType", [
  CommandDefinitionSchema,
  ExpressionDefinitionSchema,
  FeatureDefinitionSchema,
  KeywordDefinitionSchema,
  SpecialSymbolDefinitionSchema
]);

// --- 5. Code Example Schema ---
const CodeExampleSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for this code example."),
  title: z.string().describe("A concise title for the example."),
  description: z.string().describe("Explanation of what the code snippet demonstrates or its purpose."),
  raw_code: z.string().describe("The actual Hyperscript code snippet."),
  html_context: z.string().optional().describe("Optional HTML markup that provides context for the Hyperscript snippet."),
  source_info: SourceInfoSchema.optional().describe("Origin of this example."),
  difficulty: DifficultyEnum.optional(),
  status: z.enum(['New', 'InProgress', 'Annotated', 'Reviewed']).default("New"),
  observed_behavior: z.string().optional().describe("What the code actually does when run, if tested."),
  ambiguities_illustrated: z.array(z.string().uuid()).optional().describe("IDs of AmbiguityReport entries this example helps illustrate."),
  lsp_test_case_implications: z.array(z.string()).optional().describe("How this example could be used as a test case for LSP features (e.g., 'autocompletion-for-put', 'diagnostic-for-missing-end')."),
  related_grammar_element_ids: z.array(z.string().uuid()).optional().describe("UUIDs of specific grammar elements (commands, expressions) prominently used or illustrated."),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

// --- 6. Ambiguity Report Schema ---
const AmbiguityReportSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for this ambiguity report."),
  title: z.string().describe("Short title summarizing the ambiguity."),
  description: z.string().describe("Detailed description of the observed ambiguity, its nature, and potential impact."),
  ambiguous_constructs: z.array(z.string()).describe("The specific Hyperscript syntax or patterns that are ambiguous (e.g., 'it variable context', 'prop of object vs object.prop')."),
  example_code_ids: z.array(z.string().uuid()).optional().describe("UUIDs of CodeExample entries that demonstrate this ambiguity."),
  potential_interpretations: z.array(z.object({
  severity: z.enum(["Low", "Medium", "High"]).optional().describe("Estimated impact of this ambiguity on developers or tooling."),
  status: z.enum(['Reported', 'Investigating', 'Resolved', 'Wontfix']).default("Reported"),
  })).optional().describe("Different ways the syntax could be understood."),
  resolution_suggestion: z.string().optional().describe("Ideas on how this ambiguity might be resolved in the language design, documentation, or LSP handling."),
  source_info: SourceInfoSchema.optional().describe("Where this ambiguity was first noted or discussed."),
  tags: z.array(z.string()).default([]).describe("Keywords (e.g., 'parsing-challenge', 'semantic-ambiguity', 'it-context', 'property-access')."),
  severity: z.enum(["Low", "Medium", "High"]).optional().describe("Estimated impact of this ambiguity on developers or tooling."),
  status: z.enum(['Reported', 'Investigating', 'Resolved', 'Wontfix']).default("Reported"),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

// --- Example Usage (for testing the schemas) ---
/*
const sampleCommand: z.infer<typeof CommandDefinitionSchema> = {
  elementType: 'Command',
  id: '...',
  name: 'put',
  description: 'Puts a value into a target.',
  syntax_canonical: 'put <expression> into <target>',
  tags: ['dom-manipulation', 'variable-assignment'],
  status: 'Reviewed',
  purpose: 'To assign a value or content.',
  arguments:,
  implicit_result_target: 'it',
  created_at: new Date(),
  updated_at: new Date(),
};

const sampleExample: z.infer<typeof CodeExampleSchema> = {
  id: '...',
  title: 'Simple Toggle Class',
  description: 'Demonstrates toggling a CSS class on click.',
  raw_code: '_="on click toggle.active on me"',
  html_context: '<button class="btn">Click Me</button>',
  source_info: {
    id: '...',
    source_description: 'Hyperscript.org homepage example',
    source_url: 'https://hyperscript.org'
  },
  tags: ['event-handling', 'class-manipulation', 'beginner'],
  status: 'Annotated',
  created_at: new Date(),
  updated_at: new Date(),
};

// Validate
// CommandDefinitionSchema.parse(sampleCommand);
// CodeExampleSchema.parse(sampleExample);
*/

export {
  SourceInfoSchema,
  GrammarElementBaseSchema,
  CommandArgumentSchema,
  CommandDefinitionSchema,
  ExpressionCategoryEnum,
  ExpressionDefinitionSchema,
  FeatureDefinitionSchema,
  KeywordDefinitionSchema,
  SpecialSymbolTypeEnum,
  SpecialSymbolDefinitionSchema,
  GrammarElementSchema,
  CodeExampleSchema,
  AmbiguityReportSchema,
  ElementScopeEnum,
  StatusEnum,
  DifficultyEnum
};
