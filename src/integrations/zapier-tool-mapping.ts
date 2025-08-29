/**
 * Zapier Tool Mapping for Sanden Repair System
 * This file maps the exact Zapier MCP tool names to their usage in prompts
 */

// ============================================================================
// AVAILABLE ZAPIER MCP TOOLS (from your configuration)
// ============================================================================

export const ZAPIER_TOOLS = {
  // Google Sheets Tools - Using the exact names from your Zapier MCP
  GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED: "google_sheets_lookup_spreadsheet_rows_advanced",
  GOOGLE_SHEETS_GET_MANY_ROWS_ADVANCED: "google_sheets_get_many_spreadsheet_rows_advanced",
  GOOGLE_SHEETS_CREATE_ROW: "google_sheets_create_spreadsheet_row",
  GOOGLE_SHEETS_UPDATE_ROW: "google_sheets_update_spreadsheet_row",
  GOOGLE_SHEETS_UPDATE_ROW_S: "google_sheets_update_spreadsheet_row_s",
  GOOGLE_SHEETS_CREATE_ROW_AT_TOP: "google_sheets_create_spreadsheet_row_at_top",
  GOOGLE_SHEETS_LOOKUP_ROW: "google_sheets_lookup_spreadsheet_row",
  GOOGLE_SHEETS_FIND_WORKSHEET: "google_sheets_find_worksheet",
  GOOGLE_SHEETS_GET_DATA_RANGE: "google_sheets_get_data_range",
  
  // Google Calendar Tools
  GOOGLE_CALENDAR_QUICK_ADD: "google_calendar_quick_add_event",
  
  // AI Tools
  AI_EXTRACT_CONTENT: "ai_by_zapier_extract_content_from_url_beta",
  
  // MCP Management Tools
  ADD_TOOLS: "add_tools",
  EDIT_TOOLS: "edit_tools"
} as const;

// ============================================================================
// TOOL USAGE IN PROMPTS - EXACT MAPPING
// ============================================================================

export const PROMPT_TOOL_MAPPING = {
  // Customer Identification Prompt (customer-identification-prompt.txt)
  CUSTOMER_IDENTIFICATION: {
    prompt_file: "src/mastra/prompts/customer-identification-prompt.txt",
    line_reference: "Line 35: lookupCustomerByDetails を実行（phone, email, companyName）",
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED,
    tool_purpose: "顧客照合 - 3項目のうち1つでも一致すれば成功",
    expected_input: {
      instructions: "lookup customer by phone, email, and company name",
      worksheet: "Customers",
      lookup_key: "電話番号", // or "メールアドレス" or "会社名"
      lookup_value: "user input value"
    },
    expected_return: {
      success: "3項目のうち1つでも一致した場合",
      data: [
        {
          "顧客ID": "CUST003",
          "会社名": "ウエルシア 川崎駅前店",
          "メールアドレス": "support@welcia-k.jp",
          "電話番号": "044-1122-3344",
          "所在地": "神奈川県・川崎"
        }
      ]
    },
    fallback_action: "新規顧客として登録しますか？"
  },

  // Repair Agent Prompt (repair-agent-prompt.txt)
  REPAIR_AGENT: {
    prompt_file: "src/mastra/prompts/repair-agent-prompt.txt",
    line_reference: "Line 40: getCustomerHistory（引数: 顧客ID）で履歴取得",
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED,
    tool_purpose: "修理履歴取得 - 顧客IDで修理履歴を検索",
    expected_input: {
      instructions: "lookup repair history by customer ID",
      worksheet: "repairs",
      lookup_key: "顧客ID",
      lookup_value: "CUST003"
    },
    expected_return: {
      success: "修理履歴が見つかった場合",
      data: [
        {
          "Repair ID": "REP101",
          "日時": "2025-08-02 00:00",
          "製品ID": "PROD003",
          "顧客ID": "CUST003",
          "問題内容": "コインが詰まる",
          "ステータス": "未対応",
          "訪問要否": "要",
          "優先度": "中",
          "対応者": "渡辺"
        }
      ]
    },
    display_format: "テーブル形式で表示"
  },

  PRODUCT_LOOKUP: {
    prompt_file: "src/mastra/prompts/repair-agent-prompt.txt",
    line_reference: "Line 45: getProductsByCustomerId（引数: 顧客ID）で製品取得",
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED,
    tool_purpose: "製品一覧取得 - 顧客IDで登録製品を検索",
    expected_input: {
      instructions: "lookup products by customer ID",
      worksheet: "Products",
      lookup_key: "顧客ID",
      lookup_value: "CUST003"
    },
    expected_return: {
      success: "製品が見つかった場合",
      data: [
        {
          "製品ID": "PROD003",
          "顧客ID": "CUST003",
          "製品カテゴリ": "冷蔵ショーケース",
          "型式": "RS-1020K",
          "シリアル番号": "SN102077",
          "保証状況": "有効"
        }
      ]
    },
    display_format: "テーブル形式で表示"
  },

  // Repair Scheduling Prompt (repair-scheduling-prompt.txt)
  REPAIR_SCHEDULING: {
    prompt_file: "src/mastra/prompts/repair-scheduling-prompt.txt",
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_CREATE_ROW_AT_TOP,
    tool_purpose: "修理予約 - LOGSシートに新しい行を作成（google_sheets_create_spreadsheet_row_at_top）",
    expected_input: {
      customerId: "顧客ID",
      contactName: "担当者名",
      phone: "電話番号",
      preferredDate: "希望日時",
      machine: "対象機器",
      companyName: "会社名",
      email: "メールアドレス"
    },
        expected_return: {
      success: "予約が完了した場合",
      repairId: "修理ID",
      data: "LOGSシートの記録データ",
      note: "LOGSシートへの記録完了メッセージ"
    },
    fallback_action: "予約の記録に失敗しました。再度お試しください。"
  }
};

