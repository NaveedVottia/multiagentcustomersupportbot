import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { hybridGetRepairsByCustomerId, hybridGetProductsByCustomerId, hybridCreateLogEntry } from "../../tools/sanden/hybrid-customer-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

export async function createRepairAgent() {
  console.log("🔍 Creating Repair Agent...");
  try {
    const instructions = await loadLangfusePrompt("repair-agent");
    if (!instructions || !instructions.trim()) {
      throw new Error("Failed to load repair-agent prompt from Langfuse");
    }
    console.log(`✅ Successfully loaded repair-agent prompt from Langfuse (length: ${instructions.length})`);
    const agent = new Agent({
      name: "repair-agent",
      instructions: instructions,
      model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
      memory: new Memory(),
      tools: [
        hybridGetRepairsByCustomerId,
        hybridGetProductsByCustomerId,
        hybridCreateLogEntry,
      ],
    });
    console.log(`✅ Repair Agent created with Langfuse instructions length: ${instructions.length}`);
    return agent;
  } catch (error) {
    console.error("❌ Failed to create repair agent:", error);
    throw error;
  }
}
