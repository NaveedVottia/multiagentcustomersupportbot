import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { Client } from '@modelcontextprotocol/sdk/client';
import type { OAuthClientInformationFull, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth';

class ConsoleOAuthProvider {
  private _tokens?: OAuthTokens;
  private _clientInfo?: OAuthClientInformationFull;
  private _codeVerifier?: string;

  constructor(private readonly redirectUrlStr: string) {}

  get redirectUrl() {
    return this.redirectUrlStr;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Sanden Repair System',
    };
  }

  clientInformation() {
    return this._clientInfo;
  }

  saveClientInformation(info: OAuthClientInformationFull) {
    this._clientInfo = info;
  }

  tokens() {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this._tokens = tokens;
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    // Print the URL so the user can open it in a browser
    console.log('Open this URL to authorize Zapier MCP:');
    console.log(authorizationUrl.href);
  }

  saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier() {
    if (!this._codeVerifier) throw new Error('code verifier missing');
    return this._codeVerifier;
  }
}

const rawUrl = process.env.ZAPIER_MCP_URL;
if (!rawUrl) {
  throw new Error('ZAPIER_MCP_URL is not set');
}

// Use an app-local redirect that you can paste back as a code
const provider = new ConsoleOAuthProvider('https://localhost/blank');

(async () => {
  try {
    const transport = new SSEClientTransport(new URL(rawUrl), { authProvider: provider });
    await transport.start();
    const client = new Client(transport);
    await client.connect();
    console.log('Connected; if no URL printed above, auth is not required.');
    await client.close();
  } catch (err) {
    console.error(err);
  }
})();


