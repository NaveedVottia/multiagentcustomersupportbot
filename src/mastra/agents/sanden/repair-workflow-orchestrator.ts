import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
  delegateTo, 
  escalateToHuman, 
  validateContext, 
  updateWorkflowState, 
  logCustomerData, 
  lookupCustomerFromDatabase,
  openUrl
} from "../../tools/sanden/orchestrator-tools.js";
import { 
  updateCustomer, 
  getCustomerHistory,
  customerTools
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
import {
  sendOtp,
  verifyOtp,
  resendOtp
} from "../../tools/sanden/otp-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";

// Agent factory function
async function createRepairWorkflowOrchestrator(): Promise<Agent> {
  console.log("🔍 Creating Repair Workflow Orchestrator Agent...");
  
  // Load Langfuse prompt with retry logic
  let instructions = "";
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`🔍 Attempt ${attempts} to load prompt: repair-workflow-orchestrator`);
      const loadedInstructions = await loadLangfusePrompt("repair-workflow-orchestrator", { label: "production" });
      
      if (loadedInstructions && loadedInstructions.trim().length > 100) {
        instructions = loadedInstructions.trim();
        console.log(`✅ Successfully loaded Langfuse instructions (length: ${instructions.length})`);
        break;
      } else {
        console.warn(`⚠️ Attempt ${attempts}: Empty or too short Langfuse instructions (${loadedInstructions?.length || 0} chars)`);
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
  
  // Fail if no instructions loaded
  if (!instructions || instructions.trim().length < 100) {
    throw new Error("Failed to load repair-workflow-orchestrator instructions from Langfuse");
  }
  
  console.log(`✅ Using instructions from Langfuse (length: ${instructions.length})`);
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-workflow-orchestrator",
    description: "サンデン・リテールシステム修理受付オーケストレーター",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      delegateTo,
      openUrl,
      validateContext,
      updateWorkflowState,
      logCustomerData,
      lookupCustomerFromDatabase,
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
      sendOtp,
      verifyOtp,
      resendOtp,
      ...customerTools
    },
    memory: new Memory(),
  });

  console.log("✅ Repair Workflow Orchestrator Agent created with instructions length:", instructions.length);
  
  // Log the prompt to Langfuse tracing
  try {
    await langfuse.logPrompt("repair-workflow-orchestrator", 
      instructions, 
      "Agent created successfully"
    );
    console.log("✅ Prompt logged to Langfuse tracing");
  } catch (error) {
    console.warn("⚠️ Failed to log prompt to Langfuse:", error);
  }

  return agent;
}

export { createRepairWorkflowOrchestrator };
