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
    if (!url) throw new Error("ZAPIER_MCP_URL is not set");

    this.connecting = (async () => {
      this.mcp = new MCPClient({
        servers: {
          Zapier: { url: new URL(url) },
        },
        timeout: 20000,
      });
      const toolsets = await this.mcp.getToolsets();
      this.toolset = toolsets["Zapier"] || {};
    })();
    return this.connecting;
  }

  async callTool(toolName: string, params: ToolCallParams): Promise<any> {
    await this.ensureConnected();
    if (!this.toolset) throw new Error("Zapier MCP toolset unavailable");
    
    // Map tool names to Zapier MCP tool names - Using exact names from Zapier MCP
    const toolNameMap: Record<string, string> = {
      "google_sheets_lookup_spreadsheet_rows_advanced": "google_sheets_lookup_spreadsheet_rows_advanced",
      "google_sheets_get_many_spreadsheet_rows_advanced": "google_sheets_get_many_spreadsheet_rows_advanced",
      "google_sheets_create_spreadsheet_row": "google_sheets_create_spreadsheet_row",
      "google_sheets_update_spreadsheet_row": "google_sheets_update_spreadsheet_row",
      "google_sheets_update_spreadsheet_row_s": "google_sheets_update_spreadsheet_row_s",
      "google_sheets_create_spreadsheet_row_at_top": "google_sheets_create_spreadsheet_row_at_top",
      "google_sheets_lookup_spreadsheet_row": "google_sheets_lookup_spreadsheet_row",
      "google_sheets_find_worksheet": "google_sheets_find_worksheet",
      "google_sheets_get_data_range": "google_sheets_get_data_range",
      "google_calendar_quick_add_event": "google_calendar_quick_add_event",
      "ai_by_zapier_extract_content_from_url_beta": "ai_by_zapier_extract_content_from_url_beta",
      "add_tools": "add_tools",
      "edit_tools": "edit_tools"
    };
    
    const zapierToolName = toolNameMap[toolName] || toolName;
    const tool = this.toolset[zapierToolName];
    
    if (!tool || typeof tool.execute !== "function") {
      throw new Error(`Zapier MCP tool not found: ${zapierToolName}`);
    }
    
    console.log(`🔧 Calling Zapier MCP tool: ${zapierToolName} with params:`, params);
    const res = await tool.execute({ context: params });
    console.log(`✅ Zapier MCP tool response:`, res);
    return res;
  }
}

export const zapierMcp = ZapierMcpClient.getInstance();


