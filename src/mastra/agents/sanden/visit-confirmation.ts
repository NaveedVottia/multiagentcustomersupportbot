import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";
import { sharedMastraMemory } from "../../shared-memory.js";

export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
   
  instructions: "", // Will be loaded from Langfuse
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...productTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
  } as any,
  memory: sharedMastraMemory, // Use shared memory instead of new Memory()
});

// Bind prompt from Langfuse
(async () => {
  try {
    console.log("🔄 Loading repair-scheduling prompt from Langfuse...");
    const prompt = await loadLangfusePrompt("repair-scheduling", {cacheTtlMs: 0 , label: "production" });
    if (prompt) {
      (repairVisitConfirmationAgent as any).__updateInstructions(prompt);
      console.log("✅ Repair-scheduling prompt loaded successfully, length:", prompt.length);
    } else {
      console.log("❌ No prompt found for repair-scheduling");
    }
    try {
      await langfuse.logPrompt("repair-scheduling", { label: "production", agentId: "repair-scheduling" }, prompt, { length: prompt?.length || 0 });
    } catch (logError) {
      console.log("⚠️ Failed to log prompt to Langfuse:", logError instanceof Error ? logError.message : String(logError));
    }
  } catch (error) {
    console.error("❌ Failed to load repair-scheduling prompt:", error);
  }
})();
