import { Memory } from "@mastra/memory";

// Create a shared memory instance - storage will be configured at Mastra level
export const sharedMastraMemory = new Memory();

console.log("✅ Created shared Mastra Memory instance");

// Helper functions for memory management using legacy approach
export const createMemoryIds = (sessionId: string, customerId?: string) => {
  const resourceId = customerId || sessionId; // Use customer ID as resource if available
  const threadId = `thread-${sessionId}`;
  
  return {
    resource: resourceId,
    thread: threadId
  };
};

// Store customer data in memory (legacy approach)
export const storeCustomerData = async (memIds: { resource: string; thread: string }, customerData: any) => {
  try {
    // Store customer data in working memory using legacy API
    sharedMastraMemory.set("customerId", customerData.customerId);
    sharedMastraMemory.set("storeName", customerData.storeName);
    sharedMastraMemory.set("email", customerData.email);
    sharedMastraMemory.set("phone", customerData.phone);
    sharedMastraMemory.set("location", customerData.location);
    sharedMastraMemory.set("lastInteraction", new Date().toISOString());
    sharedMastraMemory.set("currentAgent", "customer-identification");
    sharedMastraMemory.set("sessionStart", new Date().toISOString());
    
    console.log(`🔍 [Memory] Stored customer data for resource: ${memIds.resource}, thread: ${memIds.thread}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error storing customer data:`, error);
    return false;
  }
};

// Get customer data from memory (legacy approach)
export const getCustomerData = async (memIds: { resource: string; thread: string }) => {
  try {
    const customerId = sharedMastraMemory.get("customerId");
    const storeName = sharedMastraMemory.get("storeName");
    const email = sharedMastraMemory.get("email");
    const phone = sharedMastraMemory.get("phone");
    const location = sharedMastraMemory.get("location");
    
    if (customerId) {
      return {
        customerId,
        storeName,
        email,
        phone,
        location
      };
    }
    return null;
  } catch (error) {
    console.error(`❌ [Memory] Error getting customer data:`, error);
    return null;
  }
};

// Update current agent in memory (legacy approach)
export const updateCurrentAgent = async (memIds: { resource: string; thread: string }, agentName: string) => {
  try {
    sharedMastraMemory.set("currentAgent", agentName);
    sharedMastraMemory.set("lastInteraction", new Date().toISOString());
    console.log(`🔍 [Memory] Updated current agent to: ${agentName}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error updating current agent:`, error);
    return false;
  }
};

// Clear customer memory (legacy approach)
export const clearCustomerMemory = async (memIds: { resource: string; thread: string }) => {
  try {
    const keysToClear = [
      "customerId", "storeName", "email", "phone", "location",
      "lastInteraction", "currentAgent", "sessionStart"
    ];
    
    for (const key of keysToClear) {
      sharedMastraMemory.set(key, null);
    }
    
    console.log(`🔍 [Memory] Cleared customer memory for resource: ${memIds.resource}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error clearing customer memory:`, error);
    return false;
  }
};

export default sharedMastraMemory;
