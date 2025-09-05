import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "server.env") });

console.log("🔍 Testing Scheduling Agent...");

try {
  // Import the mastra instance
  const { mastraPromise } = await import("./src/mastra/index.ts");
  
  console.log("✅ Mastra instance loaded");
  
  // Wait for the mastra instance to be ready
  const mastra = await mastraPromise;
  
  console.log("🔍 Available agents:", Object.keys(mastra.agents || {}));
  
  // Get the scheduling agent
  const agent = mastra.getAgentById("repair-scheduling");
  
  if (!agent) {
    console.log("❌ Scheduling agent not found");
    process.exit(1);
  }
  
  console.log("✅ Scheduling agent found");
  console.log("🔍 Agent name:", agent.name);
  console.log("🔍 Agent description:", agent.description);
  console.log("🔍 Agent instructions length:", agent.instructions?.length || 0);
  console.log("🔍 Agent instructions preview:", agent.instructions?.substring(0, 200) || "NO INSTRUCTIONS");
  
  // Test if the agent can stream
  console.log("🔍 Testing agent streaming...");
  const stream = await agent.stream([
    { role: "user", content: "修理予約をお願いします" }
  ]);
  
  console.log("✅ Stream created");
  console.log("🔍 Stream type:", typeof stream);
  console.log("🔍 Stream has textStream:", !!stream.textStream);
  
  let totalLength = 0;
  let chunks = [];
  
  if (stream.textStream) {
    for await (const chunk of stream.textStream) {
      console.log("📝 Chunk:", chunk);
      chunks.push(chunk);
      totalLength += chunk.length;
    }
  }
  
  console.log("✅ Streaming complete");
  console.log("📊 Total chunks:", chunks.length);
  console.log("📊 Total length:", totalLength);
  console.log("📊 Full response:", chunks.join(""));
  
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
