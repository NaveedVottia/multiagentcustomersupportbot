import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";

export const routingAgentCustomerIdentification = new Agent({ 
  name: "routing-agent-customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
   
  // All prompts will be provided by Langfuse
  instructions: "This agent follows instructions provided by Langfuse prompts. No hardcoded instructions.",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...customerTools,
    ...commonTools,
  },
  memory: new Memory(),
});
