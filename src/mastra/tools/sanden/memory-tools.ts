import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sharedMastraMemory } from "../../shared-memory";

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

// Helper function to get formatted customer profile from memory (legacy approach)
const getCustomerProfile = () => {
  try {
    const customerId = sharedMastraMemory.get("customerId");
    const storeName = sharedMastraMemory.get("storeName");
    const email = sharedMastraMemory.get("email");
    const phone = sharedMastraMemory.get("phone");
    const location = sharedMastraMemory.get("location");
    const lastInteraction = sharedMastraMemory.get("lastInteraction");
    const currentAgent = sharedMastraMemory.get("currentAgent");
    const sessionStart = sharedMastraMemory.get("sessionStart");
    
    if (customerId) {
      return WORKING_MEMORY_TEMPLATE
        .replace("{{customerId}}", customerId || "N/A")
        .replace("{{storeName}}", storeName || "N/A")
        .replace("{{email}}", email || "N/A")
        .replace("{{phone}}", phone || "N/A")
        .replace("{{location}}", location || "N/A")
        .replace("{{lastInteraction}}", lastInteraction || "N/A")
        .replace("{{currentAgent}}", currentAgent || "N/A")
        .replace("{{sessionStart}}", sessionStart || "N/A");
    }
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
      const profile = getCustomerProfile();
      const customerId = sharedMastraMemory.get("customerId");
      
      if (profile && customerId) {
        console.log(`🔍 [DEBUG] Retrieved customer profile for ${customerId}`);
        return {
          success: true,
          profile,
          customerId,
          hasProfile: true,
        };
      } else {
        console.log(`🔍 [DEBUG] No customer profile found in memory`);
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
      sharedMastraMemory.set("currentAgent", agentName);
      sharedMastraMemory.set("lastInteraction", new Date().toISOString());
      
      console.log(`🔍 [DEBUG] Updated current agent to: ${agentName}`);
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
      // Clear all customer-related memory keys
      const keysToClear = [
        "customerId", "storeName", "email", "phone", "location",
        "lastInteraction", "currentAgent", "sessionStart"
      ];
      
      keysToClear.forEach(key => {
        try {
          sharedMastraMemory.set(key, null);
        } catch (error) {
          console.log(`❌ [DEBUG] Failed to clear key ${key}:`, error);
        }
      });
      
      console.log(`🔍 [DEBUG] Cleared all customer data from memory`);
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
