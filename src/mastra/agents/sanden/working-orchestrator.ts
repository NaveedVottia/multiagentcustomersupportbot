import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
  delegateTo, 
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

// Load Langfuse prompt only
const lfci = await loadLangfusePrompt("repair-workflow-orchestrator", { label: "production" });
const ORCHESTRATOR_INSTRUCTIONS = lfci?.trim() || "";

// Debug logging
console.log("🔍 Working Orchestrator Agent Instructions:");
console.log("📝 Langfuse Instructions Length:", ORCHESTRATOR_INSTRUCTIONS.length);
console.log("📝 Using Langfuse:", ORCHESTRATOR_INSTRUCTIONS ? "YES" : "NO (empty)");
if (ORCHESTRATOR_INSTRUCTIONS) {
  console.log("📝 Instructions Preview:", ORCHESTRATOR_INSTRUCTIONS.substring(0, 200) + "...");
}

export const workingOrchestratorAgent = new Agent({ 
  name: "repair-workflow-orchestrator",
  description: "サンデン・リテールシステム修理受付AI , ワークフローオーケストレーター",
  instructions: ORCHESTRATOR_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    delegateTo,
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
    "repair-workflow-orchestrator",
    { label: "production", agentId: "repair-workflow-orchestrator" },
    ORCHESTRATOR_INSTRUCTIONS,
    { length: ORCHESTRATOR_INSTRUCTIONS.length }
  );
} catch {}
