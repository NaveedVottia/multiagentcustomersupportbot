import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
  delegateTo, 
  forceDelegation,
  escalateToHuman, 
  validateContext, 
  updateWorkflowState, 
  logCustomerData, 
  lookupCustomerFromDatabase 
} from "../../tools/sanden/orchestrator-tools.js";
import { 
  updateCustomer, 
  getCustomerHistory 
} from "../../tools/sanden/customer-tools.js";
import { 
  createProductTool, 
  updateProductTool, 
  searchProductsTool, 
  checkWarrantyStatusTool 
} from "../../tools/sanden/product-tools.js";
import { 
  createRepairTool, 
  updateRepairTool, 
  getRepairStatusTool 
} from "../../tools/sanden/repair-tools.js";
import { 
  schedulingTools 
} from "../../tools/sanden/scheduling-tools.js";
import { 
  validateSession, 
  getSystemInfo, 
  getHelp, 
  zapierAiQuery 
} from "../../tools/sanden/common-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

// Create agent factory function that loads prompt after environment is ready
export async function createWorkingOrchestratorAgent() {
  // Load Langfuse prompt
  const lfci = await loadLangfusePrompt("orchestrator", { label: "production" });
  const ORCHESTRATOR_INSTRUCTIONS = lfci?.trim() || "You are a helpful AI assistant. Please respond to user messages.";

  // Debug logging
  console.log("🔍 Working Orchestrator Agent Instructions:");
  console.log("📝 Langfuse Instructions Length:", ORCHESTRATOR_INSTRUCTIONS.length);
  console.log("📝 Using Langfuse:", ORCHESTRATOR_INSTRUCTIONS ? "YES" : "NO (empty)");
  if (ORCHESTRATOR_INSTRUCTIONS) {
    console.log("📝 Instructions Preview:", ORCHESTRATOR_INSTRUCTIONS.substring(0, 200) + "...");
  }

  const agent = new Agent({ 
    name: "orchestrator",
    description: "サンデン・リテールシステム修理受付AI , ワークフローオーケストレーター",
    instructions: ORCHESTRATOR_INSTRUCTIONS,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      delegateTo,
      forceDelegation,
      escalateToHuman,
      validateContext,
      updateWorkflowState,
      logCustomerData,
      lookupCustomerFromDatabase,
      updateCustomer,
      getCustomerHistory,
      createProductTool,
      updateProductTool,
      searchProductsTool,
      checkWarrantyStatusTool,
      createRepairTool,
      updateRepairTool,
      getRepairStatusTool,
      schedulingTools,
      validateSession,
      getSystemInfo,
      getHelp,
      zapierAiQuery,
    },
    memory: new Memory(),
  });

  console.log("✅ Working Orchestrator Agent created with instructions length:", ORCHESTRATOR_INSTRUCTIONS.length);

  // Log prompt to Langfuse tracing
  try {
    await langfuse.logPrompt(
      "orchestrator",
      { label: "production", agentId: "orchestrator" },
      ORCHESTRATOR_INSTRUCTIONS,
      { length: ORCHESTRATOR_INSTRUCTIONS.length }
    );
  } catch {}

  return agent;
}

// Export a placeholder that will be replaced
export const workingOrchestratorAgent = null as any;
