import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { langfuse } from "../../../integrations/langfuse";
import { sharedMastraMemory } from "../../shared-memory";

export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
  },
  memory: sharedMastraMemory, // Use shared Mastra memory
});

// Bind prompt from Langfuse
(async () => {
  try {
    const instructions = await langfuse.getPromptText("repair-scheduling", "production");
    if (instructions) {
      // Use the correct method to update instructions
      (repairVisitConfirmationAgent as any).__updateInstructions(instructions);
      console.log(`[Langfuse] ✅ Loaded prompt: repair-scheduling (${instructions.length} chars)`);
    } else {
      console.log("[Langfuse] Empty prompt received for repair-scheduling");
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load repair-scheduling prompt:", error);
  }
})();
