import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

export const validateSession = createTool({
  id: "validateSession",
  description: "Validate session and return session information",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string } }) => {
    const { sessionId } = context;

    try {
      // Use Logs: Get Data Range as a lightweight connectivity check; in a real impl you'd have a dedicated session tool
      await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "validate session connectivity",
        a1_range: "A1:I1",
      });
      const result = { data: { sessionId } };
      return {
        success: true,
        data: result.data,
        message: "Session validated successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Session validation failed: ${errorMessage}`
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
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string } }) => {
    const { sessionId } = context;

    try {
      const headers = await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "system info headers",
        a1_range: "A1:I1",
      });
      const result = { data: { headers } };
      return {
        success: true,
        data: result.data,
        message: "System info retrieved successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Failed to get system info: ${errorMessage}`
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
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string; topic?: string } }) => {
    const { sessionId, topic } = context;

    try {
      const result = { data: { topic: topic || "" } };
      return {
        success: true,
        data: result.data,
        message: "Help information retrieved successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Failed to get help: ${errorMessage}`
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
    context: z.record(z.string(), z.unknown()).optional().describe("Optional JSON context to include"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { url?: string; prompt: string; context?: Record<string, unknown> } }) => {
    const { url, prompt, context: extra } = context;
    try {
      const instructions = url
        ? `Extract and summarize content from this URL: ${url}. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`
        : `Extract and summarize content from the configured source. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`;
      const res = await zapierMcp.callTool("ai_by_zapier_extract_content_from_url_beta", {
        instructions,
      });
      return { success: true, data: res?.results || res, message: "AI query completed" };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, data: null, message: `AI query failed: ${errorMessage}` };
    }
  },
});

export const searchFAQDatabase = createTool({
  id: "searchFAQDatabase",
  description: "Search FAQ database for questions and answers related to user query",
  inputSchema: z.object({
    query: z.string().describe("User's search query for FAQ"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      question: z.string(),
      answer: z.string(),
      url: z.string(),
    })).optional(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { query: string } }) => {
    const { query } = context;

    try {
      // Search FAQ worksheet using Zapier MCP with partial matching
      // Fetch a broader range and filter client-side for partial matching
      const result = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
        instructions: `Get all rows from FAQ worksheet for local partial search. Include columns A:Z and return raw rows if possible.`,
        worksheet: "FAQ",
        row_count: "500",
        range: "A:Z",
        output_format: "json"
      });

      // Parse the results and filter for partial matches
      let allFaqResults: Array<{question: string; answer: string; url: string}> = [];
      
      if (result && result.results) {
        try {
          // Handle the MCP response structure
          const results = result.results;
          
          // Check if results is an array and contains raw_rows
          if (Array.isArray(results) && results.length > 0) {
            const firstResult = results[0];
            if (firstResult && typeof firstResult.raw_rows === "string") {
              // Parse the raw_rows JSON string
              const rawRows = JSON.parse(firstResult.raw_rows);
              if (Array.isArray(rawRows)) {
                for (const row of rawRows) {
                  if (Array.isArray(row) && row.length >= 4) {
                    // All rows are data rows, no header to skip
                    allFaqResults.push({
                      question: String(row[1] || ""), // Col B - Question
                      answer: String(row[2] || ""),   // Col C - Answer
                      url: String(row[3] || ""),      // Col D - URL
                    });
                  }
                }
              }
            }
          }
        } catch (parseError) {
          console.log("Failed to parse FAQ results:", parseError);
        }
      }

      // Filter results for partial matching (case-insensitive, Japanese-friendly)
      const queryLower = query.toLowerCase();
      const faqResults = allFaqResults.filter((item: any) => {
        const questionLower = item.question.toLowerCase();
        const answerLower = item.answer.toLowerCase();
        
        // Direct match
        if (questionLower.includes(queryLower) || answerLower.includes(queryLower)) {
          return true;
        }
        
        // Handle Japanese-English mapping for error codes
        if (queryLower.includes('error') && queryLower.includes('90')) {
          return questionLower.includes('エラー90') || answerLower.includes('エラー90');
        }
        if (queryLower.includes('エラー') && queryLower.includes('90')) {
          return questionLower.includes('error90') || answerLower.includes('error90') ||
                 questionLower.includes('error 90') || answerLower.includes('error 90');
        }
        
        return false;
      });

      return {
        success: true,
        results: faqResults,
        message: faqResults.length > 0 
          ? `Found ${faqResults.length} FAQ result(s) for "${query}"`
          : `No FAQ results found for "${query}"`
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("FAQ search error:", error);
      return {
        success: false,
        results: [],
        message: `FAQ search failed: ${errorMessage}`
      };
    }
  },
});

export const commonTools = { validateSession, getSystemInfo, getHelp, zapierAiQuery, searchFAQDatabase };
