import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";
import { sharedMemory, getSharedMemoryForAgent } from "../../agents/sanden/customer-identification";
import { sharedMastraMemory, getCustomerData, getSessionCustomerId } from "../../shared-memory";

export const createRepairTool = createTool({
  id: "createRepair",
  description: "Create a new repair record in the Sanden repair system",
  inputSchema: z.object({
    repairData: z.object({
      customerId: z.string().optional(),
      issueDescription: z.string().optional(),
      priority: z.enum(["Low", "Medium", "High", "Emergency"]).optional(),
      estimatedCost: z.string().optional(),
      estimatedTime: z.string().optional(),
    }).describe("Repair data for creation"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { repairData, sessionId } = context;

    try {
      // Append a log row to Logs indicating creation intent
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "repair create log",
        Timestamp: new Date().toISOString(),
        "Repair ID": "",
        Status: "CREATE",
        "Customer ID": repairData?.customerId || "",
        "Product ID": "",
        "担当者 (Handler)": "AI",
        Issue: repairData?.issueDescription || "",
        Source: "agent",
        Raw: JSON.stringify(repairData || {}),
      });

      return {
        success: true,
        data: repairData,
        message: "修理記録を作成しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Repair creation failed: ${error.message}`,
      };
    }
  },
});

export const updateRepairTool = createTool({
  id: "updateRepair",
  description: "Update an existing repair record in the Sanden repair system",
  inputSchema: z.object({
    repairId: z.string().describe("Repair ID for update"),
    updates: z.object({
      status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]).optional(),
      actualCost: z.string().optional(),
      completionDate: z.string().optional(),
      notes: z.string().optional(),
    }).describe("Updates for repair record"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { repairId, updates, sessionId } = context;

    try {
      // Update Spreadsheet Row (Repairs sheet in salesforce_customer_data)
      await zapierMcp.callTool("google_sheets_update_spreadsheet_row", {
        instructions: "repair update",
        修理ID: repairId,
        ステータス: updates?.status || "",
        備考: updates?.notes || "",
      });
      return {
        success: true,
        data: { repairId, updates },
        message: "修理記録を更新しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Repair update failed: ${error.message}`,
      };
    }
  },
});

export const getRepairStatusTool = createTool({
  id: "getRepairStatus",
  description: "Get the status of a repair record in the Sanden repair system",
  inputSchema: z.object({
    repairId: z.string().describe("Repair ID for status check"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { repairId, sessionId } = context;

    try {
      const rows = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
        instructions: "get repair status",
        worksheet: "Repairs",
        row_count: 50,
      });
      const list = (rows?.results as any[]) || [];
      const found = list.find((r: any) => r?.修理ID === repairId || r?.["COL$A"] === repairId);
      return {
        success: true,
        data: found || null,
        message: "修理状況を取得しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Failed to get repair status: ${error.message}`,
      };
    }
  },
});

export const hybridGetRepairsByCustomerIdTool = createTool({
  id: "hybridGetRepairsByCustomerId",
  description: "Get repair history for a specific customer ID from the Sanden repair system",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Customer ID to get repair history for (optional - will use memory if not provided)"),
    sessionId: z.string().optional().describe("Session ID for validation (optional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    let { customerId, sessionId = "default-session" } = context;

    console.log(`🔍 [DEBUG] Repair history tool called with context:`, JSON.stringify(context, null, 2));

    // Try to get customer ID from session data first
    if (!customerId && context.session && context.session.customerId) {
      customerId = context.session.customerId;
      console.log(`🔍 [DEBUG] Retrieved customer ID from session: ${customerId}`);
    }

    // If still no customerId, try to get it from shared Mastra session memory
    if (!customerId) {
      try {
        const idFromSession = getSessionCustomerId(sessionId);
        if (idFromSession) {
          customerId = idFromSession;
          console.log(`🔍 [DEBUG] Retrieved customer ID from Mastra session memory: ${customerId}`);
        }
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from Mastra session memory:`, error);
      }
    }

    // Fallback to original shared memory
    if (!customerId) {
      try {
        customerId = sharedMemory.get("customerId");
        console.log(`🔍 [DEBUG] Retrieved customer ID from fallback shared memory: ${customerId}`);
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from fallback shared memory:`, error);
      }
    }

    // Additional fallback: check if customerId is passed directly in the context
    if (!customerId && context.customerId) {
      customerId = context.customerId;
      console.log(`🔍 [DEBUG] Retrieved customer ID from direct context: ${customerId}`);
    }

    if (!customerId) {
      console.log(`❌ [DEBUG] No customer ID available for repair history lookup`);
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客識別を完了してください。",
      };
    }

    try {
      console.log(`🔍 [DEBUG] Getting repair history for customer ID: ${customerId}`);
      
      // Add timeout wrapper for Zapier call
      const zapierCall = zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get repair history for customer ID: ${customerId}`,
        worksheet: "Repairs",
        lookup_key: "顧客ID",
        lookup_value: customerId,
        row_count: "50"
      });
      
      // Wait up to 40 seconds for Zapier response
      const result = await Promise.race([
        zapierCall,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Zapier call timeout after 40 seconds")), 40000)
        )
      ]);
      
      console.log(`🔍 [DEBUG] Zapier result for repair history:`, JSON.stringify(result, null, 2));
      
      // Handle different possible result structures
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
      
      console.log(`🔍 [DEBUG] Final extracted repair rows:`, JSON.stringify(rows, null, 2));
      
      if (rows && rows.length > 0) {
        console.log(`✅ [DEBUG] Found ${rows.length} repair records`);
        
        // Format the repair history data
        const repairHistory = rows.map((row: any) => ({
          repairId: row["修理ID"] || row["COL$A"],
          date: row["日時"] || row["COL$B"],
          productId: row["製品ID"] || row["COL$C"],
          customerId: row["顧客ID"] || row["COL$D"],
          issue: row["問題内容"] || row["COL$E"],
          status: row["ステータス"] || row["COL$F"],
          visitRequired: row["訪問要否"] || row["COL$G"],
          priority: row["優先度"] || row["COL$H"],
          handler: row["対応者"] || row["COL$I"],
        }));
        
        console.log(`✅ [DEBUG] Formatted repair history:`, JSON.stringify(repairHistory, null, 2));
        
        return {
          success: true,
          data: repairHistory,
          message: `顧客ID ${customerId} の修理履歴を取得しました。`,
        };
      } else {
        console.log(`❌ [DEBUG] No repair records found for customer ID: ${customerId}`);
        return {
          success: true,
          data: [],
          message: `顧客ID ${customerId} の修理履歴は見つかりませんでした。`,
        };
      }
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error getting repair history:`, error);
      return {
        success: false,
        data: null,
        message: `Failed to get repair history: ${error.message}`,
      };
    }
  },
});

// Export all repair tools
export const repairTools = {
  createRepairTool,
  updateRepairTool,
  getRepairStatusTool,
  hybridGetRepairsByCustomerIdTool,
};
