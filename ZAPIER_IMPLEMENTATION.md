 # 🚀 Zapier MCP Implementation - Complete Package

## ✅ **Implementation Status: COMPLETE**

Your multi-agent customer support bot now has full Zapier MCP integration with all the requested tools and agents.

---

## 🎯 **What Was Implemented**

### 1. **Zapier MCP Tools** ✅
- All 8 requested tools implemented in `src/mastra/tools/zapier-tools.ts`
- Direct integration with your existing `zapier-mcp.ts` client
- Tools exported and available to all agents

### 2. **Integrated Pre-Approval** ✅
- Pre-approval consent collection integrated into Visit Confirmation agent
- No additional agent needed - keeps your 5-agent workflow
- Customer consent collected before scheduling visits

### 3. **Agent Integration** ✅
- All agents now have access to Zapier tools
- Tools index updated to export Zapier tools
- Server endpoints configured for all agents

---

## 🔧 **Zapier MCP Tool Map (Canonical)**

| Purpose                           | Zapier MCP Tool                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Lookup rows w/ filters            | `google_sheets_lookup_spreadsheet_rows_advanced`                                                             |
| Get many rows / table scans       | `google_sheets_get_many_spreadsheet_rows_advanced`                                                           |
| Create a row                      | `google_sheets_create_spreadsheet_row`                                                                       |
| Update a row                      | `google_sheets_update_spreadsheet_row`                                                                       |
| Find worksheet                    | `google_sheets_find_worksheet`                                                                               |
| Quick add calendar event          | `google_calendar_quick_add_event`                                                                            |
| Slack DM                          | `slack_send_direct_message`                                                                                  |
| Parse QA list from URL           | `ai_by_zapier_extract_content_from_url_beta`                                                                 |

**Google Sheets Contract:** `salesforce_customer_data`
**Worksheets:** `Customers`, `Products`, `Repairs`, `Logs`

---

## 📝 **Final Prompts (Copy-Paste Ready)**

### **0) Shared Config (Langfuse)**

```json
{
  "temperature": 0.2,
  "tools": [
    {
      "name": "final",
      "description": "Return only the final JSON that matches the schema. No extra text.",
      "input_schema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "role": { "type": "string", "enum": ["orchestrator","customer_identification","product_selection","issue_analysis","visit_confirmation","repair_history"] },
          "status": { "type": "string", "enum": ["ok","needs_input","error","completed"] },
          "ui": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "text": { "type": "string" },
              "show_processing": { "type": "boolean" },
              "menu": {
                "type": "array",
                "items": { "type": "object", "additionalProperties": false, "properties": { "number": { "type": "integer" }, "label": { "type": "string" } }, "required": ["number","label"] }
              }
            },
            "required": ["text"]
          },
          "internal": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "sessionId": { "type": "string" },
              "language": { "type": "string", "enum": ["ja","en"] },
              "auth": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "level": { "type": "string", "enum": ["none","basic","otp"] },
                  "otp_state": { "type": "string", "enum": ["none","pending","verified","failed","throttled"] },
                  "otp_channel": { "type": "string", "enum": ["email","sms","none"] },
                  "attempts": { "type": "integer", "minimum": 0, "maximum": 5 }
                },
                "required": ["level","otp_state","otp_channel","attempts"]
              },
              "customer": {
                "type": "object",
                "properties": {
                  "顧客ID": { "type": "string", "maxLength": 64 },
                  "会社名": { "type": "string", "maxLength": 255 },
                  "メールアドレス": { "type": "string", "maxLength": 255 },
                  "電話番号": { "type": "string", "maxLength": 32 },
                  "所在地": { "type": "string", "maxLength": 512 }
                }
              },
              "product": {
                "type": "object",
                "properties": {
                  "製品ID": { "type": "string", "maxLength": 64 },
                  "製品カテゴリ": { "type": "string", "maxLength": 128 },
                  "型式": { "type": "string", "maxLength": 128 },
                  "シリアル番号": { "type": "string", "maxLength": 128 },
                  "保証状況": { "type": "string", "maxLength": 32 }
                }
              },
              "repair": {
                "type": "object",
                "properties": {
                  "修理ID": { "type": "string", "maxLength": 64 },
                  "日時": { "type": "string", "maxLength": 64 },
                  "問題内容": { "type": "string", "maxLength": 4000 },
                  "ステータス": { "type": "string", "enum": ["未対応","対応中","解決済み","予約済み"] },
                  "訪問要否": { "type": "string", "enum": ["要","不要"] },
                  "優先度": { "type": "string", "enum": ["低","中","高","緊急"] },
                  "対応者": { "type": "string", "enum": ["AI","Human"] },
                  "受付チャネル": { "type": "string", "enum": ["chat","email","fax","webform"], "default": "chat" },
                  "estimates": { "type": "object", "properties": { "cost": { "type": "string" }, "time": { "type": "string" } } },
                  "consents": {
                    "type": "object",
                    "properties": {
                      "保証外費用": { "type": "boolean" },
                      "出張判定料": { "type": "boolean" },
                      "手配タイミング": { "type": "boolean" },
                      "プライバシー": { "type": "boolean" },
                      "timestamp": { "type": "string" }
                    }
                  },
                  "visit_contact": {
                    "type": "object",
                    "properties": {
                      "社名": { "type": "string" },
                      "住所": { "type": "string" },
                      "電話": { "type": "string" },
                      "担当者名": { "type": "string" },
                      "打ち合わせ担当者": { "type": "string" }
                    }
                  }
                }
              },
              "booking": {
                "type": "object",
                "properties": {
                  "slot_token": { "type": "string", "maxLength": 64 },
                  "slot_hold_expires_at": { "type": "string", "maxLength": 64 },
                  "slot_mode": { "type": "string", "enum": ["120min","ampm"], "default": "ampm" }
                }
              },
              "action": {
                "type": "string",
                "enum": ["show_history","show_products","new_ticket","reopen_ticket","schedule_visit","schedule_call","troubleshoot","verify_otp","send_otp","resend_otp","enquire_history"]
              },
              "security": {
                "type": "object",
                "properties": { "sanitized": { "type": "boolean" }, "rejected_patterns": { "type": "array", "items": { "type": "string" } } }
              },
              "errors": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } } }
            },
            "required": ["language","auth"]
          }
        },
        "required": ["role","status","ui","internal"]
      }
    }
  ],
  "tool_choice": { "type": "tool", "name": "final" },
  "header_aliases": {
    "repairs": { "修理ID": ["修理ID","Repair ID","受付番号"] },
    "logs":    { "修理ID": ["修理ID","Repair ID","受付番号"] }
  },
  "sanden_hardening": {
    "input_limits": { "company_max": 255, "email_max": 255, "phone_max": 32, "location_max": 512, "issue_max": 4000 },
    "sanitize_rules": ["strip html tags","escape angle brackets","reject script tags","reject sql comment markers -- and /* */"],
    "auth_policy": {
      "basic_keys": ["会社名","メールアドレス","電話番号"],
      "alt_keys": ["会社名","電話番号","所在地"],
      "with_customer_id": "顧客ID + any one of the basic or alt keys",
      "otp": { "digits": 6, "ttl_minutes": 10, "max_attempts": 3, "channels": ["email","sms"] }
    },
    "booking_atomicity": "hold slot with slot_token; confirm in one transaction; release on timeout/decline",
    "fuzzy_matching": "for 型式/シリアル suggest ≤2 close matches and ask 'Did you mean...?'",
    "no_tool_mention_in_ui": true,
    "pii_externalization_policy": "Minimize PII in external messages (prefer IDs)."
  }
}
```

