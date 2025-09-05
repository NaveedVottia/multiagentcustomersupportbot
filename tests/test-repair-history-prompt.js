import { Langfuse } from "langfuse";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./server.env" });

console.log("🔍 Environment Variables Status:");
console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");

if (!process.env.LANGFUSE_HOST || !process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
  console.log("❌ Missing required Langfuse environment variables");
  process.exit(1);
}

console.log("✅ All Langfuse environment variables are set!");

try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  
  console.log("✅ Langfuse client created successfully");
  
  // Test connection by fetching the repair-history-ticket prompt
  const promptClient = await langfuse.getPrompt("repair-history-ticket", undefined, { cacheTtlSeconds: 1 });
  
  if (promptClient && promptClient.prompt) {
    console.log("✅ Prompt fetched successfully: Has data");
    console.log("Prompt content length:", promptClient.prompt.length);
    console.log("Prompt version:", promptClient.version);
    
    console.log("\n=== REPAIR HISTORY TICKET PROMPT CONTENT ===");
    console.log(promptClient.prompt);
    console.log("=== END PROMPT CONTENT ===");
    
    // Search for getRepairHistoryByCustomerId usage
    if (promptClient.prompt.includes("getRepairHistoryByCustomerId")) {
      console.log("\n✅ Found getRepairHistoryByCustomerId usage in prompt");
    } else {
      console.log("\n❌ No getRepairHistoryByCustomerId usage found in prompt");
    }
    
    // Search for customer ID handling
    if (promptClient.prompt.includes("顧客ID") || promptClient.prompt.includes("customerId")) {
      console.log("✅ Found customer ID handling instructions in prompt");
    } else {
      console.log("❌ No customer ID handling instructions found in prompt");
    }
    
  } else {
    console.log("❌ Prompt fetched but no content");
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
