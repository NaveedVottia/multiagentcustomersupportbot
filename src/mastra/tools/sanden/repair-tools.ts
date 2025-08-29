import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

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
      const found = list.find((r: any) => r?.["COL$A"] === repairId || r?.修理ID === repairId);
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

// Export all repair tools
export const repairTools = {
  createRepairTool,
  updateRepairTool,
  getRepairStatusTool,
};
