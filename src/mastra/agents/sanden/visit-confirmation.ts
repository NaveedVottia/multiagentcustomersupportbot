import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { commonTools } from "../../tools/sanden/common-tools";

export const repairVisitConfirmationAgent = new Agent({ 
  name: "repair-visit-confirmation-agent",
  description: "サンデン・リテールシステム修理受付AI , 訪問確認エージェント",
   
  // All prompts will be provided by Langfuse
  instructions: "This agent follows instructions provided by Langfuse prompts. No hardcoded instructions.",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...commonTools,
  } as any,
  memory: new Memory(),
});
