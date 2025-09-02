import { delegateTo } from "../tools/sanden/orchestrator-tools";

// WORKING ENDPOINT - Simple endpoint handler for testing
export class WorkingEndpoint {
  
  // Handle the orchestrator endpoint directly
  static async handleOrchestratorRequest(messages: any[], options?: any) {
    console.log("🔧 [WorkingEndpoint] Handling orchestrator request");
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content) {
      // Safely extract content - handle both string and object formats
      let content = '';
      if (typeof lastMessage.content === 'string') {
        content = lastMessage.content;
      } else if (lastMessage.content && typeof lastMessage.content === 'object') {
        // Handle content as object (e.g., { text: "message" })
        content = lastMessage.content.text || lastMessage.content.content || JSON.stringify(lastMessage.content);
      } else {
        content = String(lastMessage.content || '');
      }
      
      const contentLower = content.toLowerCase();
      console.log("🔍 [WorkingEndpoint] Processing message:", content.substring(0, 100));
      
      // Check for tool mentions and execute them
      if (contentLower.includes('delegate')) {
        console.log("🎯 [WorkingEndpoint] Executing delegateTo");
        try {
          const result = await delegateTo.execute({ 
            agentId: "customer-identification",
            message: "顧客情報の確認をお願いします。",
            context: {}
          });
          
          console.log("✅ [WorkingEndpoint] delegateTo executed successfully:", result);
          
          return {
            text: `[ツール実行完了: delegateTo]\n${JSON.stringify(result, null, 2)}\n\nツールが正常に実行されました！`,
            type: "text"
          };
          
        } catch (error) {
          console.error("❌ [WorkingEndpoint] delegateTo execution failed:", error);
          return {
            text: `[ツール実行エラー: delegateTo]\n${error instanceof Error ? error.message : String(error)}`,
            type: "text"
          };
        }
      }
    }
    
    // If no tool execution needed, return a default response
    console.log("🔍 [WorkingEndpoint] No tool execution needed, returning default response");
    return {
      text: "こんにちは！サンデン・リテールシステム修理受付AIです。\n\n以下のコマンドが利用できます：\n- 'delegate': エージェント委譲テスト",
      type: "text"
    };
  }
}

console.log("✅ Working endpoint handler created");
