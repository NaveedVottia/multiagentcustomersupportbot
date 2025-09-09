import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { repairTools } from "../../tools/sanden/repair-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { z } from "zod";
import { sharedMastraMemory, createMemoryIds, storeCustomerData } from "../../shared-memory.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

// Initialize agent with async prompt loading
let routingAgentCustomerIdentification: Agent;

async function initializeAgent() {
  const instructions = await loadLangfusePrompt("customer-identification", { cacheTtlMs: 0, label: "production" });
  console.log(`🔍 [DEBUG] Customer identification prompt loaded: ${instructions ? '✅ Success' : '❌ Failed'}`);

  routingAgentCustomerIdentification = new Agent({
    name: "customer-identification",
    description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0", {
      temperature: 0.1,
      maxTokens: 1000,
    }),
    tools: {
      // Re-enable all tools with fixed schemas
      ...commonTools,
      ...customerTools,
      delegateTo: enhancedDelegateTo,
      lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
      directRepairHistory: directRepairHistoryTool,
    },
    memory: sharedMastraMemory, // Re-enable shared memory
  });

  return routingAgentCustomerIdentification;
}

// Debug logging
console.log("🔍 Customer Identification Agent Configuration:");
console.log("📝 Langfuse Prompt Loading: ✅ Enabled");
console.log("📝 Model Temperature: 0.1 (deterministic)");
console.log("📝 Max Tokens: 1000");
console.log("📝 Memory: ✅ Using proper Mastra Memory with resource/thread IDs");

// Create a custom delegateTo tool that automatically includes customer ID from memory
const enhancedDelegateTo = {
  ...orchestratorTools.delegateTo,
  execute: async (args: any) => {
    const parsed = args.input || args.context || {};
    const agentId = parsed.agentId || "customer-identification";
    const agentContext = parsed.context || {};
    const message = parsed.message || "顧客情報の確認をお願いします。";
    
    console.log(`🔍 [DEBUG] Delegating to ${agentId} with context:`, JSON.stringify(agentContext));
    
    // Call the original delegateTo tool
    return orchestratorTools.delegateTo.execute({
      ...args,
      context: {
        ...parsed,
        context: agentContext
      }
    });
  }
};

// Create a direct repair history tool that bypasses delegation
const directRepairHistoryTool = {
  id: "directRepairHistory",
  description: "Get repair history directly without delegation",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Customer ID to get repair history for"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async (args: any) => {
    const { customerId } = args.input || args.context || {};
    
    if (!customerId) {
      return {
        success: false,
        data: null,
        message: "顧客IDが必要です。",
      };
    }
    
    try {
      console.log(`🔍 [DEBUG] Direct repair history lookup for customer ID: ${customerId}`);
      
      // Import the repair tool directly
      const { hybridGetRepairsByCustomerIdTool } = await import("../../tools/sanden/repair-tools");
      
      const result = await hybridGetRepairsByCustomerIdTool.execute({
        context: { customerId }
      });
      
      console.log(`🔍 [DEBUG] Direct repair history result:`, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in direct repair history:`, error);
      return {
        success: false,
        data: null,
        message: `エラーが発生しました: ${error.message}`,
      };
    }
  },
};

// Create a custom lookupCustomerFromDatabase tool that stores customer ID in shared memory
const enhancedLookupCustomerFromDatabase = {
  ...orchestratorTools.lookupCustomerFromDatabase,
  execute: async (args: any) => {
    const result = await orchestratorTools.lookupCustomerFromDatabase.execute(args);
    
    // If customer was found, store the customer ID and profile in shared memory
    if (result.found && result.customerData && result.customerData.customerId) {
      try {
        const customerData = result.customerData;
        
        // Create memory IDs for this session
        const memIds = createMemoryIds(`session-${Date.now()}`, customerData.customerId);
        
        // Store customer data using the proper shared memory functions
        await storeCustomerData(memIds, customerData);
        
        console.log(`🔍 [DEBUG] Stored complete customer profile in shared memory:`, {
          customerId: customerData.customerId,
          storeName: customerData.storeName,
          email: customerData.email,
          phone: customerData.phone,
          location: customerData.location
        });
      } catch (error) {
        console.log(`❌ [DEBUG] Failed to store customer profile in shared memory:`, error);
      }
    }
    
    return result;
  }
};

// Initialize the agent asynchronously
const agentPromise = initializeAgent();

// Export the agent initialization function and promise
export { agentPromise, initializeAgent, sharedMastraMemory };

// Export the agent as a promise for compatibility
export const getRoutingAgentCustomerIdentification = () => agentPromise;

console.log("✅ Customer Identification Agent module loaded");
