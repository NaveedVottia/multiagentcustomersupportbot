import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { mastra } from "../../index.js";
import { hybridLookupCustomerByDetails, hybridRegisterCustomer, hybridGetRepairsByCustomerId, hybridGetProductsByCustomerId, hybridCreateLogEntry } from "../../tools/sanden/hybrid-customer-tools.js";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

export const customerIdentificationAgent = new Agent({
  name: "customer-identification",
  // Use exact Langfuse prompt name - no hardcoded fallbacks
  instructions: async () => {
    try {
      const prompt = await loadLangfusePrompt("customer-identification");
      if (prompt && prompt.trim()) {
        console.log("✅ Loaded customer-identification prompt from Langfuse");
        return prompt;
      }
      throw new Error("No customer-identification prompt available from Langfuse");
    } catch (error) {
      console.error("❌ Failed to load Langfuse prompt:", error);
      throw new Error("Langfuse prompt loading failed - agent cannot function without prompts");
    }
  },
  model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
  // Temporarily disabled memory to resolve storage configuration issues
  // memory: new Memory(),
  tools: [
    hybridLookupCustomerByDetails,
    hybridRegisterCustomer,
    hybridGetRepairsByCustomerId,
    hybridGetProductsByCustomerId,
    hybridCreateLogEntry,
    createTool({
      name: "delegateTo",
      description: "Delegate to another agent or workflow",
      parameters: z.object({
        target: z.string().describe("Target agent or workflow name"),
        context: z.string().describe("Context to pass to the target"),
      }),
      execute: async ({ target, context }: { target: string; context: string }) => {
        console.log(`🔄 Delegating to ${target} with context: ${context}`);
        return { success: true, target, context };
      },
    }),
    createTool({
      name: "getConversationState",
      description: "Get current conversation state",
      parameters: z.object({}),
      execute: async () => {
        return { state: "customer-identification" };
      },
    }),
  ],
});

