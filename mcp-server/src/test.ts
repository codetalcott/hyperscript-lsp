import { analyzeTool, hoverTool, searchTool, generateTool } from './tools/index.js';

async function runTests() {
  console.log('Testing Hyperscript MCP Tools\n');
  
  // Test analyze tool
  console.log('1. Testing analyze_hyperscript:');
  const analyzeResult = await analyzeTool.execute({
    code: `on click
  toggle .active
-- missing end`
  });
  console.log(analyzeResult.content[0].text);
  console.log('\n---\n');
  
  // Test hover tool
  console.log('2. Testing get_hover_info:');
  const hoverResult = await hoverTool.execute({
    element: 'toggle'
  });
  console.log(hoverResult.content[0].text);
  console.log('\n---\n');
  
  // Test search tool
  console.log('3. Testing search_language_elements:');
  const searchResult = await searchTool.execute({
    query: 'put',
    type: 'command'
  });
  console.log(searchResult.content[0].text);
  console.log('\n---\n');
  
  // Test generate tool
  console.log('4. Testing generate_hyperscript:');
  const generateResult = await generateTool.execute({
    pattern: 'form-validation',
    options: {
      fields: ['username', 'email']
    }
  });
  console.log(generateResult.content[0].text);
}

runTests().catch(console.error);