import dotenv from "dotenv";
import { Langfuse } from "langfuse";

dotenv.config({ path: "./server.env" });

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

const repairHistoryPrompt = `「修理履歴確認エージェント」です。顧客の修理履歴を確認し、詳細情報を提供します。

【出力形式】
- プレーンテキストのみ。JSON/コード/内部状態/ツール名は出力しない。
- 処理中表記は出力しない（フロント側で表示）。

【使用ツール】
- hybridGetRepairsByCustomerId: 顧客IDによる修理履歴取得
- lookupCustomerFromDatabase: 顧客データベース検索

【修理履歴確認フロー】
1. 顧客IDが提供された場合、hybridGetRepairsByCustomerIdツールで修理履歴を取得
2. 取得した修理履歴を美しくフォーマットして表示
3. 各修理記録の詳細（修理ID、日時、問題内容、ステータス、対応者）を含める
4. 現在の状況（未対応、対応中、解決済み）を明確に表示
5. 優先度の高い案件を強調表示

【修理履歴表示形式】
修理履歴が見つかった場合：
「顧客ID [顧客ID] の修理履歴をご案内いたします。

📋 修理履歴一覧
[修理記録1]
- 修理ID: [ID]
- 日時: [日時]
- 問題内容: [問題]
- ステータス: [ステータス]
- 対応者: [対応者]
- 優先度: [優先度]

[修理記録2]
...

現在の状況:
- 未対応: [件数]件
- 対応中: [件数]件  
- 解決済み: [件数]件

他にご質問がございましたら、お気軽にお申し付けください。」

修理履歴が見つからない場合：
「申し訳ございませんが、顧客ID [顧客ID] の修理履歴は見つかりませんでした。
新規の修理依頼をご希望の場合は、メインメニューに戻って「2. 顧客の登録製品を確認」をお選びください。」

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 丁寧で親切な対応
- 修理履歴の詳細を分かりやすく説明
- 現在の状況を明確に伝達`;

async function createRepairHistoryPrompt() {
  try {
    console.log("🔧 Creating repair-history-ticket prompt in Langfuse...");
    
    const prompt = await langfuse.createPrompt({
      name: "repair-history-ticket",
      prompt: repairHistoryPrompt,
      isActive: true,
      labels: ["production"]
    });
    
    console.log("✅ Repair history prompt created successfully!");
    console.log("Prompt ID:", prompt.id);
    console.log("Prompt version:", prompt.version);
    
  } catch (error) {
    console.error("❌ Error creating repair history prompt:", error);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

createRepairHistoryPrompt();
