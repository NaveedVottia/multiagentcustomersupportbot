import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { Client } from '@modelcontextprotocol/sdk/client';

const rawUrl = process.env.ZAPIER_MCP_URL;
if (!rawUrl) {
  throw new Error('ZAPIER_MCP_URL is not set. Please export it to connect.');
}

// Use Zapier's https URL directly for SSE transport
const url = new URL(rawUrl);

(async () => {
  try {
    console.log('Connecting to Zapier MCP server...');

    const transport = new SSEClientTransport(url);
    await transport.start();
    console.log('Transport started successfully!');

    const client = new Client(transport);
    await client.connect();
    console.log('Connected successfully!');

    const tools = await client.listTools();
    console.log('\nAvailable Zapier MCP Tools:');
    console.log('=============================');

    tools.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      if (tool.description) {
        console.log(`   Description: ${tool.description}`);
      }
      if (tool.inputSchema) {
        console.log(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
      }
      console.log('');
    });

    console.log(`Total tools available: ${tools.tools.length}`);

    await client.close();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Error connecting to Zapier MCP server:', error);
  }
})();
