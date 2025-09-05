import('./dist/integrations/zapier-mcp.js').then(async z => {
  try {
    console.log('🔧 Testing Zapier MCP connection...');
    const client = z.zapierMcp;
    
    await client.ensureConnected();
    console.log('✅ Connected to Zapier MCP');
    console.log('✅ Toolset available:', !!client.toolset);
    
    if (client.toolset) {
      console.log('✅ Available tools:', Object.keys(client.toolset));
      
      // Test a simple tool call
      try {
        console.log('🔧 Testing tool call...');
        const result = await client.callTool('google_sheets_get_data_range', {
          instructions: 'Test connection',
          worksheet: 'Customers',
          a1_range: 'A1:D5'
        });
        console.log('✅ Tool call successful:', result ? 'Data received' : 'No data');
      } catch (toolError) {
        console.log('⚠️ Tool call test failed (this is normal if no data):', toolError.message);
      }
    }
    
  } catch(e) {
    console.error('❌ Zapier MCP test failed:', e.message);
  }
}).catch(e => {
  console.error('❌ Error loading Zapier MCP:', e.message);
});
