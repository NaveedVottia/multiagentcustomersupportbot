import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import { sharedMemory } from "./customer-identification";

dotenv.config({ path: "./server.env" });

let REPAIR_HISTORY_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("repair-history-ticket", undefined, { cacheTtlSeconds: 0 });
  REPAIR_HISTORY_INSTRUCTIONS = promptClient?.prompt?.trim() || "";
  console.log(`[Langfuse] ✅ Loaded repair-history-ticket prompt via SDK (v${promptClient.version})`);
} catch (error) {
  console.error("[Langfuse] Failed to load repair-history-ticket prompt:", error);
  REPAIR_HISTORY_INSTRUCTIONS = "";
}

export const repairQaAgentIssueAnalysis = new Agent({
  name: "repair-history-ticket",
  description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
  instructions: REPAIR_HISTORY_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...repairTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools,
  },
  memory: sharedMemory,
});
