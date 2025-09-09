import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./server.env" });

// Simple MCP client class like in test-zapier-js.js
class SimpleMCPClient {
  constructor() {
    this.tools = new Map();
  }

  async callTool(toolName, params) {
    const response = await fetch("https://mcp.zapier.com/mcp/servers/87e0a66d-bcf9-4d28-a14c-7ed3a9d006b6/tools/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: toolName,
        params: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}

const zapierMcp = new SimpleMCPClient();

async function testFAQSearch() {
  try {
    console.log("🔍 Testing FAQ search...");
    
    // Test the FAQ search using lookup instead of get_many
    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: `Look up FAQ data by searching in column B (questions) for any content`,
      worksheet: "FAQ",
      lookup_key: "Question",
      lookup_value: "error",
      row_count: "50"
    });
    
    console.log("✅ FAQ Zapier call successful!");
    console.log("Raw result:", JSON.stringify(result, null, 2));
    
    // Parse the results like in the actual code
    let allFaqResults = [];
    if (result && result.results) {
      try {
        let parsed = result.results;
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        
        console.log("Parsed results:", JSON.stringify(parsed, null, 2));
        
        // Helper to push rows from a raw_rows JSON string
        const pushFromRawRows = (rawRowsStr) => {
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
          } catch (e) {
            console.log("Error parsing raw_rows:", e);
          }
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
            if (val && typeof val === "object" && typeof val.raw_rows === "string") {
              pushFromRawRows(val.raw_rows);
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
    
    console.log("📋 Extracted FAQ results:", JSON.stringify(allFaqResults, null, 2));
    
    // Test partial matching
    const testQuery = "error";
    const queryLower = testQuery.toLowerCase();
    const faqResults = allFaqResults.filter((item) => {
      const questionLower = item.question.toLowerCase();
      const answerLower = item.answer.toLowerCase();
      
      // Direct match
      if (questionLower.includes(queryLower) || answerLower.includes(queryLower)) {
        return true;
      }
      
      return false;
    });
    
    console.log(`🔍 Search results for "${testQuery}":`, JSON.stringify(faqResults, null, 2));
    
  } catch (error) {
    console.error("❌ FAQ test failed:", error);
  }
}

testFAQSearch();
