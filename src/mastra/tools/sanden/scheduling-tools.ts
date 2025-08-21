import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  execute: async ({ context }) => {
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
          return await zapierCall("Repair", {
            sessionId,
            scheduleData: appointmentData || {},
          });
        case "update":
          return await zapierCall("Repair", {
            sessionId,
            scheduleId: appointmentId || "",
            updates: updates || {},
          });
        case "availability":
          return await zapierCall("schedule.availability", {
            sessionId,
            request: availabilityData || {},
          });
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
  return { success: true, data: result.data || result, message: "" } as any;
}
