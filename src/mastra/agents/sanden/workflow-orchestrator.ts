import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { repairTools } from "../../tools/sanden/repair-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";

// Resolve instructions at module-load time to avoid mutating read-only properties
const lfo = await loadLangfusePrompt("repair-workflow-orchestrator", { label: "production" });
const ORCHESTRATOR_INSTRUCTIONS = lfo?.trim() || "";

export const repairWorkflowOrchestratorAgent = new Agent({
  name: "repair-workflow-orchestrator",
  description: "サンデン・リテールシステム修理受付AI ワークフローオーケストレーター",
  instructions: ORCHESTRATOR_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...orchestratorTools,
    ...customerTools,
    ...repairTools,
    ...commonTools,
  },
  memory: new Memory(),
});