import dotenv from "dotenv";
import { Langfuse } from "langfuse";

dotenv.config({ path: "./server.env" });

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

async function testRepairAgentPrompt() {
  try {
    console.log("🔍 Testing repair-agent prompt...");
    
    const prompt = await langfuse.getPrompt("repair-agent");
    console.log("✅ Prompt found:", !!prompt);
    console.log("📝 Prompt name:", prompt?.name);
    console.log("📝 Prompt version:", prompt?.version);
    console.log("📝 Prompt labels:", prompt?.labels);
    console.log("📝 Prompt text length:", prompt?.prompt?.length || 0);
    
    if (prompt?.prompt) {
      console.log("📝 First 200 chars:", prompt.prompt.substring(0, 200));
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testRepairAgentPrompt();
