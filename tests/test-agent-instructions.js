import dotenv from "dotenv";
import { mastraPromise } from "./src/mastra/index.ts";

dotenv.config({ path: "./server.env" });

async function testAgentInstructions() {
  try {
    console.log("🔍 Testing agent instructions...");
    
    const mastra = await mastraPromise;
    const agent = await mastra.getAgentById("customer-identification");
    
    if (agent) {
      console.log("✅ Agent found");
      console.log("📝 Agent name:", agent.name);
      console.log("📝 Agent description:", agent.description);
      console.log("📝 Agent instructions length:", agent.getInstructions()?.length || 0);
      console.log("📝 Agent instructions preview:", agent.getInstructions()?.substring(0, 200) || "No instructions");
      
      // Test a simple execution
      console.log("\n🔍 Testing agent execution...");
      const result = await agent.stream([{ role: "user", content: "CUST010でログインしてください" }]);
      
      let response = "";
      for await (const chunk of result.textStream) {
        if (typeof chunk === 'string') {
          response += chunk;
        }
      }
      
      console.log("📝 Response length:", response.length);
      console.log("📝 Response:", response || "Empty response");
      
    } else {
      console.log("❌ Agent not found");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAgentInstructions();