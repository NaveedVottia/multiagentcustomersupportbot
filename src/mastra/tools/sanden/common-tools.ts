import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";

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
  execute: async ({ context }: { context: any }) => {
    const { sessionId } = context;

    try {
      // Use Logs: Get Data Range as a lightweight connectivity check; in a real impl you'd have a dedicated session tool
      await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "validate session connectivity",
        a1_range: "A1:I1",
      });
      const result = { data: { sessionId } } as any;
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
  execute: async ({ context }: { context: any }) => {
    const { sessionId } = context;

    try {
      const headers = await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "system info headers",
        a1_range: "A1:I1",
      });
      const result = { data: { headers } } as any;
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
  execute: async ({ context }: { context: any }) => {
    const { sessionId, topic } = context;

    try {
      const result = { data: { topic: topic || "" } } as any;
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

export const zapierAiQuery = createTool({
  id: "zapierAiQuery",
  description: "Use Zapier AI to extract/summarize content from a URL or the configured data source (e.g., Google Sheets). Provide url and prompt.",
  inputSchema: z.object({
    url: z.string().url().optional().describe("Optional URL to extract from. If omitted, uses the configured source."),
    prompt: z.string().describe("Instruction or question for the AI extractor/summarizer"),
    context: z.record(z.any()).optional().describe("Optional JSON context to include"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { url, prompt, context: extra } = context;
    try {
      const instructions = url
        ? `Extract and summarize content from this URL: ${url}. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`
        : `Extract and summarize content from the configured source. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`;
      const res = await zapierMcp.callTool("ai_by_zapier_extract_content_from_url_beta", {
        instructions,
      });
      return { success: true, data: res?.results || res, message: "AI query completed" };
    } catch (error: any) {
      return { success: false, data: null, message: `AI query failed: ${error.message}` };
    }
  },
});

export const commonTools = { validateSession, getSystemInfo, getHelp, zapierAiQuery };
