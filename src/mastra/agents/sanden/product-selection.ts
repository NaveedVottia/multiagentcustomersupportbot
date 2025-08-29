import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { readFileSync } from 'fs';
import { join } from 'path';

// Agent factory function
async function createProductSelectionAgent(): Promise<Agent> {
  console.log("🔍 Creating Product Selection Agent...");
  
    // Load hardcoded prompt from file
  let instructions = "";
  try {
    const promptPath = join(process.cwd(), 'src/mastra/prompts/product-selection-prompt.txt');
    instructions = readFileSync(promptPath, 'utf8').trim();
    console.log(`✅ Successfully loaded hardcoded instructions (length: ${instructions.length})`);
  } catch (error) {
    console.error("❌ Failed to load hardcoded prompt:", error);
    throw new Error("Failed to load product-selection-prompt.txt");
  }
  
  console.log(`✅ Using hardcoded instructions (length: ${instructions.length})`);
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-agent-product-selection",
    description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      ...productTools,
      ...commonTools,
    },
    memory: new Memory(),
  });

  console.log("✅ Product Selection Agent created with instructions length:", instructions.length);

  return agent;
}

export { createProductSelectionAgent };
