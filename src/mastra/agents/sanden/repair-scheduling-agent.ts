import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { repairTools } from "../../tools/sanden/repair-tools.js";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { readFileSync } from 'fs';
import { join } from 'path';

// Agent factory function
async function createRepairSchedulingAgent(): Promise<Agent> {
  console.log("🔍 Creating Repair Scheduling Agent...");
  
  // Load hardcoded prompt from file
  let instructions = "";
  try {
    const promptPath = join(process.cwd(), 'src/mastra/prompts/repair-scheduling-prompt.txt');
    instructions = readFileSync(promptPath, 'utf8').trim();
    console.log(`✅ Successfully loaded hardcoded instructions (length: ${instructions.length})`);
  } catch (error) {
    console.error("❌ Failed to load hardcoded prompt:", error);
    throw new Error("Failed to load repair-scheduling-prompt.txt");
  }
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-scheduling-agent",
    description: "サンデン・リテールシステム修理予約エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      ...customerTools,
      ...commonTools,
      ...orchestratorTools,
      ...repairTools,
      ...schedulingTools,
    },
    memory: new Memory(),
  });

  console.log("✅ Repair Scheduling Agent created with instructions length:", instructions.length);
  return agent;
}

export { createRepairSchedulingAgent };
