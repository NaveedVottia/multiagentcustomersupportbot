import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ZapierMcpClient } from "../../../integrations/zapier-mcp.js";

// FAQ search tool using Zapier MCP
export const searchFAQDatabase = createTool({
  id: "searchFAQDatabase",
  description: "FAQデータベースを検索して、質問に関連する回答を見つけます。部分一致検索に対応しています。",
  inputSchema: z.object({
    searchQuery: z.string().describe("検索キーワード"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      question: z.string(),
      answer: z.string(),
      url: z.string(),
    })),
    count: z.number(),
    searchQuery: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { searchQuery } = context;
    
    console.log(`🔍 Searching FAQ database for: ${searchQuery}`);
    
    if (!searchQuery) {
      return {
        success: false,
        results: [],
        count: 0,
        searchQuery: "",
        message: "検索クエリが必要です。"
      };
    }
    
    try {
      console.log("🔄 Using Zapier MCP for FAQ search...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Use Zapier to search FAQ data
      const zapierResult = await zapierClient.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
        instructions: `Search the FAQ worksheet for any rows where the Question column contains the search query "${searchQuery}". Return all matching rows.`,
        worksheet: "FAQ",
        row_count: "50", // Get up to 50 results
      });
      
      console.log("✅ Zapier FAQ search completed, parsing results...");
      
      // Parse Zapier response structure
      let faqRows: any[] = [];
      
      if (zapierResult && zapierResult.content && zapierResult.content[0] && zapierResult.content[0].text) {
        try {
          const parsedContent = JSON.parse(zapierResult.content[0].text);
          if (parsedContent.results && parsedContent.results[0] && parsedContent.results[0].formatted_rows) {
            faqRows = parsedContent.results[0].formatted_rows;
            console.log(`✅ Zapier returned ${faqRows.length} FAQ formatted rows`);
          } else if (parsedContent.results && parsedContent.results[0] && parsedContent.results[0].rows) {
            faqRows = parsedContent.results[0].rows;
            console.log(`✅ Zapier returned ${faqRows.length} FAQ raw rows`);
          }
        } catch (parseError) {
          console.log("❌ Failed to parse Zapier FAQ response:", parseError);
        }
      }
      
      // Process FAQ results with partial matching
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter((word: string) => word.length > 0);
      const matchingResults = [];
      
      console.log(`🔍 Processing ${faqRows.length} FAQ rows with search words: [${searchWords.join(', ')}]`);
      
      for (const row of faqRows) {
        const question = row["COL$B"] || ""; // Question column
        const answer = row["COL$C"] || "";   // Answer column
        const url = row["COL$D"] || "";      // URL column
        
        console.log(`🔍 Checking question: "${question}"`);
        
        // Check if any word from the search query matches the question (partial matching)
        const questionLower = question.toLowerCase();
        const hasMatch = searchWords.some((word: string) => questionLower.includes(word));
        
        console.log(`🔍 Question "${question}" - hasMatch: ${hasMatch}`);
        
        if (hasMatch) {
          matchingResults.push({
            question: question,
            answer: answer,
            url: url
          });
          console.log(`✅ Added matching result: "${question}"`);
        }
      }
      
      console.log(`✅ Found ${matchingResults.length} matching FAQ results for: ${searchQuery}`);
      
      return {
        success: true,
        results: matchingResults,
        count: matchingResults.length,
        searchQuery: searchQuery,
        message: `FAQ検索完了: "${searchQuery}" で ${matchingResults.length} 件の結果が見つかりました。`
      };
      
    } catch (error) {
      console.error("❌ FAQ search error:", error);
      return {
        success: false,
        results: [],
        count: 0,
        searchQuery: searchQuery,
        message: `FAQ検索中にエラーが発生しました: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  },
});
