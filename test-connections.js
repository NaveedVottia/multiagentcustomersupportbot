#!/usr/bin/env node

// Test Langfuse and Zapier connections
const { loadLangfusePrompt } = require('./src/mastra/prompts/langfuse.ts');
const { zapierMcp } = require('./src/integrations/zapier-mcp.ts');

async function testConnections() {
  console.log('🔍 Testing Langfuse connection...');

  try {
    const prompt = await loadLangfusePrompt('customer-identification');
    console.log('✅ Langfuse connection: SUCCESS');
    console.log('📝 Prompt length:', prompt.length);
  } catch (error) {
    console.log('❌ Langfuse connection: FAILED');
    console.log('Error:', error.message);
  }

  console.log('\n🔍 Testing Zapier connection...');

  try {
    const result = await zapierMcp.callTool('google_sheets_get_data_range', {
      instructions: 'Test connection',
      a1_range: 'A1:B1'
    });
    console.log('✅ Zapier connection: SUCCESS');
    console.log('📊 Result type:', typeof result);
  } catch (error) {
    console.log('❌ Zapier connection: FAILED');
    console.log('Error:', error.message);
  }
}

testConnections().catch(console.error);
