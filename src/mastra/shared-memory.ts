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

// Store customer data in memory using proper Mastra Memory API
export const storeCustomerData = async (memIds: { resource: string; thread: string }, customerData: any) => {
  try {
    // Store customer data using simple key-value pairs
    await sharedMastraMemory.set("customerId", customerData.customerId);
    await sharedMastraMemory.set("storeName", customerData.storeName);
    await sharedMastraMemory.set("email", customerData.email);
    await sharedMastraMemory.set("phone", customerData.phone);
    await sharedMastraMemory.set("location", customerData.location);
    await sharedMastraMemory.set("lastInteraction", new Date().toISOString());
    await sharedMastraMemory.set("currentAgent", "customer-identification");
    await sharedMastraMemory.set("sessionStart", new Date().toISOString());
    await sharedMastraMemory.set("resourceId", memIds.resource);
    await sharedMastraMemory.set("threadId", memIds.thread);
    
    console.log(`🔍 [Memory] Stored customer data for resource: ${memIds.resource}, thread: ${memIds.thread}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error storing customer data:`, error);
    return false;
  }
};

// Get customer data from memory using proper Mastra Memory API
export const getCustomerData = async (memIds: { resource: string; thread: string }) => {
  try {
    // Get customer data using simple key-value pairs
    const customerId = await sharedMastraMemory.get("customerId");
    const storeName = await sharedMastraMemory.get("storeName");
    const email = await sharedMastraMemory.get("email");
    const phone = await sharedMastraMemory.get("phone");
    const location = await sharedMastraMemory.get("location");
    const lastInteraction = await sharedMastraMemory.get("lastInteraction");
    const currentAgent = await sharedMastraMemory.get("currentAgent");
    const sessionStart = await sharedMastraMemory.get("sessionStart");
    
    if (customerId) {
      const customerData = {
        customerId,
        storeName,
        email,
        phone,
        location,
        lastInteraction,
        currentAgent,
        sessionStart
      };
      
      console.log(`🔍 [Memory] Retrieved customer data for resource: ${memIds.resource}`);
      return customerData;
    }
    
    console.log(`🔍 [Memory] No customer data found for resource: ${memIds.resource}`);
    return null;
  } catch (error) {
    console.error(`❌ [Memory] Error getting customer data:`, error);
    return null;
  }
};

// Update current agent in memory
export const updateCurrentAgent = async (memIds: { resource: string; thread: string }, agentName: string) => {
  try {
    await sharedMastraMemory.set("currentAgent", agentName);
    await sharedMastraMemory.set("lastInteraction", new Date().toISOString());
    console.log(`🔍 [Memory] Updated current agent to: ${agentName}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error updating current agent:`, error);
    return false;
  }
};

// Clear customer memory
export const clearCustomerMemory = async (memIds: { resource: string; thread: string }) => {
  try {
    const keysToClear = [
      "customerId", "storeName", "email", "phone", "location",
      "lastInteraction", "currentAgent", "sessionStart", "resourceId", "threadId"
    ];
    
    for (const key of keysToClear) {
      await sharedMastraMemory.set(key, null);
    }
    
    console.log(`🔍 [Memory] Cleared customer memory for resource: ${memIds.resource}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error clearing customer memory:`, error);
    return false;
  }
};

export default sharedMastraMemory;