// ============================================================================
// DATABASE SCHEMA MAPPING
// ============================================================================

export const DATABASE_SCHEMA = {
  CUSTOMERS: {
    worksheet: "Customers",
    columns: {
      "顧客ID": "COL$A",
      "会社名": "COL$B", 
      "メールアドレス": "COL$C",
      "電話番号": "COL$D",
      "所在地": "COL$E"
    },
    sample_data: {
      "顧客ID": "CUST003",
      "会社名": "ウエルシア 川崎駅前店",
      "メールアドレス": "support@welcia-k.jp",
      "電話番号": "044-1122-3344",
      "所在地": "神奈川県・川崎"
    }
  },

  PRODUCTS: {
    worksheet: "Products",
    columns: {
      "製品ID": "COL$A",
      "顧客ID": "COL$B",
      "製品カテゴリ": "COL$C",
      "型式": "COL$D",
      "シリアル番号": "COL$E",
      "保証状況": "COL$F"
    },
    sample_data: {
      "製品ID": "PROD003",
      "顧客ID": "CUST003",
      "製品カテゴリ": "冷蔵ショーケース",
      "型式": "RS-1020K",
      "シリアル番号": "SN102077",
      "保証状況": "有効"
    }
  },

  REPAIRS: {
    worksheet: "repairs",
    columns: {
      "Repair ID": "COL$A",
      "日時": "COL$B",
      "製品ID": "COL$C",
      "顧客ID": "COL$D",
      "問題内容": "COL$E",
      "ステータス": "COL$F",
      "訪問要否": "COL$G",
      "優先度": "COL$H",
      "対応者": "COL$I"
    },
    sample_data: {
      "Repair ID": "REP101",
      "日時": "2025-08-02 00:00",
      "製品ID": "PROD003",
      "顧客ID": "CUST003",
      "問題内容": "コインが詰まる",
      "ステータス": "未対応",
      "訪問要否": "要",
      "優先度": "中",
      "対応者": "渡辺"
    }
  },

  LOGS: {
    worksheet: "Logs",
    columns: {
      "顧客ID": "COL$A",
      "会社名": "COL$B",
      "メールアドレス": "COL$C",
      "電話番号": "COL$D",
      "所在地": "COL$E",
      "製品ID": "COL$F",
      "製品カテゴリ": "COL$G",
      "型式": "COL$H",
      "シリアル番号": "COL$I",
      "保証状況": "COL$J",
      "Repair ID": "COL$K",
      "日時": "COL$L",
      "問題内容": "COL$M",
      "ステータス": "COL$N",
      "訪問要否": "COL$O",
      "優先度": "COL$P",
      "対応者": "COL$Q",
      "備考": "COL$R",
      "Name": "COL$S",
      "phone": "COL$T",
      "date": "COL$U",
      "machine": "COL$V"
    }
  }
};

// ============================================================================
// TOOL IMPLEMENTATION FUNCTIONS
// ============================================================================

