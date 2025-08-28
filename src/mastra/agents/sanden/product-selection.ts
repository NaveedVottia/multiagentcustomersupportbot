import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Load instructions from Langfuse with fallback
let PRODUCT_SELECTION_INSTRUCTIONS = "";

// Load instructions immediately
(async () => {
  try {
    console.log("🔍 Loading instructions for Product Selection Agent...");
    const instructions = await loadLangfusePrompt("repair-agent-product-selection", { label: "production" });
    if (instructions && instructions.trim().length > 0) {
      PRODUCT_SELECTION_INSTRUCTIONS = instructions.trim();
      console.log(`✅ Successfully loaded Langfuse instructions (length: ${PRODUCT_SELECTION_INSTRUCTIONS.length})`);
    } else {
      throw new Error("Empty instructions from Langfuse");
    }
  } catch (error) {
    console.warn("⚠️ Failed to load Langfuse instructions, using minimal fallback:", error);
    // Minimal fallback to prevent server crash
    PRODUCT_SELECTION_INSTRUCTIONS = "You are an AI assistant. Respond appropriately to user queries.";
  }
})();

export const repairAgentProductSelection = new Agent({ 
  name: "repair-agent-product-selection",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
  instructions: PRODUCT_SELECTION_INSTRUCTIONS || "You are an AI assistant. Respond appropriately to user queries.",
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...commonTools,
  },
  memory: new Memory(),
});

console.log("✅ Product Selection Agent created");

// Log prompt to Langfuse tracing
setTimeout(async () => {
  if (PRODUCT_SELECTION_INSTRUCTIONS && PRODUCT_SELECTION_INSTRUCTIONS.length > 100) {
    try {
      await langfuse.logPrompt(
        "repair-agent-product-selection",
        { label: "production", agentId: "repair-agent-product-selection" },
        PRODUCT_SELECTION_INSTRUCTIONS,
        { length: PRODUCT_SELECTION_INSTRUCTIONS.length }
      );
      console.log("✅ Prompt logged to Langfuse tracing");
    } catch (error) {
      console.warn("⚠️ Failed to log prompt to Langfuse:", error);
    }
  }
}, 1000);
