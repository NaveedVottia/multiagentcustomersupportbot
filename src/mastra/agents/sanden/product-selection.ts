import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";
import { Langfuse } from "langfuse";
import { sharedMemory } from "./customer-identification";

// Store instructions in a variable like customer-identification does
let REPAIR_AGENT_INSTRUCTIONS = "";

export const repairAgentProductSelection = new Agent({
  name: "repair-agent",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: REPAIR_AGENT_INSTRUCTIONS,
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
  },
  memory: sharedMemory, // Use shared memory
});

// Load prompt from Langfuse
async function loadRepairAgentPrompt() {
  try {
    const langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });
    
    const promptClient = await langfuse.getPrompt("repair-agent");
    if (promptClient?.prompt?.trim()) {
      REPAIR_AGENT_INSTRUCTIONS = promptClient.prompt.trim();
      console.log(`[Langfuse] ✅ Loaded repair-agent prompt via SDK (v${promptClient.version})`);
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load repair-agent prompt:", error);
    console.log("[Langfuse] Using fallback prompt");
  }
}

// Load the prompt asynchronously
loadRepairAgentPrompt();