/**
 * Customer Lookup Tool - Used in customer-identification-prompt.txt
 * NEW LOGIC: Collects all 3 details first, then looks for ANY 1 match
 */
export async function lookupCustomerByDetails(phone: string, email: string, companyName: string) {
  const { zapierMcp } = await import("./zapier-mcp.js");
  
  console.log("🔍 Customer lookup with new logic - looking for ANY 1 match from 3 details");
  console.log("📊 Input details:", { phone, email, companyName });
  
  // Try multiple lookup strategies - ANY 1 match is sufficient
  const strategies = [
    { key: "電話番号", value: phone, priority: 1 },
    { key: "メールアドレス", value: email, priority: 2 },
    { key: "会社名", value: companyName, priority: 3 }
  ];

  // Try each strategy and return on first success
  for (const strategy of strategies) {
    if (!strategy.value || strategy.value.trim() === "") {
      console.log(`⏭️ Skipping ${strategy.key} - no value provided`);
      continue;
    }
    
    try {
      console.log(`🔍 Trying lookup by ${strategy.key}: ${strategy.value}`);
      
      const result = await zapierMcp.callTool(ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED, {
        instructions: `lookup customer by ${strategy.key}`,
        worksheet: "Customers",
        lookup_key: strategy.key,
        lookup_value: strategy.value.trim()
      });
      
      if (result && result.rows && result.rows.length > 0) {
        console.log(`✅ SUCCESS: Found customer by ${strategy.key}`);
        console.log(`📋 Customer data:`, result.rows[0]);
        
        return {
          success: true,
          data: result.rows,
          matchedBy: strategy.key,
          matchedValue: strategy.value,
          matchCount: result.rows.length,
          message: `${strategy.key}で顧客が見つかりました`
        };
      } else {
        console.log(`❌ No match found for ${strategy.key}: ${strategy.value}`);
      }
    } catch (error) {
      console.error(`❌ Lookup failed for ${strategy.key}:`, error);
    }
  }
  
  console.log("❌ No matches found for any of the 3 details");
  return { 
    success: false, 
    data: null, 
    message: "3項目すべてで照合に失敗しました",
    attemptedStrategies: strategies.map(s => s.key)
  };
}

/**
 * Customer History Tool - Used in repair-agent-prompt.txt
 */
