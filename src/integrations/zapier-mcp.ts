import { MCPClient } from "@mastra/mcp";
import { readFileSync } from "fs";
import { resolve } from "path";
import { langfuse } from "./langfuse";

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
    if (!url) throw new Error("ZAPIER_MCP_URL is not set");

    this.connecting = (async () => {
      this.mcp = new MCPClient({
        servers: {
          Zapier: { 
            url: new URL(url),
            headers: {
              'Accept': 'application/json, text/event-stream',
              'Content-Type': 'application/json'
            }
          },
        },
        timeout: 60000, // 60 seconds for Zapier calls
      });
      const toolsets = await this.mcp.getToolsets();
      this.toolset = toolsets["Zapier"] || {};
    })();
    return this.connecting;
  }

  async callTool(toolName: string, params: ToolCallParams): Promise<any> {
    const startTime = Date.now();
    let traceId: string | null = null;
    
    try {
      await this.ensureConnected();
      if (!this.toolset) throw new Error("Zapier MCP toolset unavailable");
      
      const tool = this.toolset[toolName];
      if (!tool || typeof tool.execute !== "function") {
        throw new Error(`Zapier MCP tool not found: ${toolName}`);
      }
      
      console.log(`[Zapier] Calling tool: ${toolName} with params:`, JSON.stringify(params, null, 2));
      
      // Execute the tool
      const res = await tool.execute({ context: params });
      
      const duration = Date.now() - startTime;
      
      // Log tool execution to Langfuse with detailed format
      await langfuse.logToolExecution(
        traceId,
        `zapier:${toolName}`,
        params,
        res,
        {
          duration: duration,
          toolType: "zapier_mcp",
          executionTime: new Date().toISOString(),
          success: true
        }
      );
      
      console.log(`[Zapier] Tool ${toolName} completed in ${duration}ms`);
      return res;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Log failed tool execution
      await langfuse.logToolExecution(
        traceId,
        `zapier:${toolName}`,
        params,
        { error: errorMessage },
        {
          duration: duration,
          toolType: "zapier_mcp",
          executionTime: new Date().toISOString(),
          success: false,
          error: errorMessage
        }
      );
      
      console.error(`[Zapier] Tool ${toolName} failed after ${duration}ms:`, errorMessage);
      throw error;
    }
  }
}

export const zapierMcp = ZapierMcpClient.getInstance();


