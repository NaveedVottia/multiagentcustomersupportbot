import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { langfuse } from "../../../integrations/langfuse";
import { sharedMastraMemory } from "../../shared-memory";
import dotenv from "dotenv";

dotenv.config({ path: "./server.env" });

let REPAIR_HISTORY_INSTRUCTIONS = "Repair history agent. Instructions will be loaded from Langfuse.";

// Load Langfuse prompt asynchronously with retry logic
async function loadRepairHistoryPrompt() {
  let retries = 3;
  while (retries > 0) {
    try {
      // Wait a bit for environment to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[Langfuse] Attempting to load repair-history-ticket prompt (attempt ${4 - retries})...`);
      const promptText = await langfuse.getPromptText("repair-history-ticket", "production");
      console.log(`[Langfuse] Raw instructions length: ${promptText?.length || 0}`);
      
      if (promptText && promptText.trim() && promptText.length > 0) {
        REPAIR_HISTORY_INSTRUCTIONS = promptText.trim();
        console.log(`[Langfuse] ✅ Loaded repair-history-ticket prompt (${promptText.length} chars)`);
        
        // Update the agent's instructions
        (repairQaAgentIssueAnalysis as any).__updateInstructions(promptText.trim());
        console.log(`[Langfuse] ✅ Updated repair-history-ticket agent instructions`);
        break;
      } else {
        console.log(`[Langfuse] Empty prompt received for repair-history-ticket, retries left: ${retries - 1}`);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error(`[Langfuse] Failed to load repair-history-ticket prompt (retries left: ${retries - 1}):`, error);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// Load the prompt asynchronously
loadRepairHistoryPrompt();

export const repairQaAgentIssueAnalysis = new Agent({
  name: "repair-history-ticket",
  description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
  instructions: REPAIR_HISTORY_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...repairTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools,
  },
  memory: sharedMastraMemory,
});
