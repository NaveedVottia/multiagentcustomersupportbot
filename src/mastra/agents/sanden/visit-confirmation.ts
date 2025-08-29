import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";

// Agent factory function
async function createVisitConfirmationAgent(): Promise<Agent> {
  console.log("🔍 Creating Visit Confirmation Agent...");
  
  // Load Langfuse prompt with retry logic
  let instructions = "";
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      console.log(`🔍 Attempt ${attempts} to load prompt: repair-visit-confirmation-agent`);
      const loadedInstructions = await loadLangfusePrompt("repair-visit-confirmation-agent", { label: "production" });
      
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
    throw new Error("Failed to load repair-visit-confirmation-agent instructions from Langfuse");
  }
  
  console.log(`✅ Using instructions from Langfuse (length: ${instructions.length})`);
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "repair-visit-confirmation-agent",
    description: "サンデン・リテールシステム修理受付AI , 訪問確認エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      schedulingTools,
      ...commonTools,
    },
    memory: new Memory(),
  });

  console.log("✅ Visit Confirmation Agent created with instructions length:", instructions.length);
  
  // Log the prompt to Langfuse tracing
  try {
    await langfuse.logPrompt("repair-visit-confirmation-agent", 
      instructions, 
      "Agent created successfully"
    );
    console.log("✅ Prompt logged to Langfuse tracing");
  } catch (error) {
    console.warn("⚠️ Failed to log prompt to Langfuse:", error);
  }

  return agent;
}

export { createVisitConfirmationAgent };
