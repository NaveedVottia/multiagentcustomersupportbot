import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";

export const repairVisitConfirmationAgent = new Agent({ 
  name: "repair-visit-confirmation-agent",
  description: "サンデン・リテールシステム修理受付AI , 訪問確認エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...commonTools,
  } as any,
  memory: new Memory(),
});

// Bind prompt from Langfuse
(async () => {
  try {
    const prompt = await loadLangfusePrompt("repair-visit-confirmation-agent", { label: "production" });
    (repairVisitConfirmationAgent as any).instructions = prompt;
  } catch {}
})();
