import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Load Langfuse prompt with fallback
let CUSTOMER_IDENTIFICATION_INSTRUCTIONS = "";

// Load instructions immediately
(async () => {
  try {
    console.log("🔍 Loading instructions for Customer Identification Agent...");
    const instructions = await loadLangfusePrompt("routing-agent-customer-identification", { label: "production" });
    if (instructions && instructions.trim().length > 0) {
      CUSTOMER_IDENTIFICATION_INSTRUCTIONS = instructions.trim();
      console.log(`✅ Successfully loaded Langfuse instructions (length: ${CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length})`);
    } else {
      throw new Error("Empty instructions from Langfuse");
    }
  } catch (error) {
    console.warn("⚠️ Failed to load Langfuse instructions, using minimal fallback:", error);
    // Minimal fallback to prevent server crash
    CUSTOMER_IDENTIFICATION_INSTRUCTIONS = "You are an AI assistant. Respond appropriately to user queries.";
  }
})();

export const routingAgentCustomerIdentification = new Agent({ 
  name: "routing-agent-customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
  instructions: CUSTOMER_IDENTIFICATION_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...customerTools,
    ...commonTools,
    ...orchestratorTools,
  },
  memory: new Memory(),
});

console.log("✅ Customer Identification Agent created with instructions length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);

// Log prompt to Langfuse tracing
setTimeout(async () => {
  if (CUSTOMER_IDENTIFICATION_INSTRUCTIONS && CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length > 100) {
    try {
      await langfuse.logPrompt(
        "routing-agent-customer-identification",
        { label: "production", agentId: "routing-agent-customer-identification" },
        CUSTOMER_IDENTIFICATION_INSTRUCTIONS,
        { length: CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length }
      );
      console.log("✅ Prompt logged to Langfuse tracing");
    } catch (error) {
      console.warn("⚠️ Failed to log prompt to Langfuse:", error);
    }
  }
}, 1000);
