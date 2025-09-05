import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sharedMastraMemory, getCustomerData, storeCustomerData } from "../../shared-memory";

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

// Helper function to get formatted customer profile from memory
const getCustomerProfile = async () => {
  try {
    // Get customer data from Mastra Memory
    const customerData = await getCustomerData();
    
    if (customerData) {
      console.log(`🔍 [DEBUG] Retrieved customer profile from Mastra Memory`);
      return customerData;
    }
    
    console.log(`🔍 [DEBUG] No customer profile found in Mastra Memory`);
    return null;
  } catch (error) {
    console.log(`❌ [DEBUG] Error getting customer profile:`, error);
    return null;
  }
};

// Memory management tools
export const getCustomerProfileTool = createTool({
  id: "getCustomerProfile",
  description: "Get the current customer profile from shared memory",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    profile: z.string().optional(),
    customerId: z.string().optional(),
    hasProfile: z.boolean(),
  }),
  execute: async () => {
    try {
      const profile = await getCustomerProfile();
      
      if (profile) {
        console.log(`🔍 [DEBUG] Retrieved customer profile from Mastra Memory`);
        return {
          success: true,
          profile,
          hasProfile: true,
        };
      } else {
        console.log(`🔍 [DEBUG] No customer profile found in Mastra Memory`);
        return {
          success: true,
          hasProfile: false,
        };
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error in getCustomerProfileTool:`, error);
      return {
        success: false,
        hasProfile: false,
      };
    }
  },
});

export const updateCurrentAgentTool = createTool({
  id: "updateCurrentAgent",
  description: "Update the current agent in shared memory",
  inputSchema: z.object({
    agentName: z.string().describe("Name of the current agent"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    try {
      const { agentName } = input;
      
      // Update current agent in Mastra Memory using simple key-value storage
      sharedMastraMemory.set("current-agent", agentName);
      sharedMastraMemory.set("last-interaction", new Date().toISOString());
      
      console.log(`🔍 [DEBUG] Updated current agent to: ${agentName} in Mastra Memory`);
      return {
        success: true,
        message: `Current agent updated to ${agentName}`,
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in updateCurrentAgentTool:`, error);
      return {
        success: false,
        message: `Failed to update current agent: ${error.message}`,
      };
    }
  },
});

export const clearCustomerMemoryTool = createTool({
  id: "clearCustomerMemory",
  description: "Clear all customer data from shared memory",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    try {
      // Clear Mastra Memory by removing all customer-related keys
      // Note: Mastra Memory doesn't have a clear method, so we'll set empty values
      sharedMastraMemory.set("customer-default-thread", "");
      sharedMastraMemory.set("current-agent", "");
      sharedMastraMemory.set("last-interaction", "");
      
      console.log(`🔍 [DEBUG] Cleared all customer data from Mastra Memory`);
      return {
        success: true,
        message: "Customer memory cleared successfully",
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in clearCustomerMemoryTool:`, error);
      return {
        success: false,
        message: `Failed to clear customer memory: ${error.message}`,
      };
    }
  },
});

// Export memory tools
export const memoryTools = {
  getCustomerProfileTool,
  updateCurrentAgentTool,
  clearCustomerMemoryTool,
};
