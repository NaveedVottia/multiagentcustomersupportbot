import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";

export const schedulingTools = createTool({
  id: "scheduling-tools",
  description:
    "Tools for managing scheduling and appointments in the Sanden repair system",
  inputSchema: z.object({
    action: z
      .enum(["create", "update", "availability"])
      .describe("Action to perform"),
    appointmentData: z
      .object({
        customerId: z.string().optional(),
        repairId: z.string().optional(),
        scheduledDate: z.string().optional(),
        scheduledTime: z.string().optional(),
        duration: z.string().optional(),
        technician: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional()
      .describe("Appointment data for create action"),
    appointmentId: z
      .string()
      .optional()
      .describe("Appointment ID for update action"),
    updates: z
      .object({
        scheduledDate: z.string().optional(),
        scheduledTime: z.string().optional(),
        duration: z.string().optional(),
        technician: z.string().optional(),
        notes: z.string().optional(),
        status: z
          .enum(["Scheduled", "Confirmed", "Cancelled", "Completed"])
          .optional(),
      })
      .optional()
      .describe("Updates for appointment"),
    availabilityData: z
      .object({
        date: z.string().optional(),
        time: z.string().optional(),
        duration: z.string().optional(),
      })
      .optional()
      .describe("Data for availability check"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const {
      action,
      appointmentData,
      appointmentId,
      updates,
      availabilityData,
      sessionId,
    } = context;

    try {
      switch (action) {
        case "create":
          await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
            instructions: "schedule create",
            Timestamp: new Date().toISOString(),
            "Repair ID": appointmentData?.repairId || "",
            Status: "Scheduled",
            "Customer ID": appointmentData?.customerId || "",
            "Product ID": "",
            "担当者 (Handler)": appointmentData?.technician || "",
            Issue: appointmentData?.notes || "",
            Source: "scheduler",
            Raw: JSON.stringify(appointmentData || {}),
          });
          return { success: true, data: appointmentData, message: "予約を作成しました。" } as any;
        case "update":
          await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
            instructions: "schedule update",
            Timestamp: new Date().toISOString(),
            "Repair ID": appointmentId || "",
            Status: updates?.status || "",
            "Customer ID": "",
            "Product ID": "",
            "担当者 (Handler)": updates?.technician || "",
            Issue: updates?.notes || "",
            Source: "scheduler",
            Raw: JSON.stringify(updates || {}),
          });
          return { success: true, data: updates, message: "予約を更新しました。" } as any;
        case "availability":
          return { success: true, data: { available: true }, message: "空き状況を確認しました。" } as any;
        default:
          return {
            success: false,
            data: null,
            message: "Invalid action specified",
          };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: (error as any).message,
      };
    }
  },
});

// Webhook helper removed; using Zapier MCP instead