### **1) Orchestrator Agent**

```json
{
  "id": "repair-orchestrator",
  "label": "Repair Orchestrator",
  "provider": "",
  "model": "",
  "temperature": 0.2,
  "instructions": "出力はJSONのみ。finalツールを一度だけ呼び出す。目的: 会話遷移と状態保持。UIは短文＋番号、内部用語やツール名は表示しない。言語: 初回にja/en判定しinternal.languageへ保存。『英語/English』でenへ切替。認証: 会社名/メール/電話(代替: 会社名/電話/所在地)＋OTP。メニュー操作はinternal.auth.level==otpで許可。安全: 火災/感電/漏電/水害などは即時人手案内。データ: Repair IDと修理IDは同義、訪問要否=要/不要、ステータス=未対応/対応中/解決済み/予約済み。フロー: customer_identification→product_selection→issue_analysis→visit_confirmation(ここで事前承諾も取得)。常にrole/status/ui/internalを返す。"
}
```

### **2) Customer Identification Agent**

```json
{
  "id": "routing-agent-customer-identification",
  "label": "Customer Identification",
  "provider": "",
  "model": "",
  "temperature": 0.2,
  "instructions": "出力はJSONのみ/一度だけfinal。会社名・メール・電話(任意:顧客ID、代替:会社名+電話+所在地)を収集。入力を長さ/危険語で検証し再入力要求可。Customersをgoogle_sheets_lookup_spreadsheet_rows_advancedで照合、候補が複数なら番号で選択、0件なら新規登録を提案しgoogle_sheets_create_spreadsheet_rowで作成。OTPを送付し検証(成功でinternal.auth.level=otp)。確定後にメインメニュー提示。常にrole/status/ui/internalを返す。"
}
```

### **3) Product Selection Agent**

