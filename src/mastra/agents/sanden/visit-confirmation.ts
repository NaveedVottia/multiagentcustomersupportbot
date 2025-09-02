import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { productTools } from "../../tools/sanden/product-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";
import { sharedMemory } from "./customer-identification";

export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...productTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
  } as any,
  memory: sharedMemory, // Use shared memory instead of new Memory()
});

// Bind prompt from Langfuse
(async () => {
  try {
    const prompt = await loadLangfusePrompt("repair-scheduling", { label: "production" });
    (repairVisitConfirmationAgent as any).instructions = prompt;
    try {
      await langfuse.logPrompt("repair-scheduling", { label: "production", agentId: "repair-scheduling" }, prompt, { length: prompt?.length || 0 });
    } catch {}
  } catch {}
})();
