import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
  delegateTo, 
  escalateToHuman, 
  validateContext, 
  updateWorkflowState,
  getWorkflowState, 
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
  hybridGetProductsByCustomerId,
  hybridGetRepairsByCustomerId,
  hybridLookupCustomerByDetails,
  hybridCreateLogEntry
} from "../../tools/sanden/hybrid-customer-tools.js";
import { 
  createRepairTool, 
  updateRepairTool, 
  getRepairStatusTool 
} from "../../tools/sanden/repair-tools.js";
import { readFileSync } from 'fs';
import { join } from 'path';

// Agent factory function
async function createRepairAgent(): Promise<Agent> {
  console.log("🔍 Creating Repair Agent...");
  
  // Load hardcoded prompt from file
  let instructions = "";
  try {
    const promptPath = join(process.cwd(), 'src/mastra/prompts/repair-agent-prompt.txt');
    instructions = readFileSync(promptPath, 'utf8').trim();
    console.log(`✅ Successfully loaded repair agent instructions (length: ${instructions.length})`);
  } catch (error) {
    console.error("❌ Failed to load repair agent prompt:", error);
    throw new Error("Failed to load repair-agent-prompt.txt");
  }
  
  console.log(`✅ Using repair agent instructions (length: ${instructions.length})`);
  
  // Create agent with plain text output for Mastra streaming
  const agent = new Agent({ 
    name: "repair-agent",
    description: "サンデン・リテールシステム修理エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      delegateTo,
      escalateToHuman,
      validateContext,
      updateWorkflowState,
      getWorkflowState,
      logCustomerData,
      // Hybrid tools for real data
      hybridLookupCustomerByDetails,
      hybridGetProductsByCustomerId,
      hybridGetRepairsByCustomerId,
      hybridCreateLogEntry,
      // Legacy tools (keep for compatibility)
      updateCustomer,
      getCustomerHistory,
      createProductTool,
      updateProductTool,
      searchProductsTool,
      checkWarrantyStatusTool,
      createRepairTool,
      updateRepairTool,
      getRepairStatusTool,
    },
  });

  console.log("✅ Repair Agent created with instructions length:", instructions.length);
  return agent;
}

export { createRepairAgent };
