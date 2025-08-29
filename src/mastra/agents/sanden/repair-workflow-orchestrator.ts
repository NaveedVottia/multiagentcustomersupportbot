import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
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
  hybridLookupCustomerByDetails,
  hybridGetRepairsByCustomerId,
  hybridGetProductsByCustomerId
} from "../../tools/sanden/hybrid-customer-tools.js";
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
// OTP tools removed - using direct customer identification workflow
import { readFileSync } from 'fs';
import { join } from 'path';

// Agent factory function
async function createRepairWorkflowOrchestrator(): Promise<Agent> {
  console.log("🔍 Creating Repair Workflow Orchestrator Agent...");
  
    // Load hardcoded prompt from file
  let instructions = "";
  try {
    const promptPath = join(process.cwd(), 'src/mastra/prompts/orchestrator-prompt.txt');
    instructions = readFileSync(promptPath, 'utf8').trim();
    console.log(`✅ Successfully loaded hardcoded instructions (length: ${instructions.length})`);
  } catch (error) {
    console.error("❌ Failed to load hardcoded prompt:", error);
    throw new Error("Failed to load orchestrator-prompt.txt");
  }
  
  console.log(`✅ Using hardcoded instructions (length: ${instructions.length})`);
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-workflow-orchestrator",
    description: "サンデン・リテールシステム修理受付オーケストレーター",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      openUrl,
      validateContext,
      updateWorkflowState,
      logCustomerData,
      lookupCustomerFromDatabase,
      // Hybrid tools for proper customer identification and data retrieval
      hybridLookupCustomerByDetails,
      hybridGetRepairsByCustomerId,
      hybridGetProductsByCustomerId,
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
      // OTP tools removed
      ...customerTools
    },
    memory: new Memory(),
  });

  console.log("✅ Repair Workflow Orchestrator Agent created with instructions length:", instructions.length);

  return agent;
}

export { createRepairWorkflowOrchestrator };
