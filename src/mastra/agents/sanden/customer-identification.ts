import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Load Langfuse prompt only
const lfci = await loadLangfusePrompt("routing-agent-customer-identification", { label: "production" });
const CUSTOMER_IDENTIFICATION_INSTRUCTIONS = lfci?.trim() || "";

// Debug logging
console.log("🔍 Customer Identification Agent Instructions:");
console.log("📝 Langfuse Instructions Length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);
console.log("📝 Using Langfuse:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS ? "YES" : "NO (empty)");
if (CUSTOMER_IDENTIFICATION_INSTRUCTIONS) {
  console.log("📝 Instructions Preview:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.substring(0, 200) + "...");
}

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
try {
  await langfuse.logPrompt(
    "routing-agent-customer-identification",
    { label: "production", agentId: "routing-agent-customer-identification" },
    CUSTOMER_IDENTIFICATION_INSTRUCTIONS,
    { length: CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length }
  );
} catch {}
