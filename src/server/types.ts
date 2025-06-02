/**
 * Type definitions for the LSP server implementation
 * Following the Language Server Protocol specification
 */

// --- Basic types ---

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

// --- Message types ---

export interface InitializeParams {
  processId: number | null;
  rootUri: string | null;
  capabilities: ClientCapabilities;
  trace?: 'off' | 'messages' | 'verbose';
  workspaceFolders?: { uri: string; name: string }[] | null;
}

export interface ClientCapabilities {
  workspace?: WorkspaceClientCapabilities;
  textDocument?: TextDocumentClientCapabilities;
  experimental?: any;
}

export interface WorkspaceClientCapabilities {
  applyEdit?: boolean;
  workspaceEdit?: any;
  didChangeConfiguration?: any;
  didChangeWatchedFiles?: any;
  symbol?: any;
  executeCommand?: any;
}

export interface TextDocumentClientCapabilities {
  synchronization?: any;
  completion?: CompletionClientCapabilities;
  hover?: any;
  signatureHelp?: any;
  declaration?: any;
  definition?: any;
  typeDefinition?: any;
  implementation?: any;
  references?: any;
  documentHighlight?: any;
  documentSymbol?: any;
  codeAction?: any;
  codeLens?: any;
  documentLink?: any;
  colorProvider?: any;
  formatting?: any;
  rangeFormatting?: any;
  onTypeFormatting?: any;
  rename?: any;
  publishDiagnostics?: any;
  foldingRange?: any;
  selectionRange?: any;
}

export interface CompletionClientCapabilities {
  dynamicRegistration?: boolean;
  completionItem?: any;
  completionItemKind?: any;
  contextSupport?: boolean;
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
}

export interface ServerCapabilities {
  textDocumentSync?: number | TextDocumentSyncOptions;
  completionProvider?: CompletionOptions;
  hoverProvider?: boolean | HoverOptions;
  signatureHelpProvider?: any;
  definitionProvider?: boolean;
  typeDefinitionProvider?: boolean;
  implementationProvider?: boolean;
  referencesProvider?: boolean;
  documentHighlightProvider?: boolean;
  documentSymbolProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  codeActionProvider?: boolean;
  codeLensProvider?: any;
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  documentOnTypeFormattingProvider?: any;
  renameProvider?: boolean;
  documentLinkProvider?: any;
  colorProvider?: boolean;
  foldingRangeProvider?: boolean;
  executeCommandProvider?: any;
  workspace?: any;
  experimental?: any;
}

export interface TextDocumentSyncOptions {
  openClose?: boolean;
  change?: number;
  willSave?: boolean;
  willSaveWaitUntil?: boolean;
  save?: boolean | SaveOptions;
}

export interface SaveOptions {
  includeText?: boolean;
}

export interface CompletionOptions {
  resolveProvider?: boolean;
  triggerCharacters?: string[];
}

export interface HoverOptions {
  workDoneProgress?: boolean;
}

// --- Completion types ---

export interface CompletionRequest extends TextDocumentPositionParams {
  context?: CompletionContext;
}

export interface CompletionContext {
  triggerKind: number;
  triggerCharacter?: string;
}

export interface CompletionResponse {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | MarkupContent;
  deprecated?: boolean;
  preselect?: boolean;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: any;
  additionalTextEdits?: any[];
  commitCharacters?: string[];
  command?: any;
  data?: any;
}

export interface MarkupContent {
  kind: string;
  value: string;
}

// --- Hover types ---

export interface HoverRequest extends TextDocumentPositionParams {}

export interface HoverResponse {
  contents: MarkupContent[] | string[];
  range?: Range;
}

// --- Diagnostic types ---

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  tags?: number[];
  relatedInformation?: DiagnosticRelatedInformation[];
}

export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}