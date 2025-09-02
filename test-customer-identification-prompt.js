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
  
  // Test connection by fetching the customer-identification prompt
  const promptClient = await langfuse.getPrompt("customer-identification", undefined, { cacheTtlSeconds: 1 });
  
  if (promptClient && promptClient.prompt) {
    console.log("✅ Prompt fetched successfully: Has data");
    console.log("Prompt content length:", promptClient.prompt.length);
    console.log("Prompt version:", promptClient.version);
    
    console.log("\n=== CUSTOMER IDENTIFICATION PROMPT CONTENT ===");
    console.log(promptClient.prompt);
    console.log("=== END PROMPT CONTENT ===");
    
    // Search for lookupCustomerFromDatabase usage
    if (promptClient.prompt.includes("lookupCustomerFromDatabase")) {
      console.log("\n✅ Found lookupCustomerFromDatabase usage in prompt");
    } else {
      console.log("\n❌ No lookupCustomerFromDatabase usage found in prompt");
    }
    
    // Search for when it should be called
    if (promptClient.prompt.includes("顧客情報") && promptClient.prompt.includes("検索")) {
      console.log("✅ Found customer search instructions in prompt");
    } else {
      console.log("❌ No customer search instructions found in prompt");
    }
    
  } else {
    console.log("❌ Prompt fetched but no content");
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
