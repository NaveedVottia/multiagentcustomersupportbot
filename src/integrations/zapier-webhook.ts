// Define Customer interface locally since types file doesn't exist yet
interface Customer {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for the Google Sheets response structure from Zapier
interface GoogleSheetsResponse {
  [key: string]: {
    rows: Array<{
      [key: string]: string;
    }>;
  };
}

// Interface for customer data mapping
interface CustomerData {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

// Interface for product data mapping
interface ProductData {
  productId: string;
  customerId: string;
  category: string;
  model: string;
  serialNumber: string;
  warrantyStatus: string;
}

// Interface for repair data mapping
interface RepairData {
  repairId: string;
  date: string;
  productId: string;
  customerId: string;
  issue: string;
  status: string;
  visitRequired: string;
  priority: string;
  handler: string;
}

/**
 * Handles incoming webhook data from Zapier Google Sheets actions
 * Automatically detects sheet type and processes accordingly
 */
export async function handleZapierWebhook(data: GoogleSheetsResponse): Promise<any> {
  console.log("🔍 Processing Zapier webhook data:", JSON.stringify(data, null, 2));
  
  // Extract the first key (usually "0" from Google Sheets response)
  const firstKey = Object.keys(data)[0];
  if (!firstKey) {
    throw new Error("No data found in webhook payload");
  }
  
  const payload = data[firstKey];
  if (!payload || !payload.rows || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Invalid webhook payload: missing rows array or empty");
  }

  const row = payload.rows[0];
  console.log("📊 Processing row data:", row);
  
  // Detect sheet type based on available columns
  const sheetType = detectSheetType(row);
  console.log(`📋 Detected sheet type: ${sheetType}`);
  
  switch (sheetType) {
    case 'customers':
      return await processCustomerData(row);
    case 'products':
      return await processProductData(row);
    case 'repairs':
      return await processRepairData(row);
    case 'logs':
      return await processLogData(row);
    default:
      throw new Error(`Unknown sheet type: ${sheetType}`);
  }
}

/**
 * Detects the sheet type based on the columns present
 */
function detectSheetType(row: any): string {
  if (row['顧客ID'] && row['会社名'] && row['メールアドレス']) {
    return 'customers';
  } else if (row['製品ID'] && row['顧客ID'] && row['製品カテゴリ']) {
    return 'products';
  } else if (row['Repair ID'] && row['製品ID'] && row['顧客ID']) {
    return 'repairs';
  } else if (row['顧客ID'] && row['製品ID'] && row['Repair ID']) {
    return 'logs';
  }
  return 'unknown';
}

/**
 * Processes customer data from the webhook
 * NEW LOGIC: Works with online UI, processes customer data efficiently
 */
async function processCustomerData(row: any): Promise<Customer> {
  // Map Google Sheets columns to customer fields based on your sheet structure
  // Column headers: 顧客ID, 会社名, メールアドレス, 電話番号, 所在地
  const customerData: CustomerData = {
    customerId: row['顧客ID'] || row['COL$A'] || '',
    name: row['会社名'] || row['COL$B'] || '',
    email: row['メールアドレス'] || row['COL$C'] || '',
    phone: row['電話番号'] || row['COL$D'] || '',
    address: row['所在地'] || row['COL$E'] || '',
  };

  // Validate required fields
  if (!customerData.customerId || !customerData.name) {
    throw new Error("Missing required customer fields: customerId and name");
  }

  console.log("✅ Mapped customer data:", customerData);

  // For online UI, we'll use the new lookupCustomerByDetails function
  // This will check if customer exists and handle accordingly
  try {
    const { lookupCustomerByDetails } = await import("./zapier-tool-mapping.js");
    
    // Check if customer exists using the new logic
    const lookupResult = await lookupCustomerByDetails(
      customerData.phone, 
      customerData.email, 
      customerData.name
    );
    
    if (lookupResult.success) {
      console.log("✅ Customer found via lookup:", lookupResult.message);
      // Return the found customer data
      const foundCustomer = lookupResult.data[0];
      return {
        customerId: foundCustomer['顧客ID'] || foundCustomer['COL$A'] || customerData.customerId,
        name: foundCustomer['会社名'] || foundCustomer['COL$B'] || customerData.name,
        email: foundCustomer['メールアドレス'] || foundCustomer['COL$C'] || customerData.email,
        phone: foundCustomer['電話番号'] || foundCustomer['COL$D'] || customerData.phone,
        address: foundCustomer['所在地'] || foundCustomer['COL$E'] || customerData.address,
      };
    } else {
      console.log("🆕 Customer not found, will create new record");
      // Create new customer in your database
      const customer = await createOrUpdateCustomer(customerData);
      console.log("✅ New customer created successfully:", customer.customerId);
      return customer;
    }
  } catch (error) {
    console.error("❌ Error in customer lookup/creation:", error);
    // Fallback to original logic
    const customer = await createOrUpdateCustomer(customerData);
    console.log("✅ Customer processed successfully (fallback):", customer.customerId);
    return customer;
  }
}

/**
 * Processes product data from the webhook
 */
async function processProductData(row: any): Promise<ProductData> {
  const productData: ProductData = {
    productId: row['製品ID'] || '',
    customerId: row['顧客ID'] || '',
    category: row['製品カテゴリ'] || '',
    model: row['型式'] || '',
    serialNumber: row['シリアル番号'] || '',
    warrantyStatus: row['保証状況'] || '',
  };

  console.log("✅ Mapped product data:", productData);
  return productData;
}

/**
 * Processes repair data from the webhook
 */
async function processRepairData(row: any): Promise<RepairData> {
  const repairData: RepairData = {
    repairId: row['Repair ID'] || '',
    date: row['日時'] || '',
    productId: row['製品ID'] || '',
    customerId: row['顧客ID'] || '',
    issue: row['問題内容'] || '',
    status: row['ステータス'] || '',
    visitRequired: row['訪問要否'] || '',
    priority: row['優先度'] || '',
    handler: row['対応者'] || '',
  };

  console.log("✅ Mapped repair data:", repairData);
  return repairData;
}

/**
 * Processes log data from the webhook
 */
async function processLogData(row: any): Promise<any> {
  // Logs contain combined data from all sheets
  const logData = {
    customerId: row['顧客ID'] || '',
    companyName: row['会社名'] || '',
    email: row['メールアドレス'] || '',
    phone: row['電話番号'] || '',
    location: row['所在地'] || '',
    productId: row['製品ID'] || '',
    productCategory: row['製品カテゴリ'] || '',
    model: row['型式'] || '',
    serialNumber: row['シリアル番号'] || '',
    warrantyStatus: row['保証状況'] || '',
    repairId: row['Repair ID'] || '',
    date: row['日時'] || '',
    issue: row['問題内容'] || '',
    status: row['ステータス'] || '',
    visitRequired: row['訪問要否'] || '',
    priority: row['優先度'] || '',
    handler: row['対応者'] || '',
    notes: row['備考'] || '',
    name: row['Name'] || '',
    phoneAlt: row['phone'] || '',
    dateAlt: row['date'] || '',
    machine: row['machine'] || '',
  };

  console.log("✅ Mapped log data:", logData);
  return logData;
}

/**
 * Creates or updates a customer in the database
 * Uses customerId as the main identifier throughout the workflow
 */
async function createOrUpdateCustomer(customerData: CustomerData): Promise<Customer> {
  try {
    console.log("🔍 Processing customer with ID:", customerData.customerId);
    
    // First, try to find existing customer by customerId (primary lookup)
    const { lookupCustomerByDetails } = await import("./zapier-tool-mapping.js");
    
    // Use customerId as the primary identifier, but also check other fields
    const lookupResult = await lookupCustomerByDetails(
      customerData.phone,
      customerData.email,
      customerData.name
    );
    
    if (lookupResult.success && lookupResult.data && lookupResult.data.length > 0) {
      console.log("🔄 Customer already exists via lookup:", lookupResult.message);
      // Return existing customer data with consistent customerId
      const existing = lookupResult.data[0];
      const existingCustomerId = existing['顧客ID'] || existing['COL$A'];
      
      // If we found a customer but with different ID, use the found one
      if (existingCustomerId && existingCustomerId !== customerData.customerId) {
        console.log(`🔄 Found existing customer with different ID: ${existingCustomerId} (was: ${customerData.customerId})`);
      }
      
      return {
        customerId: existingCustomerId || customerData.customerId, // Use found ID or original
        name: existing['会社名'] || existing['COL$B'] || customerData.name,
        email: existing['メールアドレス'] || existing['COL$C'] || customerData.email,
        phone: existing['電話番号'] || existing['COL$D'] || customerData.phone,
        address: existing['所在地'] || existing['COL$E'] || customerData.address
      };
    } else {
      console.log("🆕 Creating new customer with ID:", customerData.customerId);
      
      // For new customers, we'll create a simple customer object
      // The actual registration can be handled by the repair agent later
      return {
        customerId: customerData.customerId,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        address: customerData.address
      };
    }
  } catch (error) {
    console.error("❌ Error processing customer:", error);
    // Return the customer data as-is to continue the workflow
    console.log("⚠️ Continuing workflow with original customer data");
    return customerData;
  }
}

/**
 * Test function to simulate Zapier webhook data for customers
 * Use this for testing customer data from Google Sheets
 */
export function createTestWebhookData(): GoogleSheetsResponse {
  return {
    "0": {
      "rows": [
        {
          // Japanese column headers (primary format)
          "顧客ID": "CUST003",
          "会社名": "ウエルシア 川崎駅前店",
          "メールアドレス": "support@welcia-k.jp",
          "電話番号": "044-1122-3344",
          "所在地": "神奈川県・川崎",
          // Google Sheets column format (fallback)
          "COL$A": "CUST003",
          "COL$B": "ウエルシア 川崎駅前店",
          "COL$C": "support@welcia-k.jp",
          "COL$D": "044-1122-3344",
          "COL$E": "神奈川県・川崎"
        }
      ]
    }
  };
}

/**
 * Test function to simulate Zapier webhook data for products
 * Use this for testing product data from Google Sheets
 */
export function createTestProductWebhookData(): GoogleSheetsResponse {
  return {
    "0": {
      "rows": [
        {
          // Google Sheets column format
          "COL$A": "PROD001",
          "COL$B": "CUST003",
          "COL$C": "冷蔵庫",
          "COL$D": "SR-5000X",
          "COL$E": "SN123456789",
          "COL$F": "保証期間内",
          // Japanese column names (alternative format)
          "製品ID": "PROD001",
          "顧客ID": "CUST003",
          "製品カテゴリ": "冷蔵庫",
          "型式": "SR-5000X",
          "シリアル番号": "SN123456789",
          "保証状況": "保証期間内"
        }
      ]
    }
  };
}

/**
 * Test function to simulate Zapier webhook data for repairs
 * Use this for testing repair history data from Google Sheets
 * Maintains customerId flow throughout the workflow
 */
export function createTestRepairWebhookData(): GoogleSheetsResponse {
  return {
    "0": {
      "rows": [
        {
          // Google Sheets column format (COL$)
          "COL$A": "REP101",
          "COL$B": "2025-08-02 00:00",
          "COL$C": "PROD003",
          "COL$D": "CUST003",
          "COL$E": "コインが詰まる",
          "COL$F": "未対応",
          "COL$G": "要",
          "COL$H": "中",
          "COL$I": "渡辺",
          // Japanese column names (alternative format)
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
    }
  };
}

/**
 * Test function to simulate Zapier webhook data for repair history
 * Returns multiple repair records for a specific customer
 * Use this for testing customer repair history
 */
export function createTestRepairHistoryWebhookData(customerId: string = "CUST003"): GoogleSheetsResponse {
  return {
    "0": {
      "rows": [
        {
          // First repair record
          "COL$A": "REP101",
          "COL$B": "2025-08-02 00:00",
          "COL$C": "PROD003",
          "COL$D": customerId,
          "COL$E": "コインが詰まる",
          "COL$F": "未対応",
          "COL$G": "要",
          "COL$H": "中",
          "COL$I": "渡辺",
          "Repair ID": "REP101",
          "日時": "2025-08-02 00:00",
          "製品ID": "PROD003",
          "顧客ID": customerId,
          "問題内容": "コインが詰まる",
          "ステータス": "未対応",
          "訪問要否": "要",
          "優先度": "中",
          "対応者": "渡辺"
        },
        {
          // Second repair record
          "COL$A": "REP103",
          "COL$B": "2025-08-04 00:00",
          "COL$C": "PROD002",
          "COL$D": customerId,
          "COL$E": "水漏れがある",
          "COL$F": "解決済み",
          "COL$G": "不要",
          "COL$H": "低",
          "COL$I": "田中",
          "Repair ID": "REP103",
          "日時": "2025-08-04 00:00",
          "製品ID": "PROD002",
          "顧客ID": customerId,
          "問題内容": "水漏れがある",
          "ステータス": "解決済み",
          "訪問要否": "不要",
          "優先度": "低",
          "対応者": "田中"
        },
        {
          // Third repair record
          "COL$A": "REP105",
          "COL$B": "2025-08-06 00:00",
          "COL$C": "PROD003",
          "COL$D": customerId,
          "COL$E": "水漏れがある",
          "COL$F": "対応中",
          "COL$G": "要",
          "COL$H": "低",
          "COL$I": "鈴木",
          "Repair ID": "REP105",
          "日時": "2025-08-06 00:00",
          "製品ID": "PROD003",
          "顧客ID": customerId,
          "問題内容": "水漏れがある",
          "ステータス": "対応中",
          "訪問要否": "要",
          "優先度": "低",
          "対応者": "鈴木"
        }
      ]
    }
  };
}

/**
 * Test function to simulate Zapier webhook data for LOGS
 * This is the FINAL endpoint where UI POSTs repair scheduling data
 * Uses EXACT headers from database.txt
 */
export function createTestLogsWebhookData(customerId: string = "CUST003"): GoogleSheetsResponse {
  return {
    "0": {
      "rows": [
        {
          // EXACT headers from database.txt - this is what UI will POST
          "顧客ID": customerId,
          "会社名": "ウエルシア 川崎駅前店",
          "メールアドレス": "support@welcia-k.jp",
          "電話番号": "044-1122-3344",
          "所在地": "神奈川県・川崎",
          "製品ID": "PROD003",
          "製品カテゴリ": "冷蔵ショーケース",
          "型式": "RS-1020K",
          "シリアル番号": "SN102077",
          "保証状況": "有効",
          "Repair ID": "REP_NEW_001",
          "日時": new Date().toISOString(),
          "問題内容": "コインが詰まる - 訪問修理が必要",
          "ステータス": "未対応",
          "訪問要否": "要",
          "優先度": "中",
          "対応者": "AI",
          "備考": "顧客からの直接申し込み - オンラインUI経由",
          "Name": "ウエルシア 川崎駅前店",
          "phone": "044-1122-3344",
          "date": new Date().toISOString(),
          "machine": "冷蔵ショーケース RS-1020K"
        }
      ]
    }
  };
}

/**
 * Test function to simulate the FINAL repair scheduling POST from UI
 * This represents what the UI sends when scheduling an in-person repair
 * Maintains customerId flow throughout the entire workflow
 */
export function createTestRepairSchedulingWebhookData(
  customerId: string = "CUST003",
  issue: string = "コインが詰まる - 訪問修理が必要",
  priority: string = "中",
  visitRequired: string = "要"
): GoogleSheetsResponse {
  const timestamp = new Date().toISOString();
  const repairId = `REP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  return {
    "0": {
      "rows": [
        {
          // EXACT headers from database.txt - UI POSTs this data
          "顧客ID": customerId,
          "会社名": "ウエルシア 川崎駅前店",
          "メールアドレス": "support@welcia-k.jp",
          "電話番号": "044-1122-3344",
          "所在地": "神奈川県・川崎",
          "製品ID": "PROD003",
          "製品カテゴリ": "冷蔵ショーケース",
          "型式": "RS-1020K",
          "シリアル番号": "SN102077",
          "保証状況": "有効",
          "Repair ID": repairId,
          "日時": timestamp,
          "問題内容": issue,
          "ステータス": "未対応",
          "訪問要否": visitRequired,
          "優先度": priority,
          "対応者": "AI",
          "備考": `オンラインUI経由でスケジュール - ${timestamp}`,
          "Name": "ウエルシア 川崎駅前店",
          "phone": "044-1122-3344",
          "date": timestamp,
          "machine": "冷蔵ショーケース RS-1020K"
        }
      ]
    }
  };
}

/**
 * Test function to check Zapier MCP connection and list available tools
 * Use this to verify the connection and see what tools are available
 */
export async function testZapierMcpConnection(): Promise<any> {
  try {
    console.log("🔍 Testing Zapier MCP connection...");
    
    // Import the Zapier MCP client
    const { zapierMcp } = await import("./zapier-mcp.js");
    
    // Test connection by calling a simple tool
    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "test connection",
      worksheet: "Customers",
      lookup_key: "COL$A",
      lookup_value: "CUST003"
    });
    
    console.log("✅ Zapier MCP connection successful:", result);
    return {
      success: true,
      message: "Zapier MCP connection successful",
      result: result
    };
    
  } catch (error) {
    console.error("❌ Zapier MCP connection failed:", error);
    return {
      success: false,
      message: "Zapier MCP connection failed",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Get list of available Zapier MCP tools
 * Use this to see what tools are available for integration
 */
export async function getZapierMcpTools(): Promise<any> {
  try {
    console.log("🔍 Getting Zapier MCP tools...");
    
    // Import the Zapier MCP client
    const { zapierMcp } = await import("./zapier-mcp.js");
    
    // Get the MCP client instance to access toolsets
    const mcpClient = (zapierMcp as any).mcp;
    if (!mcpClient) {
      throw new Error("MCP client not initialized");
    }
    
    // Get available toolsets
    const toolsets = await mcpClient.getToolsets();
    const zapierTools = toolsets["Zapier"] || {};
    
    console.log("✅ Available Zapier MCP tools:", Object.keys(zapierTools));
    return {
      success: true,
      message: "Zapier MCP tools retrieved successfully",
      tools: Object.keys(zapierTools),
      toolCount: Object.keys(zapierTools).length
    };
    
  } catch (error) {
    console.error("❌ Failed to get Zapier MCP tools:", error);
    return {
      success: false,
      message: "Failed to get Zapier MCP tools",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
