// List Zapier MCP tools via SSE using the ESM dist paths
import { SSEClientTransport } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/sse.js";
import { Client } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";

async function main() {
  const rawUrl = process.env.ZAPIER_MCP_URL;
  if (!rawUrl) {
    console.error("ZAPIER_MCP_URL is not set");
    process.exit(1);
  }
  const url = new URL(rawUrl);
  console.log("Connecting to:", url.toString());
  const transport = new SSEClientTransport(url);
  await transport.start();
  const client = new Client(transport);
  await client.connect();
  const tools = await client.listTools();
  console.log("Tool count:", tools.tools?.length || 0);
  for (const t of tools.tools || []) {
    console.log("-", t.name);
  }
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


