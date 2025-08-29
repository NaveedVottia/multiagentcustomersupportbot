import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

export const createAppointmentTool = createTool({
  id: "createAppointment",
  description: "Create a new appointment for repair scheduling",
  inputSchema: z.object({
    customerId: z.string().optional(),
    repairId: z.string().optional(),
    scheduledDate: z.string().optional(),
    scheduledTime: z.string().optional(),
    duration: z.string().optional(),
    technician: z.string().optional(),
    notes: z.string().optional(),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    const {
      customerId,
      repairId,
      scheduledDate,
      scheduledTime,
      duration,
      technician,
      notes,
      sessionId,
    } = input;

    try {
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "schedule create",
        Timestamp: new Date().toISOString(),
        "Repair ID": repairId || "",
        Status: "Scheduled",
        "Customer ID": customerId || "",
        "Product ID": "",
        "担当者 (Handler)": technician || "",
        Issue: notes || "",
        Source: "scheduler",
        Raw: JSON.stringify({ customerId, repairId, scheduledDate, scheduledTime, duration, technician, notes }),
      });
      return { success: true, data: { customerId, repairId, scheduledDate, scheduledTime, duration, technician, notes }, message: "予約を作成しました。" };
    } catch (error) {
      console.error("❌ [Scheduling] Failed to create appointment:", error);
      return { success: false, data: null, message: "予約の作成に失敗しました。" };
    }
  },
});

export const updateAppointmentTool = createTool({
  id: "updateAppointment",
  description: "Update an existing appointment",
  inputSchema: z.object({
    appointmentId: z.string().describe("Appointment ID for update"),
    scheduledDate: z.string().optional(),
    scheduledTime: z.string().optional(),
    duration: z.string().optional(),
    technician: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["Scheduled", "Confirmed", "Cancelled", "Completed"]).optional(),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    const {
      appointmentId,
      scheduledDate,
      scheduledTime,
      duration,
      technician,
      notes,
      status,
      sessionId,
    } = input;

    try {
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "schedule update",
        Timestamp: new Date().toISOString(),
        "Repair ID": appointmentId || "",
        Status: status || "",
        "Customer ID": "",
        "Product ID": "",
        "担当者 (Handler)": technician || "",
        Issue: notes || "",
        Source: "scheduler",
        Raw: JSON.stringify({ scheduledDate, scheduledTime, duration, technician, notes, status }),
      });
      return { success: true, data: { scheduledDate, scheduledTime, duration, technician, notes, status }, message: "予約を更新しました。" };
    } catch (error) {
      console.error("❌ [Scheduling] Failed to update appointment:", error);
      return { success: false, data: null, message: "予約の更新に失敗しました。" };
    }
  },
});

export const checkAvailabilityTool = createTool({
  id: "checkAvailability",
  description: "Check availability for scheduling",
  inputSchema: z.object({
    date: z.string().optional(),
    time: z.string().optional(),
    duration: z.string().optional(),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    const { date, time, duration, sessionId } = input;

    try {
      // For now, return mock availability
      return { success: true, data: { available: true, date, time, duration }, message: "空き状況を確認しました。" };
    } catch (error) {
      console.error("❌ [Scheduling] Failed to check availability:", error);
      return { success: false, data: null, message: "空き状況の確認に失敗しました。" };
    }
  },
});

// Export individual tools for proper Mastra integration
export const schedulingTools = {
  createAppointment: createAppointmentTool,
  updateAppointment: updateAppointmentTool,
  checkAvailability: checkAvailabilityTool,
};
