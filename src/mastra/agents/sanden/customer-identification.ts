import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";


// Resolve instructions at module-load time to avoid mutating read-only properties
const lfci = await loadLangfusePrompt("routing-agent-customer-identification", { label: "production" });
const CUSTOMER_IDENTIFICATION_INSTRUCTIONS = lfci?.trim() || "";

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
