import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./server.env" });

// Test the FAQ search functionality
async function testFAQSearch() {
  try {
    console.log("🔍 Testing FAQ search functionality...");
    
    // Simulate the MCP response structure we get from Zapier
    const mockResult = {
      results: [{
        raw_rows: JSON.stringify([
          ["1", "USBを使用した商品登録方法（ど冷えもん）", "画像をご用意いただいてUSBを経由して登録することができます。詳しくはヘルプページを参照ください。", "https://maintefaq.sanden-rs.com/USB%E3%82%92%E4%BD%BF%E7%94%A8%E3%81%97%E3%81%9F%E5%95%86%E5%93%81%E7%99%BB%E9%8C%B2%E6%96%B9%E6%B3%95%EF%BC%88%E3%81%A9%E5%86%B7%E3%81%88%E3%82%82%E3%82%93%EF%BC%89-6732e394187d137d0ca686c7"],
          ["2", "エラー90「冷却異常」の内容と対処方法", "機械が冷却動作を行っているが庫内の温度が下がらない状態が続いたときに発生します。対処方法をお問い合わせ先はヘルプページを参照ください。", "https://maintefaq.sanden-rs.com/%E3%82%A8%E3%83%A9%E3%83%BC90%E3%80%8C%E5%86%B7%E5%8D%B4%E7%95%B0%E5%B8%B8%E3%80%8D%E3%81%AE%E5%86%85%E5%AE%B9%E3%81%A8%E5%AF%BE%E5%87%A6%E6%96%B9%E6%B3%95-6732e3942c27098215c2a7af"],
          ["3", "価格設定の変更方法", "価格設定を変更する場合はリモコンで待機画面の状態から操作します。詳しくはヘルプページを参照してください。", "https://maintefaq.sanden-rs.com/%E4%BE%A1%E6%A0%BC%E8%A8%AD%E5%AE%9A%E3%81%AE%E5%A4%89%E6%9B%B4%E6%96%B9%E6%B3%95-6732e393ddf430dc5f7e7757"]
        ])
      }]
    };
    
    // Test the parsing logic from the fixed code
    let allFaqResults = [];
    
    if (mockResult && mockResult.results) {
      try {
        // Handle the MCP response structure
        const results = mockResult.results;
        
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
    
    console.log("📋 Parsed FAQ results:", JSON.stringify(allFaqResults, null, 2));
    
    // Test partial matching
    const testQueries = ["エラー90", "error", "冷却", "USB", "価格"];
    
    for (const query of testQueries) {
      const queryLower = query.toLowerCase();
      const faqResults = allFaqResults.filter((item) => {
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
      
      console.log(`\n🔍 Search results for "${query}":`);
      if (faqResults.length > 0) {
        faqResults.forEach((result, index) => {
          console.log(`${index + 1}. Q) ${result.question}`);
          console.log(`   A) ${result.answer}`);
          console.log(`   URL: ${result.url}`);
          console.log("");
        });
      } else {
        console.log(`   No results found for "${query}"`);
      }
    }
    
    console.log("✅ FAQ search test completed successfully!");
    
  } catch (error) {
    console.error("❌ FAQ test failed:", error);
  }
}

testFAQSearch();
