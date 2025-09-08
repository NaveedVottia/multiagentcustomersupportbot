import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sharedMemory } from "../../lib/shared-memory";

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
const getCustomerProfile = async (sessionId: string = "default") => {
  try {
    const threadId = `customer-session-${sessionId}`
    const result = await sharedMemory.getWorkingMemory({
      threadId,
      resourceId: sessionId
    });

    if (result) {
      const customerId = result.customerId;
      const storeName = result.storeName;
      const email = result.email;
      const phone = result.phone;
      const location = result.location;
      const lastInteraction = result.lastInteraction;
      const currentAgent = result.currentAgent;
      const sessionStart = result.sessionStart;

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
  inputSchema: z.object({
    sessionId: z.string().optional().describe("Session ID for memory access"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    profile: z.string().optional(),
    customerId: z.string().optional(),
    hasProfile: z.boolean(),
  }),
  execute: async ({ input }: { input?: any }) => {
    try {
      const sessionId = input?.sessionId || "default";
      const profile = await getCustomerProfile(sessionId);

      const threadId = `customer-session-${sessionId}`
      const result = await sharedMemory.getWorkingMemory({
        threadId,
        resourceId: sessionId
      });
      const customerId = result?.customerId;

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
    sessionId: z.string().optional().describe("Session ID for memory access"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    try {
      const { agentName, sessionId = "default" } = input;
      const threadId = `customer-session-${sessionId}`

      // Update current agent in working memory
      await sharedMemory.updateWorkingMemory({
        threadId,
        resourceId: sessionId,
        workingMemory: {
          currentAgent: agentName,
          lastInteraction: new Date().toISOString()
        }
      });

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
  inputSchema: z.object({
    sessionId: z.string().optional().describe("Session ID for memory access"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input }: { input?: any }) => {
    try {
      const sessionId = input?.sessionId || "default";
      const threadId = `customer-session-${sessionId}`

      // Clear working memory by setting it to null/empty
      await sharedMemory.updateWorkingMemory({
        threadId,
        resourceId: sessionId,
        workingMemory: {
          cleared: true,
          clearedAt: new Date().toISOString()
        }
      });

      console.log(`🔍 [DEBUG] Cleared all customer data from memory for session ${sessionId}`);
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
