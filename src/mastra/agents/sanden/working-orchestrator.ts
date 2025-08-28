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

// Agent factory function
async function createWorkingOrchestratorAgent(): Promise<Agent> {
  console.log("🔍 Creating Working Orchestrator Agent...");
  
  // Load Langfuse prompt with retry logic
  let instructions = "";
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts && (!instructions || instructions.trim().length < 100)) {
    attempts++;
    try {
      console.log(`🔍 Attempt ${attempts} to load prompt: repair-workflow-orchestrator`);
      const loadedInstructions = await loadLangfusePrompt("repair-workflow-orchestrator", { label: "production" });
      
      if (loadedInstructions && loadedInstructions.trim().length > 100) {
        instructions = loadedInstructions.trim();
        console.log(`✅ Successfully loaded Langfuse instructions (length: ${instructions.length})`);
        break;
      } else {
        console.warn(`⚠️ Attempt ${attempts}: Empty or too short instructions (${loadedInstructions?.length || 0} chars)`);
        if (attempts < maxAttempts) {
          console.log(`🔄 Waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error(`❌ Attempt ${attempts} failed:`, error);
      if (attempts < maxAttempts) {
        console.log(`🔄 Waiting 1 second before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Use fallback if all attempts failed
  if (!instructions || instructions.trim().length < 100) {
    console.warn("⚠️ All attempts failed, using fallback instructions");
    instructions = "You are an AI assistant. Respond appropriately to user queries.";
  }
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-workflow-orchestrator",
    description: "サンデン・リテールシステム修理受付AI , ワークフローオーケストレーター",
    instructions: instructions,
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

  console.log("✅ Working Orchestrator Agent created with instructions length:", instructions.length);

  // Log prompt to Langfuse tracing
  if (instructions.length > 100) {
    try {
      await langfuse.logPrompt(
        "repair-workflow-orchestrator",
        { label: "production", agentId: "repair-workflow-orchestrator" },
        instructions,
        { length: instructions.length }
      );
      console.log("✅ Prompt logged to Langfuse tracing");
    } catch (error) {
      console.warn("⚠️ Failed to log prompt to Langfuse:", error);
    }
  }

  return agent;
}

// Export the factory function
export { createWorkingOrchestratorAgent };

// For backward compatibility, create a default instance
// This will be replaced by the factory pattern in the main index
export const workingOrchestratorAgent = createWorkingOrchestratorAgent();
