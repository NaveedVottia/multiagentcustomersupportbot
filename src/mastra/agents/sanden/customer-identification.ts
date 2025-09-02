import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools";
import { Langfuse } from "langfuse";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./server.env" });

// Use a fallback prompt initially, will be updated when Langfuse loads
let CUSTOMER_IDENTIFICATION_INSTRUCTIONS = `「顧客識別エージェント」です。顧客の識別と認証を行い、修理サービスメニューを提供します。

【出力形式】
- プレーンテキストのみ。JSON/コード/内部状態/ツール名は出力しない。
- 処理中表記は出力しない（フロント側で表示）。

【顧客識別プロセス】
1. 顧客情報の収集（会社名、メールアドレス、電話番号）
2. データベースでの顧客検索
3. 顧客が見つかった場合：修理サービスメニュー表示
4. 顧客が見つからない場合：新規登録案内

【使用ツール】
- lookupCustomerFromDatabase: 顧客データベース検索
- logCustomerData: 顧客データの記録
- directRepairHistory: 修理履歴の直接取得（委譲なし）
- delegateTo: 他のエージェントへの委譲

【顧客識別フロー】
1. 初回アクセス時：「顧客識別のお手伝いをさせていただきます。以下の情報をお教えください：会社名、メールアドレス、電話番号」
2. 顧客情報収集後、lookupCustomerFromDatabaseツールで検索
3. 顧客が見つかった場合：
   「顧客情報が確認できました。修理サービスメニューをご案内いたします。

   修理サービスメニュー
   1. 顧客の修理履歴を確認
   2. 顧客の登録製品を確認
   3. 修理予約の予約を申し込む
   4. メインメニューに戻る

   番号でお答えください。直接入力も可能です。」
4. 顧客が見つからない場合：
   「申し訳ございませんが、該当する顧客情報が見つかりませんでした。新規登録をご希望の場合は、repair-agentエージェントに委譲いたします。」
   → repair-agentエージェントに委譲

【修理サービスメニュー処理】
- 「1」選択 → directRepairHistoryツールで直接修理履歴を取得して表示
- 「2」選択 → repair-agentエージェントに委譲（製品確認）
- 「3」選択 → repair-schedulingエージェントに委譲
- 「4」選択 → メインメニューに戻る

【重要：委譲の実行】
- メニュー選択時は必ずdelegateToツールを使用する
- 「3」が選択された場合：
  delegateTo({
    "agentId": "repair-scheduling",
    "message": "修理予約の詳細を教えてください",
    "context": { "customerId": "顧客ID" }
  })
- 「2」が選択された場合：
  delegateTo({
    "agentId": "repair-agent",
    "message": "顧客の登録製品を確認してください",
    "context": { "customerId": "顧客ID" }
  })

【修理履歴取得方法】
「1」が選択された場合：
1. directRepairHistoryツールを呼び出し
2. 取得した修理履歴データを美しくフォーマットして表示
3. 各修理記録の詳細（修理ID、日時、問題内容、ステータス、対応者）を含める
4. 現在の状況（未対応、対応中、解決済み）を明確に表示
5. 優先度の高い案件を強調表示

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 丁寧で親切な対応
- 顧客情報の重要性を説明
- セキュリティに配慮した情報収集`;

// Load Langfuse prompt asynchronously
async function loadLangfusePrompt() {
  try {
    const langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });
    
    const promptClient = await langfuse.getPrompt("customer-identification", undefined, { cacheTtlSeconds: 1 });
    if (promptClient?.prompt?.trim()) {
      CUSTOMER_IDENTIFICATION_INSTRUCTIONS = promptClient.prompt.trim();
      console.log(`[Langfuse] ✅ Loaded customer-identification prompt via SDK (v${promptClient.version})`);
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load customer-identification prompt:", error);
    console.log("[Langfuse] Using fallback prompt");
  }
}

// Load the prompt asynchronously
loadLangfusePrompt();

// Debug logging
console.log("🔍 Customer Identification Agent Instructions:");
console.log("📝 Langfuse Instructions Length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);
console.log("📝 Using Langfuse:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS ? "YES" : "NO (empty)");
if (CUSTOMER_IDENTIFICATION_INSTRUCTIONS) {
  console.log("📝 Instructions Preview:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.substring(0, 200) + "...");
}

// Session-aware shared memory that can work with server session management
const createSessionAwareMemory = (sessionId: string) => {
  return {
    _data: new Map(),
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

// Create a custom delegateTo tool that automatically includes customer ID from memory
const enhancedDelegateTo = {
  ...orchestratorTools.delegateTo,
  execute: async (args: any) => {
    const parsed = args.input || args.context || {};
    const agentId = parsed.agentId || "customer-identification";
    const agentContext = parsed.context || {};
    const message = parsed.message || "顧客情報の確認をお願いします。";
    
    // Get customer ID from memory if available
    let customerId = agentContext.customerId;
    if (!customerId) {
      try {
        // Try to get customer ID from shared memory
        customerId = sharedMemory.get("customerId");
        if (customerId) {
          console.log(`🔍 [DEBUG] Found customer ID from shared memory: ${customerId}`);
        }
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from memory:`, error);
      }
    }
    
    // If we have a customer ID, add it to the context
    const enhancedContext = customerId ? { ...agentContext, customerId } : agentContext;
    
    console.log(`🔍 [DEBUG] Delegating to ${agentId} with context:`, JSON.stringify(enhancedContext));
    
    // Call the original delegateTo tool with enhanced context
    return orchestratorTools.delegateTo.execute({
      ...args,
      context: {
        ...parsed,
        context: enhancedContext
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
        sharedMemory.set("customerId", customerData.customerId);
        sharedMemory.set("storeName", customerData.storeName);
        sharedMemory.set("email", customerData.email);
        sharedMemory.set("phone", customerData.phone);
        sharedMemory.set("location", customerData.location);
        sharedMemory.set("lastInteraction", new Date().toISOString());
        sharedMemory.set("currentAgent", "customer-identification");
        sharedMemory.set("sessionStart", new Date().toISOString());
        
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

export const routingAgentCustomerIdentification = new Agent({ 
  name: "customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
  instructions: CUSTOMER_IDENTIFICATION_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...customerTools,
    ...commonTools,
    delegateTo: enhancedDelegateTo,
    lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
    directRepairHistory: directRepairHistoryTool,
  },
  memory: sharedMemory, // Use shared memory
});

console.log("✅ Customer Identification Agent created with instructions length:", CUSTOMER_IDENTIFICATION_INSTRUCTIONS.length);

// Export the shared memory instance for use in other agents
export { sharedMemory };
