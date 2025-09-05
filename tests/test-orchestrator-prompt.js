import dotenv from "dotenv";
import { Langfuse } from "langfuse";

// Load environment variables
dotenv.config({ path: "./server.env" });

console.log("🔍 Environment Variables Status:");
console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");

if (!process.env.LANGFUSE_HOST || !process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
  console.error("❌ Missing required Langfuse environment variables");
  process.exit(1);
}

console.log("✅ All Langfuse environment variables are set!");

// Create Langfuse client
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

console.log("✅ Langfuse client created successfully");

// Test connection by trying to fetch a prompt
try {
  const testPrompt = await langfuse.getPrompt("orchestrator", undefined, { cacheTtlSeconds: 1 });
  console.log("✅ Langfuse connection test successful");
} catch (error) {
  console.error("❌ Langfuse connection test failed:", error.message);
  process.exit(1);
}

// Fetch orchestrator prompt
try {
  const promptClient = await langfuse.getPrompt("orchestrator", undefined, { cacheTtlSeconds: 1 });
  console.log("✅ Prompt fetched successfully:", promptClient ? "Has data" : "No data");
  if (promptClient) {
    console.log("Prompt content length:", promptClient.prompt?.length || 0);
    console.log("Prompt version:", promptClient.version);
    console.log("\n=== ORCHESTRATOR PROMPT CONTENT ===");
    console.log(promptClient.prompt);
    console.log("=== END PROMPT CONTENT ===\n");
  }
} catch (promptError) {
  console.error("❌ Error fetching prompt:", promptError.message);
}
