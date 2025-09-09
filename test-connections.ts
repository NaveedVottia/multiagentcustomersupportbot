// Test Langfuse and Zapier connections
import { loadLangfusePrompt } from './src/mastra/prompts/langfuse';
import { zapierMcp } from './src/integrations/zapier-mcp';

async function testConnections() {
  console.log('🔍 Testing Langfuse connection...');

  try {
    const prompt = await loadLangfusePrompt('customer-identification');
    console.log('✅ Langfuse connection: SUCCESS');
    console.log('📝 Prompt length:', prompt.length);
    console.log('📝 First 100 chars:', prompt.substring(0, 100) + '...');
  } catch (error: any) {
    console.log('❌ Langfuse connection: FAILED');
    console.log('Error:', error.message);
  }

  console.log('\n🔍 Testing Zapier connection...');

  try {
    const result = await zapierMcp.callTool('google_sheets_get_data_range', {
      instructions: 'Test connection - get headers from customers worksheet',
      a1_range: 'A1:I1',
    });
    console.log('✅ Zapier connection: SUCCESS');
    console.log('📊 Result type:', typeof result);
    console.log('📊 Has results:', !!result);
  } catch (error: any) {
    console.log('❌ Zapier connection: FAILED');
    console.log('Error:', error.message);
  }
}

testConnections().catch(console.error);
