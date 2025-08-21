import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { repairTools } from "../../tools/sanden/repair-tools";

export const repairWorkflowOrchestratorAgent = new Agent({
  name: "repair-workflow-orchestrator",
  description: "サンデン・リテールシステム修理受付AI ワークフローオーケストレーター",
  
  // Instructions come from Langfuse
  instructions: "This agent follows instructions provided by Langfuse prompts. No hardcoded instructions.",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...orchestratorTools,
    ...customerTools,
    ...repairTools,
  },
  memory: new Memory(),
});