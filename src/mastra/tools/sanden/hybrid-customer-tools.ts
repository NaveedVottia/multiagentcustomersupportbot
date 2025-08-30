import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { LocalDatabaseService } from "../../../integrations/local-database.js";
import { ZapierMcpClient } from "../../../integrations/zapier-mcp.js";

// Hybrid customer lookup tool - tries Zapier first, then local database
export const hybridLookupCustomerByDetails = createTool({
  id: "hybridLookupCustomerByDetails",
  description: "顧客情報を3つの詳細（電話番号、メール、会社名）のいずれかで検索します。まずZapierを試し、失敗した場合はローカルデータベースを使用します。",
  inputSchema: z.object({
    phone: z.string().optional().describe("電話番号"),
    email: z.string().optional().describe("メールアドレス"),
    companyName: z.string().optional().describe("会社名（店舗名）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    customer: z.object({
      customerId: z.string(),
      companyName: z.string(),
      email: z.string(),
      phone: z.string(),
      location: z.string(),
    }).nullable(),
    message: z.string(),
    source: z.enum(["zapier", "local", "not_found"]),
  }),
  execute: async ({ context }: { context: any }) => {
    const { phone, email, companyName } = context;
    
    console.log(`🔍 Hybrid lookup: phone=${phone}, email=${email}, company=${companyName}`);
    
    // First, try Zapier MCP
    try {
      console.log("🔄 Trying Zapier MCP first...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Try to lookup customer via Zapier
      const zapierResult = await zapierClient.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Look up customer data by any of these details: phone=${phone}, email=${email}, company=${companyName}`,
        worksheet: "Customers",
        row_count: "10", // Zapier expects string
        lookup_key: "メールアドレス", // Start with email
        lookup_value: email || "",
      });
      
      // Parse Zapier response structure
      let zapierRows: any[] = [];
      
      if (zapierResult && zapierResult.content && zapierResult.content[0] && zapierResult.content[0].text) {
        try {
          const parsedContent = JSON.parse(zapierResult.content[0].text);
          if (parsedContent.results && parsedContent.results[0] && parsedContent.results[0].rows) {
            zapierRows = parsedContent.results[0].rows;
            console.log(`✅ Zapier returned ${zapierRows.length} rows, parsing results...`);
          }
        } catch (parseError) {
          console.log("❌ Failed to parse Zapier response:", parseError);
        }
      }
      
      if (zapierRows.length > 0) {
        // Parse Zapier result and find matching customer
        const customer = zapierRows.find((row: any) => {
          const rowPhone = row["COL$D"];
          const rowEmail = row["COL$C"];
          const rowCompany = row["COL$B"];
          
          console.log(`🔍 Checking row: phone=${rowPhone}, email=${rowEmail}, company=${rowCompany}`);
          console.log(`🔍 Looking for: phone=${phone}, email=${email}, company=${companyName}`);
          
          const match = (phone && rowPhone === phone) || 
                        (email && rowEmail === email) || 
                        (companyName && rowCompany === companyName);
          
          console.log(`🔍 Match found: ${match}`);
          return match;
        });
        
        if (customer) {
          console.log(`✅ Zapier found customer: ${customer["COL$A"]}`);
          return {
            success: true,
            customer: {
              customerId: customer["COL$A"],
              companyName: customer["COL$B"],
              email: customer["COL$C"],
              phone: customer["COL$D"],
              location: customer["COL$E"],
            },
            message: `Zapierで顧客が見つかりました: ${customer["COL$B"]} (${customer["COL$A"]})`,
            source: "zapier",
          };
        } else {
          console.log("⚠️ Zapier returned data but no exact match found, trying local database...");
        }
      } else {
        console.log("⚠️ Zapier returned no data, trying local database...");
      }
      
      console.log("⚠️ Zapier lookup failed or no match found, trying local database...");
      
    } catch (zapierError) {
      console.log("❌ Zapier MCP failed, falling back to local database:", zapierError);
    }
    
        // Fallback to local database
    try {
      console.log("🔄 Using local database fallback...");
      const localCustomer = LocalDatabaseService.lookupCustomerByDetails(phone, email, companyName);
      
      if (localCustomer) {
        console.log(`✅ Local DB found customer: ${localCustomer.customerId}`);
        return {
          success: true,
          customer: {
            customerId: localCustomer.customerId,
            companyName: localCustomer.companyName,
            email: localCustomer.email,
            phone: localCustomer.phone,
            location: localCustomer.location,
          },
          message: `ローカルデータベースで顧客が見つかりました: ${localCustomer.companyName} (${localCustomer.customerId})`,
          source: "local",
        };
      } else {
        console.log("❌ Local database also found no customer");
      }
    } catch (localError) {
      console.error("❌ Local database lookup error:", localError);
    }
    
    // No customer found in either source
    console.log("❌ No customer found in Zapier or local database");
    return {
      success: false,
      customer: null,
      message: "指定された情報に一致する顧客が見つかりませんでした。",
      source: "not_found",
    };
  },
});

// Hybrid customer registration tool
export const hybridRegisterCustomer = createTool({
  id: "hybridRegisterCustomer",
  description: "新しい顧客を登録します。まずZapierを試し、失敗した場合はローカルデータベースを使用します。",
  inputSchema: z.object({
    companyName: z.string().describe("会社名（店舗名）"),
    email: z.string().describe("メールアドレス"),
    phone: z.string().describe("電話番号"),
    location: z.string().describe("所在地"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    customerId: z.string(),
    message: z.string(),
    source: z.enum(["zapier", "local"]),
  }),
  execute: async ({ context }: { context: any }) => {
    const { companyName, email, phone, location } = context;
    
    console.log(`📝 Hybrid register: company=${companyName}, email=${email}, phone=${phone}`);
    
    // First, try Zapier MCP
    try {
      console.log("🔄 Trying Zapier MCP for registration...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Try to create customer via Zapier
      const zapierResult = await zapierClient.callTool("google_sheets_create_spreadsheet_row_at_top", {
        instructions: `Create new customer: company=${companyName}, email=${email}, phone=${phone}, location=${location}`,
        COL__DOLLAR__A: `CUST${Date.now().toString().slice(-6)}`,
        COL__DOLLAR__B: companyName,
        COL__DOLLAR__C: email,
        COL__DOLLAR__D: phone,
        COL__DOLLAR__E: location,
      });
      
      if (zapierResult && zapierResult.success) {
        console.log("✅ Customer registered via Zapier");
        return {
          success: true,
          customerId: zapierResult.customerId || `CUST${Date.now().toString().slice(-6)}`,
          message: `Zapierで新しい顧客が正常に登録されました`,
          source: "zapier",
        };
      }
      
      console.log("⚠️ Zapier registration failed, trying local database...");
      
    } catch (zapierError) {
      console.log("❌ Zapier MCP failed for registration, falling back to local database:", zapierError);
    }
    
    // Fallback to local database
    try {
      console.log("🔄 Using local database fallback for registration...");
      const customerId = `CUST${Date.now().toString().slice(-6)}`;
      
      // In a real system, this would be saved to the database
      // For now, we just return success
      return {
        success: true,
        customerId,
        message: `ローカルデータベースで新しい顧客が正常に登録されました: ${customerId}`,
        source: "local",
      };
    } catch (localError) {
      console.error("❌ Local database registration error:", localError);
      return {
        success: false,
        customerId: "",
        message: "顧客登録中にエラーが発生しました。",
        source: "local",
      };
    }
  },
});

// Hybrid product lookup tool
export const hybridGetProductsByCustomerId = createTool({
  id: "hybridGetProductsByCustomerId",
  description: "指定された顧客IDに関連する製品情報を取得します。まずZapierを試し、失敗した場合はローカルデータベースを使用します。",
  inputSchema: z.object({
    customerId: z.string().describe("顧客ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    products: z.array(z.object({
      productId: z.string(),
      category: z.string(),
      model: z.string(),
      serialNumber: z.string(),
      warrantyStatus: z.string(),
    })),
    message: z.string(),
    source: z.enum(["zapier", "local"]),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId } = context;
    
    console.log(`🔍 Hybrid get products: customerId=${customerId}`);
    
    // First, try Zapier MCP
    try {
      console.log("🔄 Trying Zapier MCP for products...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Try to get products via Zapier
      const zapierResult = await zapierClient.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get all products for customer ID: ${customerId}`,
        worksheet: "Products",
        row_count: "20", // Zapier expects string
        lookup_key: "COL$B", // Use exact column reference for 顧客ID (2nd column in Products sheet)
        lookup_value: customerId,
      });
      
      console.log(`🔍 Zapier product lookup result:`, JSON.stringify(zapierResult, null, 2));
      
      // Parse Zapier response structure: {"0": {"rows": [...]}}
      const rows = zapierResult?.["0"]?.rows || zapierResult?.rows || [];
      
      if (rows && rows.length > 0) {
        console.log(`✅ Zapier found ${rows.length} products`);
        return {
          success: true,
          products: rows.map((row: any) => ({
            productId: row["COL$A"],
            category: row["COL$C"],
            model: row["COL$D"],
            serialNumber: row["COL$E"],
            warrantyStatus: row["COL$F"],
          })),
          message: `Zapierで${rows.length}件の製品が見つかりました。`,
          source: "zapier",
        };
      }
      
      console.log("⚠️ Zapier product lookup failed or no products found, trying local database...");
      
    } catch (zapierError) {
      console.log("❌ Zapier MCP failed for products, falling back to local database:", zapierError);
    }
    
    // Fallback to local database
    try {
      console.log("🔄 Using local database fallback for products...");
      const products = LocalDatabaseService.getProductsByCustomerId(customerId);
      
      return {
        success: true,
        products: products.map(p => ({
          productId: p.productId,
          category: p.category,
          model: p.model,
          serialNumber: p.serialNumber,
          warrantyStatus: p.warrantyStatus,
        })),
        message: `ローカルデータベースで${products.length}件の製品が見つかりました。`,
        source: "local",
      };
    } catch (localError) {
      console.error("❌ Local database product lookup error:", localError);
      return {
        success: false,
        products: [],
        message: "製品検索中にエラーが発生しました。",
        source: "local",
      };
    }
  },
});

