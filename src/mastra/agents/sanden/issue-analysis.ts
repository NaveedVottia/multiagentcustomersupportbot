import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";

export const repairQaAgentIssueAnalysis = new Agent({ 
  name: "repair-qa-agent-issue-analysis",
  description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...repairTools,
    ...commonTools,
  },
  memory: new Memory(),
});

// Bind prompt from Langfuse
(async () => {
  try {
    const prompt = await loadLangfusePrompt("repair-qa-agent-issue-analysis", { label: "production" });
    (repairQaAgentIssueAnalysis as any).instructions = prompt;
  } catch {}
})();
