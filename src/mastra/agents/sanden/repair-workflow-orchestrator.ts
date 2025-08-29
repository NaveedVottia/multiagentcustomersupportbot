import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { hybridLookupCustomerByDetails, hybridGetRepairsByCustomerId, hybridGetProductsByCustomerId, hybridCreateLogEntry } from "../../tools/sanden/hybrid-customer-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

export async function createRepairWorkflowOrchestrator() {
  console.log("🔍 Creating Repair Workflow Orchestrator...");
  try {
    const instructions = await loadLangfusePrompt("orchestrator");
    if (!instructions || !instructions.trim()) {
      throw new Error("Failed to load orchestrator prompt from Langfuse");
    }
    console.log(`✅ Successfully loaded orchestrator prompt from Langfuse (length: ${instructions.length})`);
    const agent = new Agent({
      name: "orchestrator",
      instructions: instructions,
      model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
      memory: new Memory(),
      tools: [
        hybridLookupCustomerByDetails,
        hybridGetRepairsByCustomerId,
        hybridGetProductsByCustomerId,
        hybridCreateLogEntry,
      ],
    });
    console.log(`✅ Repair Workflow Orchestrator created with Langfuse instructions length: ${instructions.length}`);
    return agent;
  } catch (error) {
    console.error("❌ Failed to create repair workflow orchestrator:", error);
    throw error;
  }
}
