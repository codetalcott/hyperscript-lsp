#!/usr/bin/env bun

/**
 * Simple test server for development and testing
 * This provides a basic HTTP API to test LSP functionality
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { parseHyperscript } from './parser';
import { 
  openDatabase, 
  searchElements, 
  getElementDetails,
  getAutocompletionExamples,
  findSimilarExamples,
  getAllCodeExamples,
  getElementCounts
} from '../db/query';

const app = new Hono();

// CORS middleware for development
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// Health check
app.get('/', (c) => {
  return c.json({ 
    message: 'Hyperscript LSP Server Test API',
    version: '0.1.0',
    status: 'running'
  });
});

// Get database stats
app.get('/stats', async (c) => {
  try {
    const db = openDatabase();
    const counts = getElementCounts(db);
    db.close();
    
    return c.json({
      success: true,
      data: counts
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Search endpoint
app.get('/search/:term', async (c) => {
  const searchTerm = c.req.param('term');
  
  try {
    const db = openDatabase();
    const results = searchElements(db, searchTerm);
    db.close();
    
    return c.json({
      success: true,
      query: searchTerm,
      data: results
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Parse hyperscript code
app.post('/parse', async (c) => {
  try {
    const body = await c.req.json();
    const code = body.code || '';
    
    const result = parseHyperscript(code);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Get autocompletion suggestions
app.post('/autocomplete', async (c) => {
  try {
    const body = await c.req.json();
    const { prefix = '', context = '', limit = 10 } = body;
    
    const db = openDatabase();
    
    // Get basic search results
    const searchResults = searchElements(db, prefix);
    
    // Get example-based suggestions
    const examples = getAutocompletionExamples(db, prefix, context, 3);
    
    db.close();
    
    const suggestions = [];
    
    // Add command suggestions
    for (const command of searchResults.commands.slice(0, 5)) {
      suggestions.push({
        type: 'command',
        label: command.name,
        detail: command.description,
        insertText: command.name
      });
    }
    
    // Add feature suggestions
    for (const feature of searchResults.features.slice(0, 5)) {
      suggestions.push({
        type: 'feature',
        label: feature.name,
        detail: feature.description,
        insertText: feature.name
      });
    }
    
    // Add example suggestions
    for (const example of examples) {
      suggestions.push({
        type: 'example',
        label: `Example: ${example.title}`,
        detail: example.description,
        code: example.raw_code,
        htmlContext: example.html_context
      });
    }
    
    return c.json({
      success: true,
      prefix,
      context,
      data: suggestions.slice(0, limit)
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Get element details
app.get('/element/:type/:id', async (c) => {
  const elementType = c.req.param('type');
  const elementId = c.req.param('id');
  
  try {
    const db = openDatabase();
    const details = getElementDetails(db, elementId, elementType);
    db.close();
    
    if (!details) {
      return c.json({
        success: false,
        error: 'Element not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: details
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Get code examples
app.get('/examples', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    const db = openDatabase();
    const examples = getAllCodeExamples(db, limit, offset);
    db.close();
    
    return c.json({
      success: true,
      limit,
      offset,
      data: examples
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Find similar examples
app.post('/similar', async (c) => {
  try {
    const body = await c.req.json();
    const { code = '', limit = 5 } = body;
    
    const db = openDatabase();
    const examples = findSimilarExamples(db, code, limit);
    db.close();
    
    return c.json({
      success: true,
      query: code,
      data: examples
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Start the server
const port = process.env.PORT || 3001;

console.log(`Starting Hyperscript LSP Test Server on port ${port}...`);
console.log(`Available endpoints:`);
console.log(`  GET  /               - Health check`);
console.log(`  GET  /stats          - Database statistics`);
console.log(`  GET  /search/:term   - Search elements`);
console.log(`  POST /parse          - Parse hyperscript code`);
console.log(`  POST /autocomplete   - Get autocompletion suggestions`);
console.log(`  GET  /element/:type/:id - Get element details`);
console.log(`  GET  /examples       - Get code examples`);
console.log(`  POST /similar        - Find similar examples`);

serve({
  fetch: app.fetch,
  port: Number(port)
});

// Export the app for testing
export default app;