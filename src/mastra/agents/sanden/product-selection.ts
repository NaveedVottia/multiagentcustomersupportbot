import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools";
import { commonTools } from "../../tools/sanden/common-tools";

export const repairAgentProductSelection = new Agent({ 
  name: "repair-agent-product-selection",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
   
  // All prompts will be provided by Langfuse
  instructions: "This agent follows instructions provided by Langfuse prompts. No hardcoded instructions.",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...commonTools,
  },
  memory: new Memory(),
});
