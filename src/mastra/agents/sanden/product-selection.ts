import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";

export const repairAgentProductSelection = new Agent({ 
  name: "repair-agent-product-selection",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
   
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...commonTools,
  },
  memory: new Memory(),
});

// Bind prompt from Langfuse
(async () => {
  try {
    const prompt = await loadLangfusePrompt("repair-agent-product-selection", { label: "production" });
    (repairAgentProductSelection as any).instructions = prompt;
    console.log(`[Langfuse] Loaded prompt: repair-agent-product-selection@production (${prompt?.length || 0} chars)`);
    try {
      await langfuse.logPrompt("repair-agent-product-selection", { label: "production", agentId: "repair-agent-product-selection" }, prompt, { length: prompt?.length || 0 });
    } catch {}
  } catch {}
})();
