import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { 
  delegateTo, 
  escalateToHuman, 
  openUrl,
  validateContext,
  updateWorkflowState,
  getWorkflowState
} from "../../tools/sanden/orchestrator-tools.js";
import { 
  validateSession
} from "../../tools/sanden/common-tools.js";
// OTP tools removed - using direct customer identification workflow
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
  
  // Create agent with enhanced memory for conversation state
  const agent = new Agent({ 
    name: "repair-workflow-orchestrator",
    description: "サンデン・リテールシステム統合オーケストレーター",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      // Essential delegation and workflow tools only
      delegateTo,
      escalateToHuman,
      openUrl,
      validateContext,
      updateWorkflowState,
      getWorkflowState,
      // Basic session validation
      validateSession,
    },
    memory: new Memory(),
  });

  console.log("✅ Repair Workflow Orchestrator created with instructions length:", instructions.length);
  return agent;
}

export { createRepairWorkflowOrchestrator };

