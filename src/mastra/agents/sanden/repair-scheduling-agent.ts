import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { hybridCreateLogEntry } from "../../tools/sanden/hybrid-customer-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

export async function createRepairSchedulingAgent() {
  console.log("🔍 Creating Repair Scheduling Agent...");
  try {
    const instructions = await loadLangfusePrompt("repair-scheduling");
    if (!instructions || !instructions.trim()) {
      throw new Error("Failed to load repair-scheduling prompt from Langfuse");
    }
    console.log(`✅ Successfully loaded repair-scheduling prompt from Langfuse (length: ${instructions.length})`);
    const agent = new Agent({
      name: "repair-scheduling-agent",
      instructions: instructions,
      model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
      memory: new Memory(),
      tools: [
        hybridCreateLogEntry,
      ],
    });
    console.log(`✅ Repair Scheduling Agent created with Langfuse instructions length: ${instructions.length}`);
    return agent;
  } catch (error) {
    console.error("❌ Failed to create repair scheduling agent:", error);
    throw error;
  }
}