```json
{
  "id": "repair-agent-product-selection",
  "label": "Product Selection",
  "provider": "",
  "model": "",
  "temperature": 0.2,
  "instructions": "出力はJSONのみ/一度だけfinal。internal.auth.level==otpが前提。Productsを顧客IDでgoogle_sheets_get_many_spreadsheet_rows_advanced検索し、製品ID|顧客ID|カテゴリ|型式|シリアル|保証状況を番号付きで提示。未発見や曖昧時は型式/シリアルを質問し近似2件を提示。新規は重複確認後google_sheets_create_spreadsheet_rowで作成。次アクション: 1履歴 2修理ボット 3修理予約 4電話相談。role/status/ui/internalを返す。"
}
```

### **4) Issue Analysis Agent**

```json
{
  "id": "repair-qa-agent-issue-analysis",
  "label": "Issue Analysis",
  "provider": "",
  "model": "",
  "temperature": 0.2,
  "instructions": "出力はJSONのみ/一度だけfinal。internal.auth.level==otp必須。症状を聞き、3〜4手順の簡潔なトラブルシュートを番号で提示。必要に応じてai_by_zapier_extract_content_from_url_betaでKB参照。概算費用/時間はinternal.repair.estimatesへ。解決→internal.repair.対応者='AI'、Logsへgoogle_sheets_create_spreadsheet_row(Status='解決済み', Source='chat', Rawに要約)しstatus='completed'。未解決→visit_confirmationへ誘導。role/status/ui/internalを返す。"
}
```

### **5) Visit Confirmation Agent (includes Pre-Approval)**

```json
{
  "id": "repair-visit-confirmation-agent",
  "label": "Visit Confirmation (with Pre-Approval)",
  "provider": "",
  "model": "",
  "temperature": 0.2,
  "instructions": "出力はJSONのみ/一度だけfinal。internal.auth.level==otpが前提。このエージェントは事前承諾(同意4項目)を内包する。A) 同意: はい/いいえで取得。全同意ならinternal.repair.consents.*=true＋timestamp、Logsにgoogle_sheets_create_spreadsheet_row(Status='同意取得', Raw=consents)。不同意/無応答はメインへ戻す。B) 訪問先情報(社名/住所/電話/担当者名/打ち合わせ担当者)と希望時間帯(AM/PM or 2時間枠)を収集しinternal.repair.visit_contactとinternal.repair.日時へ格納。C) 確定時に 1)Repairsへgoogle_sheets_create_spreadsheet_row(Repair ID生成, 日時, 製品ID, 顧客ID, 問題内容, ステータス='予約済み', 訪問要否='要', 優先度, 対応者='Human')、2)Logsへgoogle_sheets_create_spreadsheet_row(Status='予約済み', Raw=最終JSON)、3)google_calendar_quick_add_eventで予定作成(返却IDをLogs.Rawへ)、4)slack_send_direct_messageで通知(返却IDをLogs.Rawへ)。完了後、internal.repair.対応者='Human' / 訪問要否='要' / status='completed'。UIは短文と受付番号のみ。"
}
```

---

## 🗄️ **Database Alignment**

### **Customers Sheet**
```
顧客ID | 会社名 | メールアドレス | 電話番号 | 所在地
```

### **Products Sheet**
```
製品ID | 顧客ID | 製品カテゴリ | 型式 | シリアル番号 | 保証状況
```

### **Repairs Sheet**
```
Repair ID | 日時 | 製品ID | 顧客ID | 問題内容 | ステータス | 訪問要否 | 優先度 | 対応者
```
*Header aliases automatically map `Repair ID` ⇄ `修理ID`*

### **Logs Sheet (Recommended)**
```
Timestamp | Repair ID | Status | Customer ID | Product ID | 担当者 (Handler) | Issue | Source | Raw
```

---

## 🚀 **Quick Start Checklist**

- [x] **Zapier MCP tools implemented** in `src/mastra/tools/zapier-tools.ts`
- [x] **Pre-Approval integrated** into Visit Confirmation agent
- [x] **Server endpoints configured** for all agents
- [x] **Tools exported** in tools index

**Next Steps:**
1. **Set environment variables** for Zapier MCP & Langfuse
2. **Upload the prompts above** to your Langfuse instance
3. **Test the endpoints** with the integrated workflow
4. **Verify Google Sheets integration** works correctly

---

## 🔍 **Testing Endpoints**

```bash
# Test main orchestrator (includes all agents with integrated pre-approval)
curl -X POST http://localhost:3000/api/agents/repair-workflow-orchestrator/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello, I need help with a coffee machine repair"}]}'
```

---

## 🎉 **You're All Set!**

Your multi-agent customer support bot now has:
- ✅ **Full Zapier MCP integration** with all 8 tools
- ✅ **Integrated pre-approval workflow** (no extra agent needed)
- ✅ **Complete 5-agent workflow** from customer ID to visit confirmation
- ✅ **Real-time data operations** via Google Sheets
- ✅ **Calendar integration** for scheduling
- ✅ **Slack notifications** for human escalation

The system now handles the complete repair workflow with customer consent collection integrated into the Visit Confirmation agent, maintaining your existing 5-agent architecture!