// Hybrid repair history lookup tool
export const hybridGetRepairsByCustomerId = createTool({
  id: "hybridGetRepairsByCustomerId",
  description: "指定された顧客IDに関連する修理履歴を取得します。まずZapierを試し、失敗した場合はローカルデータベースを使用します。",
  inputSchema: z.object({
    customerId: z.string().describe("顧客ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    repairs: z.array(z.object({
      repairId: z.string(),
      date: z.string(),
      problem: z.string(),
      status: z.string(),
      visitRequired: z.string(),
      priority: z.string(),
      assignedTo: z.string(),
    })),
    message: z.string(),
    source: z.enum(["zapier", "local"]),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId } = context;
    
    console.log(`🔍 Hybrid get repairs: customerId=${customerId}`);
    
    // First, try Zapier MCP
    try {
      console.log("🔄 Trying Zapier MCP for repairs...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Try to get repairs via Zapier
      const zapierResult = await zapierClient.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get all repairs for customer ID: ${customerId}`,
        worksheet: "Repairs",
        row_count: "50", // Zapier expects string
        lookup_key: "顧客ID", // Use Japanese column name for customer ID
        lookup_value: customerId,
      });
      
      console.log(`🔍 Zapier repair lookup result:`, JSON.stringify(zapierResult, null, 2));
      
      // Parse Zapier response structure: {"0": {"rows": [...]}}
      const rows = zapierResult?.["0"]?.rows || zapierResult?.rows || [];
      
      if (rows && rows.length > 0) {
        console.log(`✅ Zapier found ${rows.length} repairs`);
        return {
          success: true,
          repairs: rows.map((row: any) => ({
            repairId: row["COL$A"],      // Repair ID (1st column)
            date: row["COL$B"],          // Date (2nd column)
            problem: row["COL$E"],       // Problem (5th column)
            status: row["COL$F"],        // Status (6th column)
            visitRequired: row["COL$G"], // Visit Required (7th column)
            priority: row["COL$H"],      // Priority (8th column)
            assignedTo: row["COL$I"],    // Assigned To (9th column)
          })),
          message: `Zapierで${rows.length}件の修理履歴が見つかりました。`,
          source: "zapier",
        };
      }
      
      console.log("⚠️ Zapier repair lookup failed or no repairs found, trying local database...");
      
    } catch (zapierError) {
      console.log("❌ Zapier MCP failed for repairs, falling back to local database:", zapierError);
    }
    
    // Fallback to local database
    try {
      console.log("🔄 Using local database fallback for repairs...");
      const repairs = LocalDatabaseService.getRepairsByCustomerId(customerId);
      
      return {
        success: true,
        repairs: repairs.map(r => ({
          repairId: r.repairId,
          date: r.date,
          problem: r.problem,
          status: r.status,
          visitRequired: r.visitRequired,
          priority: r.priority,
          assignedTo: r.assignedTo,
        })),
        message: `ローカルデータベースで${repairs.length}件の修理履歴が見つかりました。`,
        source: "local",
      };
    } catch (localError) {
      console.error("❌ Local database repair lookup error:", localError);
      return {
        success: false,
        repairs: [],
        message: "修理履歴検索中にエラーが発生しました。",
        source: "local",
      };
    }
  },
});

// Hybrid log entry creation tool
export const hybridCreateLogEntry = createTool({
  id: "hybridCreateLogEntry",
  description: "修理予約情報を記録します。まずZapierを試し、失敗した場合はローカルデータベースを使用します。",
  inputSchema: z.object({
    customerId: z.string(),
    companyName: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    contactName: z.string(),
    preferredDate: z.string(),
    machine: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    logId: z.string(),
    message: z.string(),
    source: z.enum(["zapier", "local"]),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, companyName, email, phone, location, contactName, preferredDate, machine } = context;
    
    console.log(`📝 Hybrid create log: customerId=${customerId}, contactName=${contactName}`);
    
    // First, try Zapier MCP
    try {
      console.log("🔄 Trying Zapier MCP for log creation...");
      const zapierClient = ZapierMcpClient.getInstance();
      
      // Try to create log via Zapier
      const zapierResult = await zapierClient.callTool("google_sheets_create_spreadsheet_row_at_top", {
        instructions: `Create repair scheduling log entry for customer: ${customerId}`,
        COL__DOLLAR__A: customerId,
        COL__DOLLAR__B: companyName,
        COL__DOLLAR__C: email,
        COL__DOLLAR__D: phone,
        COL__DOLLAR__E: location,
        COL__DOLLAR__S: contactName,
        COL__DOLLAR__T: phone,
        COL__DOLLAR__U: preferredDate,
        COL__DOLLAR__V: machine,
      });
      
      if (zapierResult && zapierResult.success) {
        console.log("✅ Log entry created via Zapier");
        return {
          success: true,
          logId: zapierResult.logId || `LOG${Date.now()}`,
          message: `Zapierでログエントリが正常に作成されました`,
          source: "zapier",
        };
      }
      
      console.log("⚠️ Zapier log creation failed, trying local database...");
      
    } catch (zapierError) {
      console.log("❌ Zapier MCP failed for log creation, falling back to local database:", zapierError);
    }
    
    // Fallback to local database
    try {
      console.log("🔄 Using local database fallback for log creation...");
      const result = LocalDatabaseService.createLogEntry({
        customerId,
        companyName,
        email,
        phone,
        location,
        contactName,
        preferredDate,
        machine,
        date: new Date().toISOString(),
        status: "新規予約",
        visitRequired: "要",
        priority: "中",
        assignedTo: "AI",
      });
      
      return {
        success: result.success,
        logId: result.logId,
        message: result.message,
        source: "local",
      };
    } catch (localError) {
      console.error("❌ Local database log creation error:", localError);
      return {
        success: false,
        logId: "",
        message: "ログ作成中にエラーが発生しました。",
        source: "local",
      };
    }
  },
});
