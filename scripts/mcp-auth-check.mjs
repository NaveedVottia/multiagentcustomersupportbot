// Print Zapier MCP OAuth URL if required, using ESM dist paths
import { SSEClientTransport } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/sse.js";
import { Client } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";

class ConsoleOAuthProvider {
  constructor(redirectUrlStr) {
    this.redirectUrlStr = redirectUrlStr;
    this._tokens = undefined;
    this._clientInfo = undefined;
    this._codeVerifier = undefined;
  }
  get redirectUrl() { return this.redirectUrlStr; }
  get clientMetadata() { return { client_name: 'Sanden Repair System' }; }
  clientInformation() { return this._clientInfo; }
  saveClientInformation(info) { this._clientInfo = info; }
  tokens() { return this._tokens; }
  saveTokens(tokens) { this._tokens = tokens; }
  async redirectToAuthorization(authorizationUrl) {
    console.log('Open this URL to authorize Zapier MCP:');
    console.log(authorizationUrl.href);
  }
  saveCodeVerifier(codeVerifier) { this._codeVerifier = codeVerifier; }
  async codeVerifier() { if (!this._codeVerifier) throw new Error('code verifier missing'); return this._codeVerifier; }
}

async function main() {
  const rawUrl = process.env.ZAPIER_MCP_URL;
  if (!rawUrl) { console.error('ZAPIER_MCP_URL is not set'); process.exit(1); }
  const provider = new ConsoleOAuthProvider('https://localhost/blank');
  const transport = new SSEClientTransport(new URL(rawUrl), { authProvider: provider });
  await transport.start();
  const client = new Client(transport);
  await client.connect();
  console.log('Connected; if no URL printed above, auth is not required.');
  await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });


