import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { langfuse } from "../../../integrations/langfuse";
import { sharedMastraMemory } from "../../shared-memory";
import dotenv from "dotenv";

// Ensure environment is loaded before agent creation
dotenv.config({ path: "./server.env" });

export const repairAgentProductSelection = new Agent({
  name: "repair-agent",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...customerTools,
    ...commonTools,
    ...orchestratorTools, // Add orchestrator tools (delegateTo, logCustomerData)
    ...memoryTools, // Add memory tools
  },
  memory: sharedMastraMemory, // Use shared Mastra memory for proper agent-to-agent communication
});

// Bind prompt from Langfuse with retry logic
(async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      // Wait a bit for environment to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[Langfuse] Attempting to load repair-agent prompt (attempt ${4 - retries})...`);
      const instructions = await langfuse.getPromptText("repair-agent", "production");
      console.log(`[Langfuse] Raw instructions length: ${instructions?.length || 0}`);
      
      if (instructions && instructions.length > 0) {
        // Use the correct method to update instructions
        (repairAgentProductSelection as any).__updateInstructions(instructions);
        
        // Verify the instructions were set
        console.log(`[Langfuse] ✅ Loaded prompt: repair-agent (${instructions.length} chars)`);
        console.log(`[Langfuse] ✅ Agent instructions length after update: ${repairAgentProductSelection.instructions?.length || 0}`);
        break;
      } else {
        console.log(`[Langfuse] Empty prompt received for repair-agent, retries left: ${retries - 1}`);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error(`[Langfuse] Failed to load repair-agent prompt (retries left: ${retries - 1}):`, error);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
})();
