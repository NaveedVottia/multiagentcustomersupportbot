import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  execute: async ({ context }) => {
    const { repairData, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        repairData,
        sessionId,
        timestamp: new Date().toISOString(),
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "修理記録を作成しました。",
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
  execute: async ({ context }) => {
    const { repairId, updates, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        repairId: repairId || "",
        updates: updates || {},
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "修理記録を更新しました。",
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
  execute: async ({ context }) => {
    const { repairId, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        repairId: repairId || "",
        status: "pending",
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "修理状況を取得しました。",
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

async function zapierCall(event: string, payload: Record<string, any>) {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("ZAPIER_WEBHOOK_URL not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Zapier webhook failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  return {
    success: true,
    data: result.data || result,
    message: result.message || "Zapier call completed successfully",
  };
}

// Export all repair tools
export const repairTools = {
  createRepairTool,
  updateRepairTool,
  getRepairStatusTool,
};
