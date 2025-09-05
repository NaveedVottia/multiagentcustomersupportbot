import dotenv from "dotenv";
import { Langfuse } from "langfuse";

// Load environment variables
dotenv.config({ path: "./server.env" });

console.log("🔍 Testing Customer Identification Prompt...");

// Create Langfuse client
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

try {
  const promptClient = await langfuse.getPrompt("customer-identification", undefined, { cacheTtlSeconds: 1 });
  console.log("✅ Customer Identification Prompt fetched successfully");
  console.log("Prompt content length:", promptClient.prompt?.length || 0);
  console.log("Prompt version:", promptClient.version);
  
  const promptText = promptClient.prompt || "";
  
  // Search for delegation-related keywords
  console.log("\n=== DELEGATION ANALYSIS ===");
  
  const delegateToMatches = promptText.match(/delegateTo/g);
  console.log("Number of delegateTo references:", delegateToMatches ? delegateToMatches.length : 0);
  
  const repairAgentMatches = promptText.match(/repair-agent/g);
  console.log("Number of repair-agent references:", repairAgentMatches ? repairAgentMatches.length : 0);
  
  const delegationMatches = promptText.match(/委譲/g);
  console.log("Number of 委譲 (delegation) references:", delegationMatches ? delegationMatches.length : 0);
  
  // Find specific lines with delegation instructions
  const lines = promptText.split('\n');
  console.log("\n=== DELEGATION INSTRUCTIONS ===");
  lines.forEach((line, index) => {
    if (line.includes('delegateTo') || line.includes('repair-agent') || line.includes('委譲')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
  
  console.log("\n=== FULL PROMPT ===");
  console.log(promptText);
  console.log("=== END PROMPT ===");
  
} catch (error) {
  console.error("❌ Error fetching customer-identification prompt:", error.message);
}