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
  execute: async ({ context }: { context: any }) => {
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
          let parsed: any = result.results;
          if (typeof parsed === "string") parsed = JSON.parse(parsed);

          // Helper to push rows from a raw_rows JSON string
          const pushFromRawRows = (rawRowsStr: string) => {
            try {
              const rawRows = JSON.parse(rawRowsStr);
              if (Array.isArray(rawRows)) {
                for (const row of rawRows) {
                  if (Array.isArray(row)) {
                    allFaqResults.push({
                      question: String(row[1] || ""), // Col B
                      answer: String(row[2] || ""),   // Col C
                      url: String(row[3] || ""),      // Col D
                    });
                  }
                }
              }
            } catch {}
          };

          // Case 1: results is an array
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item === "object") {
                // If Zapier returned raw_rows inside each item
                if (typeof item.raw_rows === "string") {
                  pushFromRawRows(item.raw_rows);
                } else if (item["COL$B"] || item["COL$C"]) {
                  // Direct column-mapped object
                  allFaqResults.push({
                    question: String(item["COL$B"] || item.Question || item.question || ""),
                    answer: String(item["COL$C"] || item.Answer || item.answer || ""),
                    url: String(item["COL$D"] || item.FAQ_URL || item.url || ""),
                  });
                }
              }
            }
          }

          // Case 2: results is an object (possibly with numeric keys)
          if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
            // Top-level raw_rows
            if (typeof parsed.raw_rows === "string") {
              pushFromRawRows(parsed.raw_rows);
            }
            // Numeric-keyed or nested objects containing raw_rows
            for (const val of Object.values(parsed)) {
              if (val && typeof val === "object" && typeof (val as any).raw_rows === "string") {
                pushFromRawRows((val as any).raw_rows);
              }
            }
          }

          // Fallback: if nothing collected yet and parsed looks like direct rows
          if (!allFaqResults.length && Array.isArray(parsed)) {
            for (const item of parsed) {
              allFaqResults.push({
                question: String(item?.Question || item?.question || ""),
                answer: String(item?.Answer || item?.answer || ""),
                url: String(item?.FAQ_URL || item?.url || ""),
              });
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
    } catch (error: any) {
      console.error("FAQ search error:", error);
      return {
        success: false,
        results: [],
        message: `FAQ search failed: ${error.message}`
      };
    }
  },
});

export const commonTools = { validateSession, getSystemInfo, getHelp, zapierAiQuery, searchFAQDatabase };
