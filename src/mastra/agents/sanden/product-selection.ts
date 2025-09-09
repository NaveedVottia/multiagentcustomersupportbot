import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sharedMastraMemory } from "../../shared-memory.js";

// Load environment variables with absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../server.env") });

// Load instructions from Langfuse synchronously first
let REPAIR_AGENT_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("repair-agent", undefined, { cacheTtlSeconds: 0 });
  if (promptClient?.prompt?.trim()) {
    REPAIR_AGENT_INSTRUCTIONS = promptClient.prompt.trim();
    console.log(`[Langfuse] ✅ Loaded repair-agent prompt via SDK (v${promptClient.version})`);
  } else {
    console.warn(`[Langfuse] ⚠️ No prompt available for repair-agent`);
  }
} catch (error) {
  console.error("[Langfuse] Failed to load repair-agent prompt:", error);
}

// Create agent with instructions loaded from Langfuse
export const repairAgentProductSelection = new Agent({
  name: "repair-agent",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
  instructions: REPAIR_AGENT_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
    logCustomerData: orchestratorTools.logCustomerData, // Add logCustomerData tool
  },
  memory: sharedMastraMemory, // Use shared memory
});