export async function getCustomerHistory(customerId: string) {
  const { zapierMcp } = await import("./zapier-mcp.js");
  
  try {
    const result = await zapierMcp.callTool(ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED, {
      instructions: "lookup repair history by customer ID",
      worksheet: "repairs",
      lookup_key: "顧客ID",
      lookup_value: customerId
    });
    
    return {
      success: true,
      data: result.rows || [],
      customerId
    };
  } catch (error) {
    console.error("Failed to get customer history:", error);
    return { success: false, data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Products by Customer Tool - Used in repair-agent-prompt.txt
 */
export async function getProductsByCustomerId(customerId: string) {
  const { zapierMcp } = await import("./zapier-mcp.js");
  
  try {
    const result = await zapierMcp.callTool(ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED, {
      instructions: "lookup products by customer ID",
      worksheet: "Products",
      lookup_key: "顧客ID",
      lookup_value: customerId
    });
    
    return {
      success: true,
      data: result.rows || [],
      customerId
    };
  } catch (error) {
    console.error("Failed to get products by customer ID:", error);
    return { success: false, data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Schedule Repair Tool - Used in repair-scheduling-prompt.txt
 */
export async function scheduleRepairVisit(customerId: string, productId: string, issue: string, preferredDate?: string) {
  const { zapierMcp } = await import("./zapier-mcp.js");
  
  try {
    const eventText = `Repair visit for ${customerId} - Product ${productId} - Issue: ${issue}`;
    
    const result = await zapierMcp.callTool(ZAPIER_TOOLS.GOOGLE_CALENDAR_QUICK_ADD, {
      instructions: "Schedule repair visit appointment",
      text: eventText
    });
    
    return {
      success: true,
      event: result,
      customerId,
      productId,
      issue
    };
  } catch (error) {
    console.error("Failed to schedule repair visit:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Create Log Entry Tool - Used in repair-scheduling-prompt.txt
 * This is the FINAL tool that posts to the LOGS sheet using google_sheets_create_spreadsheet_row_at_top
 */
export async function createLogEntry(
  customerId: string,
  contactName: string,
  phone: string,
  preferredDate: string,
  machine: string,
  companyName: string,
  email: string
) {
  const { zapierMcp } = await import("./zapier-mcp.js");
  
  try {
    console.log("📝 Creating log entry for customer:", customerId);
    console.log("🔧 Repair scheduling data:", { contactName, phone, preferredDate, machine });
    
    // Create a new entry in the LOGS sheet using google_sheets_create_spreadsheet_row_at_top
    // This is the FINAL endpoint where UI POSTs repair scheduling data
    const result = await zapierMcp.callTool(ZAPIER_TOOLS.GOOGLE_SHEETS_CREATE_ROW_AT_TOP, {
      instructions: "Create new repair scheduling log entry in LOGS sheet at the top",
      worksheet: "Logs",
      // Use EXACT column names from database.txt as specified by user
      "顧客ID": customerId,
      "会社名": companyName,
      "メールアドレス": email,
      "電話番号": phone,
      "所在地": "神奈川県・川崎", // This should come from customer profile
      "製品ID": "PROD003", // This should come from product selection
      "製品カテゴリ": "冷蔵ショーケース", // This should come from product selection
      "型式": "RS-1020K", // This should come from product selection
      "シリアル番号": "SN102077", // This should come from product selection
      "保証状況": "有効", // This should come from product selection
      "Repair ID": `REP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      "日時": preferredDate,
      "問題内容": `訪問修理予約 - ${machine}`,
      "ステータス": "未対応",
      "訪問要否": "要",
      "優先度": "中",
      "対応者": "AI",
      "備考": `オンラインUI経由でスケジュール - ${new Date().toISOString()}`,
      "Name": contactName,
      "phone": phone,
      "date": preferredDate,
      "machine": machine
    });
    
    if (result && result.success) {
      console.log("✅ Log entry created successfully in LOGS sheet using google_sheets_create_spreadsheet_row_at_top");
      return {
        success: true,
        message: "訪問修理の予約が完了いたしました。詳細が記録されました。",
        repairId: result.repairId || `REP_${Date.now()}`,
        data: result,
        note: "This data was posted to the LOGS sheet using google_sheets_create_spreadsheet_row_at_top - the final endpoint for repair scheduling"
      };
    } else {
      console.error("❌ Failed to create log entry:", result);
      return {
        success: false,
        message: "予約の記録に失敗しました",
        error: result?.error || "Unknown error"
      };
    }
  } catch (error) {
    console.error("❌ Failed to create log entry:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// ============================================================================
// PROMPT INTEGRATION GUIDE
// ============================================================================

export const PROMPT_INTEGRATION_GUIDE = {
  CUSTOMER_IDENTIFICATION_PROMPT: {
    file: "src/mastra/prompts/customer-identification-prompt.txt",
    changes_needed: [
      "Line 35: Replace 'getCustomerByDetails' with 'lookupCustomerByDetails'",
      "Add tool description: 'lookupCustomerByDetails: 顧客照合（電話、メール、会社名で検索）'",
      "Update tool usage: 'lookupCustomerByDetails(phone, email, companyName)'"
    ],
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED,
    expected_behavior: "3項目が揃ったらZapier照合を実行し、結果に応じて分岐"
  },

  REPAIR_AGENT_PROMPT: {
    file: "src/mastra/prompts/repair-agent-prompt.txt",
    changes_needed: [
      "Line 40: Replace 'getCustomerHistory' with 'getCustomerHistory'",
      "Line 45: Replace 'getProductsByCustomerId' with 'getProductsByCustomerId'",
      "Add tool descriptions: 'getCustomerHistory: 修理履歴取得（顧客ID）', 'getProductsByCustomerId: 製品一覧取得（顧客ID）'"
    ],
    zapier_tools: [
      ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED,
      ZAPIER_TOOLS.GOOGLE_SHEETS_LOOKUP_ROWS_ADVANCED
    ],
    expected_behavior: "顧客IDで修理履歴と製品情報を取得し、テーブル形式で表示"
  },

  REPAIR_SCHEDULING_PROMPT: {
    file: "src/mastra/prompts/repair-scheduling-prompt.txt",
    changes_needed: [
      "Add tool: 'createLogEntry: 修理予約をLOGSシートに記録'",
      "Update workflow: '予約確定時にcreateLogEntryを実行してLOGSシートにPOST'"
    ],
    zapier_tool: ZAPIER_TOOLS.GOOGLE_SHEETS_CREATE_ROW_AT_TOP,
    expected_behavior: "修理予約確定時にLOGSシートに新しい行を作成（google_sheets_create_spreadsheet_row_at_top）"
  }
};
