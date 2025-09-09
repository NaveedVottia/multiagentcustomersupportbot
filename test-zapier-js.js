#!/usr/bin/env node

import { MCPClient } from "@mastra/mcp";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: "./server.env" });

class ZapierMcpTestClient {
  constructor() {
    this.mcp = null;
    this.toolset = null;
  }

  async ensureConnected() {
    if (this.mcp && this.toolset) return;

    let url = process.env.ZAPIER_MCP_URL;
    if (!url) {
      try {
        const cfgPath = resolve(process.env.HOME || "/home/ec2-user", ".cursor/mcp.json");
        const raw = readFileSync(cfgPath, "utf-8");
        const json = JSON.parse(raw);
        url = json?.mcpServers?.Zapier?.url;
      } catch {}
    }
    if (!url) throw new Error("ZAPIER_MCP_URL is not set");

    this.mcp = new MCPClient({
      servers: { Zapier: { url: new URL(url) } },
      timeout: 120000,
    });
    const toolsets = await this.mcp.getToolsets();
    this.toolset = toolsets["Zapier"] || {};
  }

  async callTool(toolName, params) {
    await this.ensureConnected();
    if (!this.toolset) throw new Error("Zapier MCP toolset unavailable");

    const tool = this.toolset[toolName];
    if (!tool || typeof tool.execute !== "function") {
      throw new Error(`Zapier MCP tool not found: ${toolName}`);
    }
    const res = await tool.execute({ context: params });
    return res;
  }
}

async function testZapierCall() {
  const zapierMcp = new ZapierMcpTestClient();

  try {
    console.log("🔍 Testing Zapier MCP call for customer lookup...");

    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "Look up customer data by store_name with query: マツモトキヨシ 千葉中央店",
      worksheet: "Customers",
      lookup_key: "会社名",
      lookup_value: "マツモトキヨシ 千葉中央店",
      row_count: "5"
    });

    console.log("✅ Zapier call successful!");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Test the data processing logic
    let rows = [];

    // First, try to extract from content[0].text if it's a JSON string
    if (result && result.content && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
      try {
        console.log(`🔍 [DEBUG] Found content[0].text, parsing JSON...`);
        const parsedContent = JSON.parse(result.content[0].text);
        console.log(`🔍 [DEBUG] Parsed content:`, JSON.stringify(parsedContent, null, 2));

        if (parsedContent && parsedContent.results && Array.isArray(parsedContent.results) && parsedContent.results[0] && parsedContent.results[0].rows) {
          rows = parsedContent.results[0].rows;
          console.log(`🔍 [DEBUG] Extracted rows from parsed content:`, JSON.stringify(rows, null, 2));
        }
      } catch (parseError) {
        console.log(`❌ [DEBUG] Failed to parse content[0].text as JSON:`, parseError);
      }
    }

    // Fallback to original logic if content parsing didn't work
    if (rows.length === 0) {
      if (result && result["0"] && result["0"].rows) {
        rows = result["0"].rows;
      } else if (result && Array.isArray(result)) {
        rows = result;
      } else if (result && result.rows) {
        rows = result.rows;
      } else if (result && result.results && result.results[0] && result.results[0].rows) {
        rows = result.results[0].rows;
      }
    }

    console.log("Extracted rows:", JSON.stringify(rows, null, 2));

    if (rows && rows.length > 0) {
      const bestMatch = rows[0];
      const customerData = {
        customerId: bestMatch["COL$A"] || bestMatch["顧客ID"] || bestMatch["id"],
        storeName: bestMatch["COL$B"] || bestMatch["会社名"] || bestMatch["storeName"],
        email: bestMatch["COL$C"] || bestMatch["メールアドレス"] || bestMatch["email"],
        phone: bestMatch["COL$D"] || bestMatch["電話番号"] || bestMatch["phone"],
        location: bestMatch["COL$E"] || bestMatch["所在地"] || bestMatch["location"],
        found: true
      };

      console.log("✅ Customer data extracted:", JSON.stringify(customerData, null, 2));
    } else {
      console.log("❌ No rows found");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testZapierCall();
