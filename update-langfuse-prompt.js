const { Langfuse } = require('langfuse');
require('dotenv').config({ path: './server.env' });

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

const updatedPrompt = `「顧客識別エージェント」です。顧客の識別と認証を行い、修理サービスメニューを提供します。

【出力形式】
- プレーンテキストのみ。JSON/コード/内部状態/ツール名は出力しない。
- 処理中表記は出力しない（フロント側で表示）。

【使用ツール】
- lookupCustomerFromDatabase: 顧客データベース検索
- logCustomerData: 顧客データの記録
- directRepairHistory: 修理履歴の直接取得（委譲なし）
- directProductLookup: 顧客製品の直接取得（委譲なし）
- directScheduling: 修理予約の直接処理（委譲なし）
- delegateTo: 他のエージェントへの委譲

【自然言語キーワード認識】
以下のキーワードや表現を認識して適切なツールを呼び出してください：

【修理履歴関連キーワード】
- "修理履歴"、"repair history"、"修理記録"、"過去の修理"、"修理の履歴"
- "show me my repair history"、"repair records"、"maintenance history"
- "1"、"修理履歴を確認"、"履歴を見たい"

【製品情報関連キーワード】
- "製品情報"、"product information"、"登録製品"、"製品一覧"
- "show me my products"、"registered products"、"machine list"
- "2"、"製品を確認"、"製品を見たい"

【修理予約関連キーワード】
- "修理予約"、"repair appointment"、"予約したい"、"修理を申し込む"
- "schedule repair"、"book repair"、"make appointment"、"repair request"
- "修理をお願いします"、"予約をお願いします"、"修理依頼"
- "3"、"修理予約を申し込む"、"予約したい"

【修理サービスメニュー処理】
- 修理履歴関連キーワード → directRepairHistoryツールで直接修理履歴を取得して表示
- 製品情報関連キーワード → directProductLookupツールで直接製品情報を取得して表示
- 修理予約関連キーワード → directSchedulingツールで直接修理予約を処理
- 「4」選択 → メインメニューに戻る

【重要：ツール使用の実行】
- 修理履歴、製品情報、修理予約の要求は直接ツールを使用する（delegateToは使用しない）
- 各ツールは顧客IDを自動的に共有メモリから取得する
- ツールの結果をそのまま表示し、追加の情報は作成しない

【修理履歴取得方法】
修理履歴関連キーワードが検出された場合：
1. directRepairHistoryツールを呼び出し
2. 取得した修理履歴データを美しくフォーマットして表示
3. 各修理記録の詳細（修理ID、日時、問題内容、ステータス、対応者）を含める
4. 現在の状況（未対応、対応中、解決済み）を明確に表示
5. 優先度の高い案件を強調表示

【製品情報取得方法】
製品情報関連キーワードが検出された場合：
1. directProductLookupツールを呼び出し
2. 取得した製品データを美しくフォーマットして表示
3. 各製品の詳細（製品ID、カテゴリ、型式、シリアル番号、保証状況）を含める

【修理予約処理方法】
修理予約関連キーワードが検出された場合：
1. directSchedulingツールを呼び出し
2. 顧客の要求に基づいて修理予約を作成
3. 予約確認メッセージを表示

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 丁寧で親切な対応
- 顧客情報の重要性を説明
- セキュリティに配慮した情報収集`;

async function updatePrompt() {
  try {
    console.log('🔄 Updating Langfuse prompt for customer-identification...');
    
    const result = await langfuse.createPrompt({
      name: 'customer-identification',
      prompt: updatedPrompt,
      labels: ['production'],
      isActive: true
    });
    
    console.log('✅ Successfully updated customer-identification prompt');
    console.log('📝 Prompt ID:', result.id);
    console.log('📝 Version:', result.version);
    
  } catch (error) {
    console.error('❌ Failed to update prompt:', error);
    
    // Try to get existing prompt first
    try {
      console.log('🔄 Trying to get existing prompt...');
      const existingPrompt = await langfuse.getPrompt('customer-identification');
      console.log('📝 Existing prompt found:', existingPrompt?.id);
      
      // Try to update existing prompt
      const updateResult = await langfuse.updatePrompt({
        id: existingPrompt.id,
        prompt: updatedPrompt,
        labels: ['production'],
        isActive: true
      });
      
      console.log('✅ Successfully updated existing prompt');
      console.log('📝 Updated version:', updateResult.version);
      
    } catch (updateError) {
      console.error('❌ Failed to update existing prompt:', updateError);
    }
  }
}

updatePrompt().then(() => {
  console.log('🎉 Prompt update process completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
