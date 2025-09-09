import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { repairTools } from "../../tools/sanden/repair-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sharedMastraMemory } from "../../shared-memory.js";
import { langfuse } from "../../../integrations/langfuse.js";

// Load environment variables with absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../server.env") });

const defaultPrompt = `
あなたはサンデン・リテールシステムの修理受付AIエージェントです。
顧客の識別と修理の受付を行います。

【主な役割】
1. 顧客情報の確認・識別
2. 修理内容のヒアリング
3. 適切なエージェントへの振り分け

【対応手順】
1. 顧客の基本情報（会社名、連絡先等）を確認
2. 修理対象製品の情報を収集
3. 問題の詳細をヒアリング
4. 必要に応じて他の専門エージェントに振り分け

常に丁寧で親切な対応を心がけてください。
`;

// Load instructions from Langfuse using existing integration
const prompt = await langfuse.getPromptText('customer-identification', 'production') || defaultPrompt;

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
    data: z.any(),
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
        
        // Store individual fields in memory
        sharedMastraMemory.set("customerId", customerData.customerId);
        sharedMastraMemory.set("storeName", customerData.storeName);
        sharedMastraMemory.set("email", customerData.email);
        sharedMastraMemory.set("phone", customerData.phone);
        sharedMastraMemory.set("location", customerData.location);
        sharedMastraMemory.set("lastInteraction", new Date().toISOString());
        sharedMastraMemory.set("currentAgent", "customer-identification");
        sharedMastraMemory.set("sessionStart", new Date().toISOString());
        
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

// Create agent with instructions loaded from Langfuse
export const routingAgentCustomerIdentification = new Agent({ 
  name: "customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
  instructions: prompt,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0", {
    temperature: 0.1, // Lower temperature for more deterministic behavior
    maxTokens: 1000,
  }),
  tools: {
    ...customerTools,
    ...commonTools,
    delegateTo: enhancedDelegateTo,
    lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
    directRepairHistory: directRepairHistoryTool,
  },
  memory: sharedMastraMemory, // Use shared memory
});

// Debug: Log available tools
console.log("🔍 [DEBUG] Customer Identification Agent Tools:", Object.keys({
  ...customerTools,
  ...commonTools,
  delegateTo: enhancedDelegateTo,
  lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
  directRepairHistory: directRepairHistoryTool,
}));

console.log("✅ Customer Identification Agent created with Langfuse prompt loading");

// Export the shared memory instance for use in other agents
export { sharedMastraMemory };
