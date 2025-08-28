import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Load instructions from Langfuse
let VISIT_CONFIRMATION_INSTRUCTIONS = "";

// Load instructions immediately
(async () => {
  try {
    console.log("🔍 Loading instructions for Visit Confirmation Agent...");
    const instructions = await loadLangfusePrompt("repair-visit-confirmation-agent", { label: "production" });
    if (instructions && instructions.trim().length > 0) {
      VISIT_CONFIRMATION_INSTRUCTIONS = instructions.trim();
      console.log(`✅ Successfully loaded Langfuse instructions (length: ${VISIT_CONFIRMATION_INSTRUCTIONS.length})`);
    } else {
      throw new Error("Empty instructions from Langfuse");
    }
  } catch (error) {
    console.warn("⚠️ Failed to load Langfuse instructions, using minimal fallback:", error);
    // Minimal fallback to prevent server crash
    VISIT_CONFIRMATION_INSTRUCTIONS = "You are an AI assistant. Respond appropriately to user queries.";
  }
})();

export const repairVisitConfirmationAgent = new Agent({ 
  name: "repair-visit-confirmation-agent",
  description: "サンデン・リテールシステム修理受付AI , 訪問確認エージェント",
  instructions: VISIT_CONFIRMATION_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    schedulingTools,
    ...commonTools,
  },
  memory: new Memory(),
});

console.log("✅ Visit Confirmation Agent created");

// Log prompt to Langfuse tracing
setTimeout(async () => {
  if (VISIT_CONFIRMATION_INSTRUCTIONS && VISIT_CONFIRMATION_INSTRUCTIONS.length > 100) {
    try {
      await langfuse.logPrompt(
        "repair-visit-confirmation-agent",
        { label: "production", agentId: "repair-visit-confirmation-agent" },
        VISIT_CONFIRMATION_INSTRUCTIONS,
        { length: VISIT_CONFIRMATION_INSTRUCTIONS.length }
      );
      console.log("✅ Prompt logged to Langfuse tracing");
    } catch (error) {
      console.warn("⚠️ Failed to log prompt to Langfuse:", error);
    }
  }
}, 1000);
