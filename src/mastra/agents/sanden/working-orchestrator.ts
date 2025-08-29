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
  lookupCustomerFromDatabase,
  openUrl
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
  createAppointmentTool,
  updateAppointmentTool,
  checkAvailabilityTool
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
import { readFileSync } from 'fs';
import { join } from 'path';

// Menu formatting function
function formatMenuOutput(text: string): string {
  // Check if this is a menu response
  if (text.includes('1. 修理受付・修理履歴・修理予約') && 
      text.includes('2. 一般的なFAQ') && 
      text.includes('3. リクエスト送信用オンラインフォーム')) {
    
    // Extract the greeting part
    const greeting = text.split('1.')[0].trim();
    
    // Format the menu with proper line breaks
    const formattedMenu = `${greeting}

1. 修理受付・修理履歴・修理予約

2. 一般的なFAQ

3. リクエスト送信用オンラインフォーム`;
    
    return formattedMenu;
  }
  
  return text;
}

// Agent factory function
async function createRepairWorkflowOrchestrator(): Promise<Agent> {
  console.log("🔍 Creating Repair Workflow Orchestrator...");
  
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
  
  // Create agent with plain text output for Mastra streaming
  const agent = new Agent({ 
    name: "repair-workflow-orchestrator",
    description: "サンデン・リテールシステム統合オーケストレーター",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      delegateTo,
      escalateToHuman,
      validateContext,
      updateWorkflowState,
      getWorkflowState,
      logCustomerData,
      lookupCustomerFromDatabase,
      openUrl,
      updateCustomer,
      getCustomerHistory,
      createProductTool,
      updateProductTool,
      searchProductsTool,
      checkWarrantyStatusTool,
      createRepairTool,
      updateRepairTool,
      getRepairStatusTool,
      createAppointmentTool,
      updateAppointmentTool,
      checkAvailabilityTool,
      validateSession,
      getSystemInfo,
      getHelp,
      zapierAiQuery,
      sendOtp,
      verifyOtp,
      resendOtp,
    },
    memory: new Memory(),
  });

  console.log("✅ Repair Workflow Orchestrator created with instructions length:", instructions.length);
  return agent;
}

export { createRepairWorkflowOrchestrator };

