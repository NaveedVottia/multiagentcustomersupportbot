import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "server.env") });

console.log("🔍 Environment Variables Status:");
console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");

if (process.env.LANGFUSE_HOST && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
  console.log("✅ All Langfuse environment variables are set!");
  
  // Test Langfuse connection
  try {
    const { Langfuse } = await import("langfuse");
    const langfuse = new Langfuse({ 
      publicKey: process.env.LANGFUSE_PUBLIC_KEY, 
      secretKey: process.env.LANGFUSE_SECRET_KEY, 
      baseUrl: process.env.LANGFUSE_HOST 
    });
    
    console.log("✅ Langfuse client created successfully");
    
    // Try to fetch a prompt using the same method as the agent
    try {
      const promptClient = await langfuse.getPrompt("orchestrator", undefined, { cacheTtlSeconds: 1 });
      console.log("✅ Prompt fetched successfully:", promptClient ? "Has data" : "No data");
      if (promptClient) {
        console.log("Prompt content length:", promptClient.prompt?.length || 0);
        console.log("Prompt version:", promptClient.version);
      }
    } catch (promptError) {
      console.error("❌ Error fetching prompt:", promptError.message);
    }
    
  } catch (error) {
    console.error("❌ Error creating Langfuse client:", error.message);
  }
} else {
  console.log("❌ Missing required Langfuse environment variables");
}
