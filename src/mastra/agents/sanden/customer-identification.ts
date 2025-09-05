import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { langfuse } from "../../../integrations/langfuse";
import { z } from "zod";
import dotenv from "dotenv";
import { sharedMastraMemory, storeCustomerData } from "../../shared-memory";

// Load environment variables
dotenv.config({ path: "./server.env" });

// Load Langfuse prompt synchronously before creating the agent
async function loadLangfusePrompt(): Promise<string> {
  let retries = 5;
  while (retries > 0) {
    try {
      // Wait a bit for environment to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`[Langfuse] Attempting to load customer-identification prompt (attempt ${6 - retries})...`);
      const promptText = await langfuse.getPromptText("customer-identification", "production");
      console.log(`[Langfuse] Raw instructions length: ${promptText?.length || 0}`);
      
      if (promptText && promptText.trim() && promptText.length > 0) {
        console.log(`[Langfuse] ✅ Loaded customer-identification prompt (${promptText.length} chars)`);
        return promptText.trim();
      } else {
        console.log(`[Langfuse] Empty prompt received for customer-identification, retries left: ${retries - 1}`);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      console.error(`[Langfuse] Failed to load customer-identification prompt (retries left: ${retries - 1}):`, error);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  // No fallback - throw error if Langfuse fails
  throw new Error("Failed to load customer-identification prompt from Langfuse after 5 attempts");
}

// Load the prompt synchronously
const CUSTOMER_IDENTIFICATION_INSTRUCTIONS = await loadLangfusePrompt();

// Debug logging
console.log("🔍 Customer Identification Agent Instructions:");
console.log("📝 Langfuse Instructions Length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);
console.log("📝 Using Langfuse:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS ? "YES" : "NO (empty)");
if (CUSTOMER_IDENTIFICATION_INSTRUCTIONS) {
  console.log("📝 Instructions Preview:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.substring(0, 200) + "...");
}

// Global session-aware memory store
const globalMemoryStore = new Map<string, Map<string, any>>();

// Session-aware shared memory that can work with server session management
const createSessionAwareMemory = (sessionId: string) => {
  // Get or create session-specific memory
  if (!globalMemoryStore.has(sessionId)) {
    globalMemoryStore.set(sessionId, new Map());
    console.log(`🔍 [DEBUG] Created new memory store for session: ${sessionId}`);
  }
  
  const sessionMemory = globalMemoryStore.get(sessionId)!;
  
  return {
    _data: sessionMemory,
    sessionId: sessionId,
    set: function(key: string, value: any) {
      this._data.set(key, value);
      console.log(`🔍 [DEBUG] Session ${this.sessionId} Memory set: ${key} = ${value}`);
    },
    get: function(key: string) {
      const value = this._data.get(key);
      console.log(`🔍 [DEBUG] Session ${this.sessionId} Memory get: ${key} = ${value}`);
      return value;
    },
    clear: function() {
      this._data.clear();
      console.log(`🔍 [DEBUG] Session ${this.sessionId} Memory cleared`);
    },
    // Add required Mastra methods
    __registerMastra: function() {
      console.log(`🔍 [DEBUG] Session ${this.sessionId} Memory __registerMastra called`);
      return this;
    },
    getMemory: function() {
      return this;
    },
    hasOwnMemory: function() {
      return true;
    },
    getMemoryTools: function() {
      return [];
    },
    fetchMemory: function() {
      return Promise.resolve([]);
    },
    getMemoryMessages: function() {
      return [];
    },
    setStorage: function(storage: any) {
      console.log(`🔍 [DEBUG] Session ${this.sessionId} Memory setStorage called with:`, storage);
      return this;
    }
  };
};

// Default shared memory for backward compatibility
const sharedMemory = createSessionAwareMemory("default");

// Enhanced memory sharing function that works across agents
export function getSharedMemoryForAgent(sessionId: string = "default") {
  const sessionMemory = createSessionAwareMemory(sessionId);
  
  // Add enhanced methods for cross-agent memory sharing
  return {
    ...sessionMemory,
    // Enhanced method to get customer data for other agents
    getCustomerData: function() {
      return {
        customerId: this.get("customerId"),
        storeName: this.get("storeName"),
        email: this.get("email"),
        phone: this.get("phone"),
        location: this.get("location"),
        lastInteraction: this.get("lastInteraction"),
        currentAgent: this.get("currentAgent"),
        sessionStart: this.get("sessionStart")
      };
    },
    // Enhanced method to set customer data from other agents
    setCustomerData: function(customerData: any) {
      if (customerData.customerId) this.set("customerId", customerData.customerId);
      if (customerData.storeName) this.set("storeName", customerData.storeName);
      if (customerData.email) this.set("email", customerData.email);
      if (customerData.phone) this.set("phone", customerData.phone);
      if (customerData.location) this.set("location", customerData.location);
      this.set("lastInteraction", new Date().toISOString());
      console.log(`🔍 [DEBUG] Set complete customer data in session ${this.sessionId}:`, customerData);
    }
  };
}

// Function to get session-aware memory
export function getSessionMemory(sessionId: string = "default") {
  return createSessionAwareMemory(sessionId);
}

// Working memory template for customer profiles
const WORKING_MEMORY_TEMPLATE = `# Customer Profile
- **Customer ID**: {{customerId}}
- **Store Name**: {{storeName}}
- **Email**: {{email}}
- **Phone**: {{phone}}
- **Location**: {{location}}
- **Last Interaction**: {{lastInteraction}}
- **Current Agent**: {{currentAgent}}
- **Session Start**: {{sessionStart}}`;

// Use proper Mastra agent delegation instead of custom delegateTo tool
// This will be handled by the server routing logic

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
    let { customerId } = args.input || args.context || {};
    
    console.log(`🔍 [DEBUG] Direct repair history tool called with args:`, JSON.stringify(args, null, 2));
    
    // If no customerId provided, try to get it from shared memory
    if (!customerId) {
      try {
        customerId = sharedMemory.get("customerId");
        console.log(`🔍 [DEBUG] Retrieved customer ID from shared memory: ${customerId}`);
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from shared memory:`, error);
      }
    }
    
    if (!customerId) {
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客識別を完了してください。",
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
        
        // Store customer data in shared Mastra memory
        await storeCustomerData(customerData);
        
        // Also store in our custom shared memory for backward compatibility
        sharedMemory.set("customerId", customerData.customerId);
        sharedMemory.set("storeName", customerData.storeName);
        sharedMemory.set("email", customerData.email);
        sharedMemory.set("phone", customerData.phone);
        sharedMemory.set("location", customerData.location);
        sharedMemory.set("lastInteraction", new Date().toISOString());
        sharedMemory.set("currentAgent", "customer-identification");
        sharedMemory.set("sessionStart", new Date().toISOString());
        
        console.log(`🔍 [DEBUG] Stored customer data in Mastra memory:`, customerData);
      } catch (error) {
        console.log(`❌ [DEBUG] Failed to store customer profile in shared memory:`, error);
      }
    }
    
    return result;
  }
};

// Create a simple delegation tool for menu options
const menuDelegationTool = {
  id: "menuDelegation",
  description: "Handle menu option delegation to appropriate agents",
  inputSchema: z.object({
    option: z.string().describe("Menu option selected (1, 2, 3, 4)"),
    customerId: z.string().optional().describe("Customer ID if available")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    delegatedTo: z.string().optional()
  }),
  execute: async (args: any) => {
    const { option, customerId } = args.input || args.context || {};
    
    console.log(`🔧 [menuDelegation] Option: ${option}, Customer ID: ${customerId}`);
    
    // Get customer ID from shared memory if not provided
    let finalCustomerId = customerId;
    if (!finalCustomerId) {
      try {
        finalCustomerId = sharedMemory.get("customerId");
        console.log(`🔧 [menuDelegation] Retrieved customer ID from memory: ${finalCustomerId}`);
      } catch (error) {
        console.log(`❌ [menuDelegation] Error getting customer ID from memory:`, error);
      }
    }
    
    // Map menu options to agents
    const optionToAgent: Record<string, string> = {
      "1": "repair-history-ticket",
      "2": "repair-agent", 
      "3": "repair-scheduling",
      "4": "customer-identification"
    };
    
    const targetAgent = optionToAgent[option];
    if (!targetAgent) {
      return {
        success: false,
        message: "無効なオプションです。1-4の番号でお答えください。"
      };
    }
    
    // Create delegation message
    const delegationMessage = `DELEGATION_TO_${targetAgent.toUpperCase()}: 顧客ID ${finalCustomerId || 'N/A'} で${option}番のサービスを実行してください`;
    
    console.log(`🔧 [menuDelegation] Delegating to: ${targetAgent}`);
    console.log(`🔧 [menuDelegation] Message: ${delegationMessage}`);
    
    return {
      success: true,
      message: delegationMessage,
      delegatedTo: targetAgent
    };
  }
};

export const routingAgentCustomerIdentification = new Agent({ 
  name: "customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
  instructions: CUSTOMER_IDENTIFICATION_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...customerTools,
    ...commonTools,
    ...orchestratorTools, // Include orchestrator tools with hybrid delegateTo
    lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
    directRepairHistory: directRepairHistoryTool,
    menuDelegation: menuDelegationTool, // Add menu delegation tool
  },
  memory: sharedMastraMemory, // Use shared Mastra Memory for agent-to-agent sharing
});

console.log("✅ Customer Identification Agent created with instructions length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);

// Export the shared memory instance for use in other agents
export { sharedMemory };
