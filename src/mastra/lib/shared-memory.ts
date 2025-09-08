import { Memory } from '@mastra/memory'

// Create a proper Mastra Memory instance for shared memory
export const sharedMemory = new Memory()

// Helper functions for session-aware data storage using new Mastra Memory API
export const sessionData = {
  // Store customer data for a specific session
  setCustomerData: async (sessionId: string, customerData: any) => {
    try {
      // Store customer data in working memory with thread-based approach
      const threadId = `customer-session-${sessionId}`
      const workingMemory = {
        customerData,
        timestamp: new Date().toISOString()
      }

      await sharedMemory.updateWorkingMemory({
        threadId,
        resourceId: sessionId,
        workingMemory
      })
      console.log(`🔍 [DEBUG] Stored customer data for session ${sessionId}:`, customerData)
    } catch (error) {
      console.error(`❌ [DEBUG] Error storing customer data for session ${sessionId}:`, error)
    }
  },

  // Get customer data for a specific session
  getCustomerData: async (sessionId: string) => {
    try {
      const threadId = `customer-session-${sessionId}`
      const result = await sharedMemory.getWorkingMemory({
        threadId,
        resourceId: sessionId
      })
      const customerData = result?.customerData
      console.log(`🔍 [DEBUG] Retrieved customer data for session ${sessionId}:`, customerData)
      return customerData
    } catch (error) {
      console.error(`❌ [DEBUG] Error getting customer data for session ${sessionId}:`, error)
      return null
    }
  },

  // Store individual customer field for a specific session
  setCustomerField: async (sessionId: string, field: string, value: any) => {
    try {
      const threadId = `customer-session-${sessionId}`
      const workingMemory = {
        [field]: value,
        timestamp: new Date().toISOString()
      }

      await sharedMemory.updateWorkingMemory({
        threadId,
        resourceId: sessionId,
        workingMemory
      })
      console.log(`🔍 [DEBUG] Stored ${field} for session ${sessionId}: ${value}`)
    } catch (error) {
      console.error(`❌ [DEBUG] Error storing ${field} for session ${sessionId}:`, error)
    }
  },

  // Get individual customer field for a specific session
  getCustomerField: async (sessionId: string, field: string) => {
    try {
      const threadId = `customer-session-${sessionId}`
      const result = await sharedMemory.getWorkingMemory({
        threadId,
        resourceId: sessionId
      })
      const value = result?.[field]
      console.log(`🔍 [DEBUG] Retrieved ${field} for session ${sessionId}: ${value}`)
      return value
    } catch (error) {
      console.error(`❌ [DEBUG] Error getting ${field} for session ${sessionId}:`, error)
      return null
    }
  },
}