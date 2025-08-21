import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools";
import { commonTools } from "../../tools/sanden/common-tools";

export const repairQaAgentIssueAnalysis = new Agent({ 
  name: "repair-qa-agent-issue-analysis",
  description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
   
  // All prompts will be provided by Langfuse
  instructions: "This agent follows instructions provided by Langfuse prompts. No hardcoded instructions.",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...repairTools,
    ...commonTools,
  },
  memory: new Memory(),
});
