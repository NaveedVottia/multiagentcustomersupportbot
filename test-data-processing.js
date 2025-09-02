// Test the data processing logic with the exact Zapier output structure
const testData = {
  "0": {
    "rows": [
      {
        "id": 3,
        "row": 3,
        "COL$A": "CUST002",
        "COL$B": "ドン・キホーテ 渋谷店",
        "COL$C": "repair@donki-shibuya.jp",
        "COL$D": "03-8765-4321",
        "COL$E": "東京都・渋谷"
      }
    ]
  }
};

console.log("🔍 Testing data processing logic...");
console.log("Input data:", JSON.stringify(testData, null, 2));

// Handle different possible result structures
let rows = [];
if (testData && testData["0"] && testData["0"].rows) {
  rows = testData["0"].rows;
} else if (testData && Array.isArray(testData)) {
  rows = testData;
} else if (testData && testData.rows) {
  rows = testData.rows;
} else if (testData && testData.results && testData.results[0] && testData.results[0].rows) {
  rows = testData.results[0].rows;
}

console.log("Extracted rows:", JSON.stringify(rows, null, 2));

if (rows && rows.length > 0) {
  console.log(`✅ Found ${rows.length} rows`);
  // Find the best match - for ドン・キホーテ, just take the first match
  const bestMatch = rows[0];
  
  console.log("Best match:", JSON.stringify(bestMatch, null, 2));
  
  const customerData = {
    customerId: bestMatch["COL$A"] || bestMatch["顧客ID"] || bestMatch["id"],
    storeName: bestMatch["COL$B"] || bestMatch["会社名"] || bestMatch["storeName"],
    email: bestMatch["COL$C"] || bestMatch["メールアドレス"] || bestMatch["email"],
    phone: bestMatch["COL$D"] || bestMatch["電話番号"] || bestMatch["phone"],
    location: bestMatch["COL$E"] || bestMatch["所在地"] || bestMatch["location"],
    found: true
  };
  
  console.log("✅ Customer data extracted:", JSON.stringify(customerData, null, 2));
  console.log("✅ Customer found:", customerData.found);
} else {
  console.log("❌ No rows found");
}
