import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const validateSession = createTool({
  id: "validateSession",
  description: "Validate session and return session information",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { sessionId } = context;

    try {
      const result = await zapierCall("session.validate", { sessionId });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "Session validated successfully",
      };
    } catch (error: any) {
      return { 
        success: false, 
        data: null, 
        message: `Session validation failed: ${error.message}` 
      };
    }
  },
});

export const getSystemInfo = createTool({
  id: "getSystemInfo",
  description: "Get system information",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { sessionId } = context;

    try {
      const result = await zapierCall("system.info", { sessionId });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "System info retrieved successfully",
      };
    } catch (error: any) {
      return { 
        success: false, 
        data: null, 
        message: `Failed to get system info: ${error.message}` 
      };
    }
  },
});

export const getHelp = createTool({
  id: "getHelp",
  description: "Get help information for a specific topic",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
    topic: z.string().optional().describe("Help topic"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { sessionId, topic } = context;

    try {
      const result = await zapierCall("system.help", { sessionId, topic });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "Help information retrieved successfully",
      };
    } catch (error: any) {
      return { 
        success: false, 
        data: null, 
        message: `Failed to get help: ${error.message}` 
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
  return { success: true, data: result.data || result, message: "" };
}
export const commonTools = { validateSession, getSystemInfo, getHelp };
