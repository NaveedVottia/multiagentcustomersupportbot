import { MCPClient } from "@mastra/mcp";
import { readFileSync } from "fs";
import { resolve } from "path";

type ToolCallParams = Record<string, any>;

export class ZapierMcpClient {
  private static instance: ZapierMcpClient | null = null;
  private mcp: MCPClient | null = null;
  private toolset: Record<string, any> | null = null;
  private connecting: Promise<void> | null = null;

  static getInstance(): ZapierMcpClient {
    if (!ZapierMcpClient.instance) {
      ZapierMcpClient.instance = new ZapierMcpClient();
    }
    return ZapierMcpClient.instance;
  }

  private async ensureConnected(): Promise<void> {
    if (this.mcp && this.toolset) return;
    if (this.connecting) return this.connecting;

    let url = process.env.ZAPIER_MCP_URL;
    if (!url) {
      try {
        // Fallback to Cursor MCP config
        const cfgPath = resolve(process.env.HOME || "/home/ec2-user", ".cursor/mcp.json");
        const raw = readFileSync(cfgPath, "utf-8");
        const json = JSON.parse(raw);
        url = json?.mcpServers?.Zapier?.url;
        if (url) {
          try { process.env.ZAPIER_MCP_URL = url; } catch {}
        }
      } catch {}
    }
    if (!url) {
      console.warn("[Zapier MCP] ZAPIER_MCP_URL is not set, disabling Zapier integration");
      this.toolset = {}; // Empty toolset to prevent errors
      return;
    }

    this.connecting = (async () => {
      try {
        this.mcp = new MCPClient({
          servers: {
            Zapier: { url: new URL(url) },
          },
          timeout: 120000, // Increased timeout to 120 seconds for Zapier calls
        });
        const toolsets = await this.mcp.getToolsets();
        this.toolset = toolsets["Zapier"] || {};
        console.log("[Zapier MCP] Successfully connected to Zapier");
      } catch (error) {
        console.warn("[Zapier MCP] Failed to connect to Zapier:", error instanceof Error ? error.message : String(error));
        this.toolset = {}; // Empty toolset to prevent errors
        this.mcp = null;
      }
    })();
    return this.connecting;
  }

  async callTool(toolName: string, params: ToolCallParams): Promise<any> {
    await this.ensureConnected();
    if (!this.toolset || Object.keys(this.toolset).length === 0) {
      console.warn(`[Zapier MCP] Tool ${toolName} not available - Zapier MCP not connected`);
      return { error: "Zapier MCP not available", tool: toolName, params };
    }
    
    const tool = this.toolset[toolName];
    if (!tool || typeof tool.execute !== "function") {
      console.warn(`[Zapier MCP] Tool not found: ${toolName}`);
      return { error: "Tool not found", tool: toolName, params };
    }
    
    try {
      const res = await tool.execute({ context: params });
      return res;
    } catch (error) {
      console.warn(`[Zapier MCP] Tool execution failed for ${toolName}:`, error instanceof Error ? error.message : String(error));
      return { error: error instanceof Error ? error.message : String(error), tool: toolName, params };
    }
  }
}

export const zapierMcp = ZapierMcpClient.getInstance();


