import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Load instructions from Langfuse with fallback
let ISSUE_ANALYSIS_INSTRUCTIONS = "";

// Load instructions immediately
(async () => {
  try {
    console.log("🔍 Loading instructions for Issue Analysis Agent...");
    const instructions = await loadLangfusePrompt("repair-qa-agent-issue-analysis", { label: "production" });
    if (instructions && instructions.trim().length > 0) {
      ISSUE_ANALYSIS_INSTRUCTIONS = instructions.trim();
      console.log(`✅ Successfully loaded Langfuse instructions (length: ${ISSUE_ANALYSIS_INSTRUCTIONS.length})`);
    } else {
      throw new Error("Empty instructions from Langfuse");
    }
  } catch (error) {
    console.warn("⚠️ Failed to load Langfuse instructions, using minimal fallback:", error);
    // Minimal fallback to prevent server crash
    ISSUE_ANALYSIS_INSTRUCTIONS = "You are an AI assistant. Respond appropriately to user queries.";
  }
})();

export const repairQaAgentIssueAnalysis = new Agent({ 
  name: "repair-qa-agent-issue-analysis",
  description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
  instructions: ISSUE_ANALYSIS_INSTRUCTIONS || "You are an AI assistant. Respond appropriately to user queries.",
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...repairTools,
    ...commonTools,
  },
  memory: new Memory(),
});

console.log("✅ Issue Analysis Agent created");

// Log prompt to Langfuse tracing
setTimeout(async () => {
  if (ISSUE_ANALYSIS_INSTRUCTIONS && ISSUE_ANALYSIS_INSTRUCTIONS.length > 100) {
    try {
      await langfuse.logPrompt(
        "repair-qa-agent-issue-analysis",
        { label: "production", agentId: "repair-qa-agent-issue-analysis" },
        ISSUE_ANALYSIS_INSTRUCTIONS,
        { length: ISSUE_ANALYSIS_INSTRUCTIONS.length }
      );
      console.log("✅ Prompt logged to Langfuse tracing");
    } catch (error) {
      console.warn("⚠️ Failed to log prompt to Langfuse:", error);
    }
  }
}, 1000);
