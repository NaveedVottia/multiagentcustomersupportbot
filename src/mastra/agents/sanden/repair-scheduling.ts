import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sharedMastraMemory } from "../../shared-memory";

// Load environment variables with absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../server.env") });

// Load instructions from Langfuse synchronously first
let REPAIR_SCHEDULING_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("repair-scheduling", undefined, { cacheTtlSeconds: 0 });
  if (promptClient?.prompt?.trim()) {
    REPAIR_SCHEDULING_INSTRUCTIONS = promptClient.prompt.trim();
    console.log(`[Langfuse] ✅ Loaded repair-scheduling prompt via SDK (v${promptClient.version})`);
  } else {
    console.warn(`[Langfuse] ⚠️ No prompt available for repair-scheduling`);
  }
} catch (error) {
  console.error("[Langfuse] Failed to load repair-scheduling prompt:", error);
}

export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
  instructions: REPAIR_SCHEDULING_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...productTools, // Add product tools for hybridGetProductsByCustomerId
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
    lookupCustomerFromDatabase: orchestratorTools.lookupCustomerFromDatabase, // Add lookup tool
  },
  memory: sharedMastraMemory, // Use shared memory
});
