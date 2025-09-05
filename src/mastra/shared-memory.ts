import { Memory } from "@mastra/memory";

// Working memory template for comprehensive customer profiles using exact database column names
const WORKING_MEMORY_TEMPLATE = `# Customer Profile
- **顧客ID**: {{customerId}}
- **会社名**: {{storeName}}
- **メールアドレス**: {{email}}
- **電話番号**: {{phone}}
- **所在地**: {{location}}
- **製品ID**: {{productId}}
- **製品カテゴリ**: {{productCategory}}
- **型式**: {{model}}
- **シリアル番号**: {{serialNumber}}
- **保証状況**: {{warrantyStatus}}
- **Repair ID**: {{repairId}}
- **日時**: {{repairDate}}
- **問題内容**: {{issueDescription}}
- **ステータス**: {{status}}
- **訪問要否**: {{visitRequired}}
- **優先度**: {{priority}}
- **対応者**: {{handler}}
- **備考**: {{notes}}
- **Last Interaction**: {{lastInteraction}}
- **Current Agent**: {{currentAgent}}
- **Session Start**: {{sessionStart}}`;

// Create a shared Mastra Memory instance for all agents
export const sharedMastraMemory = new Memory();

// Helper to build a session-scoped key for Mastra Memory
function sessionKey(sessionId: string, key: string): string {
  return `customer.${sessionId}.${key}`;
}

// Helper function to store customer data in Mastra memory
export async function storeCustomerData(customerData: any, threadId: string = "default-thread", resourceId: string = "default-resource") {
  try {
    const customerProfile = `# Customer Profile
- **顧客ID**: ${customerData.customerId || 'N/A'}
- **会社名**: ${customerData.storeName || 'N/A'}
- **メールアドレス**: ${customerData.email || 'N/A'}
- **電話番号**: ${customerData.phone || 'N/A'}
- **所在地**: ${customerData.location || 'N/A'}
- **製品ID**: ${customerData.productId || 'N/A'}
- **製品カテゴリ**: ${customerData.productCategory || 'N/A'}
- **型式**: ${customerData.model || 'N/A'}
- **シリアル番号**: ${customerData.serialNumber || 'N/A'}
- **保証状況**: ${customerData.warrantyStatus || 'N/A'}
- **Repair ID**: ${customerData.repairId || 'N/A'}
- **日時**: ${customerData.repairDate || 'N/A'}
- **問題内容**: ${customerData.issueDescription || 'N/A'}
- **ステータス**: ${customerData.status || 'N/A'}
- **訪問要否**: ${customerData.visitRequired || 'N/A'}
- **優先度**: ${customerData.priority || 'N/A'}
- **対応者**: ${customerData.handler || 'N/A'}
- **備考**: ${customerData.notes || 'N/A'}
- **Last Interaction**: ${new Date().toISOString()}
- **Current Agent**: customer-identification
- **Session Start**: ${new Date().toISOString()}`;
    
    // Store a session-scoped structured set of fields for reliable cross-agent access
    const sid = threadId;
    sharedMastraMemory.set(sessionKey(sid, "customerId"), customerData.customerId || "");
    sharedMastraMemory.set(sessionKey(sid, "storeName"), customerData.storeName || "");
    sharedMastraMemory.set(sessionKey(sid, "email"), customerData.email || "");
    sharedMastraMemory.set(sessionKey(sid, "phone"), customerData.phone || "");
    sharedMastraMemory.set(sessionKey(sid, "location"), customerData.location || "");
    sharedMastraMemory.set(sessionKey(sid, "productId"), customerData.productId || "");
    sharedMastraMemory.set(sessionKey(sid, "productCategory"), customerData.productCategory || "");
    sharedMastraMemory.set(sessionKey(sid, "model"), customerData.model || "");
    sharedMastraMemory.set(sessionKey(sid, "serialNumber"), customerData.serialNumber || "");
    sharedMastraMemory.set(sessionKey(sid, "warrantyStatus"), customerData.warrantyStatus || "");
    sharedMastraMemory.set(sessionKey(sid, "repairId"), customerData.repairId || "");
    sharedMastraMemory.set(sessionKey(sid, "repairDate"), customerData.repairDate || "");
    sharedMastraMemory.set(sessionKey(sid, "issueDescription"), customerData.issueDescription || "");
    sharedMastraMemory.set(sessionKey(sid, "status"), customerData.status || "");
    sharedMastraMemory.set(sessionKey(sid, "visitRequired"), customerData.visitRequired || "");
    sharedMastraMemory.set(sessionKey(sid, "priority"), customerData.priority || "");
    sharedMastraMemory.set(sessionKey(sid, "handler"), customerData.handler || "");
    sharedMastraMemory.set(sessionKey(sid, "notes"), customerData.notes || "");
    sharedMastraMemory.set(sessionKey(sid, "lastInteraction"), new Date().toISOString());
    sharedMastraMemory.set(sessionKey(sid, "currentAgent"), "customer-identification");
    sharedMastraMemory.set(sessionKey(sid, "sessionStart"), new Date().toISOString());

    // Also store a human-readable profile string under a session-scoped key
    sharedMastraMemory.set(`customer-profile:${sid}`, customerProfile);
    
    console.log(`🔍 [DEBUG] Stored customer data in shared Mastra memory:`, customerProfile);
    return true;
  } catch (error) {
    console.error(`❌ [DEBUG] Error storing customer data in shared Mastra memory:`, error);
    return false;
  }
}

// Helper function to get customer data from Mastra memory
export async function getCustomerData(threadId: string = "default-thread", resourceId: string = "default-resource"): Promise<string | null> {
  try {
    // Try session-scoped human-readable profile first
    const customerProfile = sharedMastraMemory.get(`customer-profile:${threadId}`);
    if (customerProfile) {
      console.log(`🔍 [DEBUG] Retrieved customer data from shared Mastra memory:`, customerProfile);
      return customerProfile;
    }

    // If not present, synthesize a profile from session-scoped structured fields
    const customerId = sharedMastraMemory.get(sessionKey(threadId, "customerId"));
    if (customerId) {
      const profile = `# Customer Profile\n- **顧客ID**: ${customerId}\n- **会社名**: ${sharedMastraMemory.get(sessionKey(threadId, "storeName")) || ''}\n- **メールアドレス**: ${sharedMastraMemory.get(sessionKey(threadId, "email")) || ''}\n- **電話番号**: ${sharedMastraMemory.get(sessionKey(threadId, "phone")) || ''}\n- **所在地**: ${sharedMastraMemory.get(sessionKey(threadId, "location")) || ''}`;
      console.log(`🔍 [DEBUG] Synthesized customer profile for thread: ${threadId}`);
      return profile;
    }

    console.log(`🔍 [DEBUG] No customer data found for thread: ${threadId}`);
    return null;
  } catch (error) {
    console.error(`❌ [DEBUG] Error getting customer data from shared Mastra memory:`, error);
    return null;
  }
}

// Convenience helper to get session-scoped customerId
export function getSessionCustomerId(threadId: string = "default-thread"): string | null {
  try {
    const id = sharedMastraMemory.get(sessionKey(threadId, "customerId"));
    return id || null;
  } catch {
    return null;
  }
}
