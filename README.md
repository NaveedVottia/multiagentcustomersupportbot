# [project name]

[![Node.js](https://img.shields.io/badge/Node.js-%3E=20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.13.x-000000)](https://mastra.ai/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## 目次
- [概要](#概要)
- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [インストール手順](#インストール手順)
- [使い方](#使い方)
- [設定項目](#設定項目)
- [デプロイ](#デプロイ)
- [トラブルシューティング](#トラブルシューティング)
- [貢献方法](#貢献方法)
- [ライセンス](#ライセンス)
- [問い合わせ](#問い合わせ)

---

## 概要
[one-sentence summary of what the project does]

本プロジェクトは、「顧客情報の確認 → 製品選択 → 問題分析 → 訪問調整」という修理受付の一連の流れを、単一のチャット体験でスムーズに完結できるよう設計されたAIエージェント・システムです。UI/外部システムは1つのストリームAPIに接続するだけで、内部では必要な担当エージェントが自動で切り替わり、会話と同時にデータも安全に引き継がれます。

---

## 主な機能
- 顧客識別（会社名・電話・メールの検証、あいまい検索フォールバック）
- 製品選択（顧客紐づけ・型式/カテゴリ/保証の提示、ページング）
- 問題分析（症状ヒアリング、既知事例/知識検索、優先度判定）
- 訪問調整（住所確認・スロット提案・予約作成・担当割当・確認メール）
- 緊急時エスカレーション（火災・漏電・漏水等の即時検知）
- 単一ストリーム配信（UIは1つのエンドポイントを見るだけで、内部の役割切替を統合）
- 監査ログ（内部判断や遷移の痕跡を保持可能）

---

## 技術スタック
- 言語/ランタイム: Node.js (>=20), TypeScript
- フレームワーク: Mastra（エージェント/ツール/ストリーム基盤）
- モデル基盤: Amazon Bedrock（Anthropic Claude ファミリー）
- ロギング/トレーシング: Langfuse
- プロセス管理: PM2
- ルール/スキーマ: Zod
- 連携: Zapier Webhook（通知・人手エスカレーションなど）
- データストア: Mastra LibSQL（本番ではRDB/外部DB連携を推奨）

---

## インストール手順
以下はLinux（AWS Lightsail等）での手順例です。

### 1) 依存関係のインストール
```bash
# Node.js 20+ が必要
node -v

# プロジェクト取得（既存サーバーでは済）
git clone <your-repo-url>
cd <your-project-dir>

# 依存パッケージ
npm install
```

### 2) 環境変数ファイルの準備
`server.env`（または `.env`）を作成し、必要なキーを設定します（詳細は[設定項目](#設定項目)）。

```bash
cp server.env server.env.backup  # 既にある場合のバックアップ例
```

### 3) ビルド
```bash
npm run build
```

### 4) サーバー起動（PM2）
```bash
# 初回
npx pm2 start server.js --name mastra-server --update-env

# 再起動
npx pm2 restart mastra-server --update-env

# 状態確認
npx pm2 status
```

---

## 使い方
### 単一ストリームAPI（推奨）
UIや外部サービスは、以下のストリームエンドポイントに`POST`するだけです。会話の流れ（顧客→製品→問題→訪問）は内部で自動制御され、返答は逐次ストリーミングで届きます。

- オーケストレーター（推奨・直接呼び出し）
```
POST http://<YOUR_HOST>/api/agents/repair-workflow-orchestrator/stream
```

- 互換ワークフローURL（サーバー側で上記にリライト）
```
POST http://<YOUR_HOST>/api/agents/repair-workflow-orchestrator/stream
```

### リクエスト例（curl）
```bash
curl -N --http1.1 -sS \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -d '{
    "messages":[
      {"role":"user","content":"ウエルシア 川崎駅前店 support@welcia-k.jp 044-1122-3344"}
    ]
  }' \
  http://<YOUR_HOST>/api/agents/repair-workflow-orchestrator/stream
```

### レスポンス形式（ストリーム）
- `f:{"messageId":"..."}` で開始
- `0:"..."` で本文（複数行・逐次）
- `e:{"finishReason":"...","usage":{...}}` で終了

---

## 設定項目
`server.env`（例）
```dotenv
# 実行
NODE_ENV=production
PORT=80

# AWS / Bedrock
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# Langfuse
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_HOST=https://<your-langfuse-host>

# Zapier
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/<...>/

# ビジネス設定（例）
SESSION_TIMEOUT=1800
SERVICE_TERRITORIES=東京都,神奈川県,千葉県,埼玉県
BUSINESS_HOURS_START=9
BUSINESS_HOURS_END=17
WORKING_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday
```

> 注意: `server.env`は機密情報を含みます。必ず `.gitignore` に含め、公開リポジトリへコミットしないでください。

---

## デプロイ
### AWS Lightsail（例）
- インスタンス: `54.150.79.178`
- ディレクトリ: `/home/ec2-user/sanden-repair-system`
- プロセス: `mastra-server`（PM2）
- ポート: `80`（Nginx/ALB等でのフロントも可）

#### 手順
```bash
# 最新コード取得（またはCI/CDから配置）
git pull

# 依存更新（必要時）
npm install

# ビルド
npm run build

# 再起動
npx pm2 restart mastra-server --update-env

# 稼働確認
curl -s http://<YOUR_HOST>/ | head
```

---

## トラブルシューティング
- 応答が無い/200で無反応:
  - 直接 `/api/agents/repair-workflow-orchestrator/stream` を叩いて確認してください。
- PM2で起動エラー（EACCES: 0.0.0.0:80）:
  - `sudo setcap 'cap_net_bind_service=+ep' $(readlink -f $(which node))` を実施し、再起動。
- モデル/外部連携の失敗:
  - Bedrock/Langfuse/ZapierのキーとURLを再確認。`server.env`の反映後は`--update-env`付きで再起動。

---

## 貢献方法
1. Issue で提案・バグ報告
2. Fork & ブランチ作成（`feature/xxx`）
3. 変更のコミット・プッシュ
4. Pull Request 作成（背景・変更点・動作確認手順を明記）

※ 大きな変更は事前にIssueで相談いただけるとスムーズです。

---

## ライセンス
ISC License（ソースに同梱の `LICENSE` を参照）

---

## 問い合わせ
- 担当: [contact name or team]
- メール: [contact email]
- 会社: [company/organization]

---

### 補足
- 本システムは、ユーザーに対して内部処理（ツール名/関数名/エンドポイント等）を表示せず、自然な会話のみを返します。  
- UIは常に単一ストリームの出力を受け取り、内部での担当切替（顧客→製品→問題→訪問）は自動的に制御されます。
