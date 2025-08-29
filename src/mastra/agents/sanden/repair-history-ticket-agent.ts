import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { hybridGetRepairsByCustomerId, hybridGetProductsByCustomerId } from "../../tools/sanden/hybrid-customer-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

export async function createRepairHistoryTicketAgent() {
  console.log("🔍 Creating Repair History Ticket Agent...");
  try {
    const instructions = await loadLangfusePrompt("repair-history-ticket");
    if (!instructions || !instructions.trim()) {
      throw new Error("Failed to load repair-history-ticket prompt from Langfuse");
    }
    console.log(`✅ Successfully loaded repair-history-ticket prompt from Langfuse (length: ${instructions.length})`);
    const agent = new Agent({
      name: "repair-history-ticket-agent",
      instructions: instructions,
      model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
      memory: new Memory(),
      tools: [
        hybridGetRepairsByCustomerId,
        hybridGetProductsByCustomerId,
      ],
    });
    console.log(`✅ Repair History Ticket Agent created with Langfuse instructions length: ${instructions.length}`);
    return agent;
  } catch (error) {
    console.error("❌ Failed to create repair history ticket agent:", error);
    throw error;
  }
}
