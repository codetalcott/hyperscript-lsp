import { createConnection, createConnectionPool, type DatabaseConnection, type ConnectionPool } from "../db/connection";

// Types
export interface DatabaseServiceConfig {
  path?: string;
  poolSize?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number; // Cache time-to-live in milliseconds
}

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

export enum CompletionItemKind {
  Command = 1,
  Keyword = 2,
  Expression = 3,
  Feature = 4,
  Symbol = 5,
  Snippet = 6,
}

export interface HoverInfo {
  name: string;
  type: string;
  description?: string;
  syntax?: string;
  examples?: Array<{
    title: string;
    code: string;
  }>;
  relatedElements?: string[];
}

export interface Definition {
  type: string;
  element: any;
}

export interface DatabaseService {
  isReady: () => boolean;
  close: () => void;
  
  // Completion methods
  getCompletionItems: (prefix: string, elementType?: string) => Promise<any>;
  
  // Hover methods
  getHoverInfo: (name: string, elementType?: string) => Promise<HoverInfo | null>;
  
  // Definition methods
  findDefinition: (name: string) => Promise<Definition | null>;
}

// Simple in-memory cache
class Cache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private ttl: number;
  
  constructor(ttl: number = 60000) { // Default 1 minute
    this.ttl = ttl;
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key: string, value: T): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create database service for LSP
 */
export function createDatabaseService(config: DatabaseServiceConfig = {}): DatabaseService {
  const usePool = (config.poolSize || 1) > 1;
  let pool: ConnectionPool | null = null;
  let singleConnection: DatabaseConnection | null = null;
  let ready = false;
  
  // Initialize connection(s)
  try {
    if (usePool) {
      pool = createConnectionPool(config);
    } else {
      singleConnection = createConnection(config);
    }
    ready = true;
  } catch (error) {
    console.error("Failed to initialize database service:", error);
  }
  
  // Initialize cache if enabled
  const cacheEnabled = config.cacheEnabled !== false;
  const completionCache = cacheEnabled ? new Cache<any>(config.cacheTTL) : null;
  const hoverCache = cacheEnabled ? new Cache<HoverInfo>(config.cacheTTL) : null;
  
  // Helper to get a connection
  const getConnection = (): DatabaseConnection | null => {
    if (!ready) return null;
    if (pool) return pool.getConnection();
    return singleConnection;
  };
  
  // Helper to release a connection
  const releaseConnection = (conn: DatabaseConnection): void => {
    if (pool) pool.releaseConnection(conn);
  };
  
  return {
    isReady: () => ready,
    
    close: () => {
      ready = false;
      if (pool) {
        pool.close();
      } else if (singleConnection) {
        singleConnection.close();
      }
      if (completionCache) completionCache.clear();
      if (hoverCache) hoverCache.clear();
    },
    
    getCompletionItems: async (prefix: string, elementType?: string) => {
      const cacheKey = `completion:${prefix}:${elementType || 'all'}`;
      
      // Check cache
      if (completionCache) {
        const cached = completionCache.get(cacheKey);
        if (cached) return cached;
      }
      
      const conn = getConnection();
      if (!conn) return elementType === 'all' ? {} : [];
      
      try {
        let result: any;
        
        if (elementType === 'all' || !elementType) {
          // Return all element types
          result = {
            commands: conn.findCommands(prefix),
            keywords: conn.findKeywords(prefix),
            expressions: conn.findExpressions(prefix),
            features: conn.findFeatures(prefix),
            specialSymbols: conn.findSpecialSymbols(prefix)
          };
        } else {
          // Return specific element type
          switch (elementType) {
            case 'command':
              result = conn.findCommands(prefix);
              break;
            case 'keyword':
              result = conn.findKeywords(prefix);
              break;
            case 'expression':
              result = conn.findExpressions(prefix);
              break;
            case 'feature':
              result = conn.findFeatures(prefix);
              break;
            case 'symbol':
              result = conn.findSpecialSymbols(prefix);
              break;
            default:
              result = [];
          }
        }
        
        // Cache result
        if (completionCache) {
          completionCache.set(cacheKey, result);
        }
        
        return result;
      } catch (error) {
        console.error("Error getting completion items:", error);
        return elementType === 'all' ? {} : [];
      } finally {
        releaseConnection(conn);
      }
    },
    
    getHoverInfo: async (name: string, elementType?: string) => {
      const cacheKey = `hover:${name}:${elementType || 'any'}`;
      
      // Check cache
      if (hoverCache) {
        const cached = hoverCache.get(cacheKey);
        if (cached) return cached;
      }
      
      const conn = getConnection();
      if (!conn) return null;
      
      try {
        let element: any = null;
        let type = elementType;
        
        // If no element type specified, search all types
        if (!elementType) {
          const results = conn.searchElements(name);
          
          if (results.commands.length > 0) {
            element = results.commands[0];
            type = 'command';
          } else if (results.keywords.length > 0) {
            element = results.keywords[0];
            type = 'keyword';
          } else if (results.expressions.length > 0) {
            element = results.expressions[0];
            type = 'expression';
          } else if (results.features.length > 0) {
            element = results.features[0];
            type = 'feature';
          } else if (results.specialSymbols.length > 0) {
            element = results.specialSymbols[0];
            type = 'symbol';
          }
        } else {
          // Search specific element type
          switch (elementType) {
            case 'command':
              const commands = conn.findCommands(name);
              if (commands.length > 0) element = commands[0];
              break;
            case 'keyword':
              const keywords = conn.findKeywords(name);
              if (keywords.length > 0) element = keywords[0];
              break;
            case 'expression':
              const expressions = conn.findExpressions(name);
              if (expressions.length > 0) element = expressions[0];
              break;
            case 'feature':
              const features = conn.findFeatures(name);
              if (features.length > 0) element = features[0];
              break;
            case 'symbol':
              const symbols = conn.findSpecialSymbols(name);
              if (symbols.length > 0) element = symbols[0];
              break;
          }
        }
        
        if (!element) return null;
        
        // Get examples for this element
        const examples = conn.getExamplesForElement(element.id).map(ex => ({
          title: ex.title,
          code: ex.raw_code
        }));
        
        const hoverInfo: HoverInfo = {
          name: element.name || element.symbol,
          type: type!,
          description: element.description,
          syntax: element.syntax_canonical || element.syntax,
          examples: examples.slice(0, 3) // Limit to 3 examples
        };
        
        // Cache result
        if (hoverCache) {
          hoverCache.set(cacheKey, hoverInfo);
        }
        
        return hoverInfo;
      } catch (error) {
        console.error("Error getting hover info:", error);
        return null;
      } finally {
        releaseConnection(conn);
      }
    },
    
    findDefinition: async (name: string) => {
      const conn = getConnection();
      if (!conn) return null;
      
      try {
        const results = conn.searchElements(name);
        
        // Priority order: commands > features > keywords > expressions > symbols
        if (results.commands.length > 0) {
          return { type: 'command', element: results.commands[0] };
        } else if (results.features.length > 0) {
          return { type: 'feature', element: results.features[0] };
        } else if (results.keywords.length > 0) {
          return { type: 'keyword', element: results.keywords[0] };
        } else if (results.expressions.length > 0) {
          return { type: 'expression', element: results.expressions[0] };
        } else if (results.specialSymbols.length > 0) {
          return { type: 'symbol', element: results.specialSymbols[0] };
        }
        
        return null;
      } catch (error) {
        console.error("Error finding definition:", error);
        return null;
      } finally {
        releaseConnection(conn);
      }
    }
  };
}