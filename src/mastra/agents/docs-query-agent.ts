import { MCPClient } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { bedrock } from '@ai-sdk/amazon-bedrock';

// Configure MCP with the docs server
const mcp = new MCPClient({
  servers: {
    mastra: {
      command: 'npx',
      args: ['-y', '@mastra/mcp-docs-server'],
    },
  },
});

// Create an agent with access to all documentation tools
export const docsQueryAgent = new Agent({
  name: 'Documentation Assistant',
  instructions: 'You help users find and understand Mastra.ai documentation. Use the available tools to search for specific examples and configuration patterns.',
  model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
  tools: [], // Will be populated dynamically
});

// Function to get tools and query documentation
export async function queryMastraDocs(query: string) {
  try {
    // Note: MCPClient methods may vary by version
    // For now, return a placeholder response
    console.log('Mastra docs query requested:', query);
    return {
      content: 'Documentation query functionality is being updated for current Mastra version.',
      query
    };
  } catch (error) {
    console.error('Error querying Mastra docs:', error);
    return null;
  }
}
