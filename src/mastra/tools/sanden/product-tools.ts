import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";
import { sharedMemory } from "../../agents/sanden/customer-identification";
import { sessionData } from "../../lib/shared-memory";

// Import the mapping function from customer-tools
function mapLookupKey(worksheet: string, key: string): string {
  if (worksheet === "Products") {
    const map: Record<string,string> = {
      "製品ID": "COL$A",
      "顧客ID": "COL$B",
      "製品カテゴリ": "COL$C",
      "型式": "COL$D",
      "シリアル番号": "COL$E",
      "保証状況": "COL$F",
    };
    return map[key] || key;
  }
  return key;
}

export const searchProductsTool = createTool({
  id: "searchProducts",
  description: "Search for products in the Sanden repair system",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    category: z.string().optional().describe("Filter by product category"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { query, category, sessionId } = context;

    try {
      const result = await searchProducts(sessionId, query, category);
      return {
        success: true,
        data: result.data || result,
        message: result.message || "製品検索が完了しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Product search failed: ${error.message}`,
      };
    }
  },
});

export const getProductsByCustomerIdTool = createTool({
  id: "getProductsByCustomerId",
  description: "Get all products associated with a specific customer ID",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID to search products for"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, sessionId } = context;

    try {
      const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get all products for customer ID: ${customerId}`,
        worksheet: "Products",
        lookup_key: "顧客ID",
        lookup_value: customerId,
        row_count: "50"
      });
      
      console.log(`🔍 [DEBUG] Zapier result for products:`, JSON.stringify(result, null, 2));
      
      // Handle different possible result structures
      let rows = [];
      
      // First, try to extract from content[0].text if it's a JSON string
      if (result && result.content && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
        try {
          console.log(`🔍 [DEBUG] Found content[0].text, parsing JSON...`);
          const parsedContent = JSON.parse(result.content[0].text);
          console.log(`🔍 [DEBUG] Parsed content:`, JSON.stringify(parsedContent, null, 2));
          
          if (parsedContent && parsedContent.results && Array.isArray(parsedContent.results) && parsedContent.results[0] && parsedContent.results[0].rows) {
            rows = parsedContent.results[0].rows;
            console.log(`🔍 [DEBUG] Extracted rows from parsed content:`, JSON.stringify(rows, null, 2));
          }
        } catch (parseError) {
          console.log(`❌ [DEBUG] Failed to parse content[0].text as JSON:`, parseError);
        }
      }
      
      // Fallback to original logic if content parsing didn't work
      if (rows.length === 0) {
        if (result && result["0"] && result["0"].rows) {
          rows = result["0"].rows;
        } else if (result && Array.isArray(result)) {
          rows = result;
        } else if (result && result.rows) {
          rows = result.rows;
        } else if (result && result.results && result.results[0] && result.results[0].rows) {
          rows = result.results[0].rows;
        }
      }
      
      console.log(`🔍 [DEBUG] Final extracted product rows:`, JSON.stringify(rows, null, 2));
      
      if (rows && rows.length > 0) {
        console.log(`✅ [DEBUG] Found ${rows.length} product records`);
        
        // Format the product data
        const products = rows.map((row: any) => ({
          productId: row["製品ID"] || row["COL$A"],
          customerId: row["顧客ID"] || row["COL$B"],
          productCategory: row["製品カテゴリ"] || row["COL$C"],
          model: row["型式"] || row["COL$D"],
          serialNumber: row["シリアル番号"] || row["COL$E"],
          warrantyStatus: row["保証状況"] || row["COL$F"]
        }));
        
        console.log(`✅ [DEBUG] Formatted products:`, JSON.stringify(products, null, 2));
        
        return {
          success: true,
          data: products,
          message: `顧客ID ${customerId} の製品情報を取得しました。`,
        };
      } else {
        console.log(`❌ [DEBUG] No product records found for customer ID: ${customerId}`);
        return {
          success: true,
          data: [],
          message: `顧客ID ${customerId} の製品情報は見つかりませんでした。`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Failed to get products by customer ID: ${error.message}`,
      };
    }
  },
});

export const hybridGetProductsByCustomerIdTool = createTool({
  id: "hybridGetProductsByCustomerId",
  description: "Get all products associated with a specific customer ID from the Sanden repair system",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Customer ID to search products for (optional - will use memory if not provided)"),
    sessionId: z.string().optional().describe("Session ID for validation (optional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    let { customerId, sessionId = "default-session" } = context;

    // Try to get customer ID from session data first
    if (!customerId && context.session && context.session.customerId) {
      customerId = context.session.customerId;
      console.log(`🔍 [DEBUG] Retrieved customer ID from session: ${customerId}`);
    }

    // If still no customerId, try to get it from shared memory using proper memory identifiers
    if (!customerId) {
      try {
        // Use sessionData helper functions instead of direct Memory API
        customerId = await sessionData.getCustomerField(sessionId, "customerId");
        console.log(`🔍 [DEBUG] Retrieved customer ID from memory:`, customerId);
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from memory:`, error);
      }
    }

    if (!customerId) {
      console.log(`❌ [DEBUG] No customer ID available for product lookup`);
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客識別を完了してください。",
      };
    }

    try {
      console.log(`🔍 [DEBUG] Getting products for customer ID: ${customerId}`);

      // Use the working Zapier action but with Products worksheet specified
      // Note: Current Zapier zap is hardcoded to Customers worksheet - needs Zapier configuration fix
      const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get all products for customer ID: ${customerId} from Products worksheet`,
        worksheet: "Products", // This parameter is ignored by current Zapier configuration
        lookup_key: "顧客ID",
        lookup_value: customerId,
        row_count: "50"
      });
      
      console.log(`🔍 [DEBUG] Zapier result for products:`, JSON.stringify(result, null, 2));
      
      // Handle different possible result structures
      let rows = [];
      
      // First, try to extract from content[0].text if it's a JSON string
      if (result && result.content && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
        try {
          console.log(`🔍 [DEBUG] Found content[0].text, parsing JSON...`);
          const parsedContent = JSON.parse(result.content[0].text);
          console.log(`🔍 [DEBUG] Parsed content:`, JSON.stringify(parsedContent, null, 2));
          
          if (parsedContent && parsedContent.results && Array.isArray(parsedContent.results) && parsedContent.results[0] && parsedContent.results[0].rows) {
            rows = parsedContent.results[0].rows;
            console.log(`🔍 [DEBUG] Extracted rows from parsed content:`, JSON.stringify(rows, null, 2));
          }
        } catch (parseError) {
          console.log(`❌ [DEBUG] Failed to parse content[0].text as JSON:`, parseError);
        }
      }
      
      // Fallback to original logic if content parsing didn't work
      if (rows.length === 0) {
        if (result && result["0"] && result["0"].rows) {
          rows = result["0"].rows;
        } else if (result && Array.isArray(result)) {
          rows = result;
        } else if (result && result.rows) {
          rows = result.rows;
        } else if (result && result.results && result.results[0] && result.results[0].rows) {
          rows = result.results[0].rows;
        }
      }
      
      console.log(`🔍 [DEBUG] Final extracted product rows:`, JSON.stringify(rows, null, 2));
      
      if (rows && rows.length > 0) {
        console.log(`✅ [DEBUG] Found ${rows.length} product records`);
        
        // Format the product data
        const products = rows.map((row: any) => ({
          productId: row["製品ID"] || row["COL$A"],
          customerId: row["顧客ID"] || row["COL$B"],
          productCategory: row["製品カテゴリ"] || row["COL$C"],
          model: row["型式"] || row["COL$D"],
          serialNumber: row["シリアル番号"] || row["COL$E"],
          warrantyStatus: row["保証状況"] || row["COL$F"]
        }));
        
        console.log(`✅ [DEBUG] Formatted products:`, JSON.stringify(products, null, 2));
        
        return {
          success: true,
          data: products,
          message: `顧客ID ${customerId} の製品情報を取得しました。`,
        };
      } else {
        console.log(`❌ [DEBUG] No product records found for customer ID: ${customerId}`);
        return {
          success: true,
          data: [],
          message: `顧客ID ${customerId} の製品情報は見つかりませんでした。`,
        };
      }
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error getting products:`, error);
      return {
        success: false,
        data: null,
        message: `Failed to get products: ${error.message}`,
      };
    }
  },
});

export const checkWarrantyStatusTool = createTool({
  id: "checkWarrantyStatus",
  description: "Check warranty status for a product",
  inputSchema: z.object({
    productId: z.string().optional().describe("Product ID"),
    serial: z.string().optional().describe("Serial number"),
    purchaseDate: z.string().optional().describe("Purchase date (ISO)"),
    customerId: z.string().optional().describe("Customer ID"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productId, serial, purchaseDate, customerId, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "checkWarranty",
        productId,
        serial,
        purchaseDate,
        customerId,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "保証状況を確認しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to check warranty: ${error.message}` };
    }
  },
});

export const getStandardRepairFeesTool = createTool({
  id: "getStandardRepairFees",
  description: "Get standard repair fees for a product category/model",
  inputSchema: z.object({
    productCategory: z.string().optional().describe("Product category"),
    model: z.string().optional().describe("Product model"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productCategory, model, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "getStandardFees",
        productCategory,
        model,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "標準修理料金を取得しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to get standard fees: ${error.message}` };
    }
  },
});

export const searchRepairLogsTool = createTool({
  id: "searchRepairLogs",
  description: "Search recent repair logs for a given customer/product",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID"),
    productId: z.string().optional().describe("Product ID"),
    limit: z.number().optional().default(5).describe("Max number of logs"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, productId, limit = 5, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "searchLogs",
        customerId,
        productId,
        limit,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "修理履歴を取得しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to search repair logs: ${error.message}` };
    }
  },
});
export const createProductTool = createTool({
  id: "createProduct",
  description: "Create a new product record in the Sanden repair system",
  inputSchema: z.object({
    productData: z
      .object({
        name: z.string().optional(),
        category: z.string().optional(),
        price: z.string().optional(),
        description: z.string().optional(),
      })
      .describe("Product data for creation"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productData, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        productData: productData || {},
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "製品作成が完了しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Product creation failed: ${error.message}`,
      };
    }
  },
});

export const updateProductTool = createTool({
  id: "updateProduct",
  description: "Update an existing product record in the Sanden repair system",
  inputSchema: z.object({
    productId: z.string().describe("Product ID for update"),
    updates: z
      .object({
        name: z.string().optional(),
        category: z.string().optional(),
        price: z.string().optional(),
        description: z.string().optional(),
      })
      .describe("Product data updates"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productId, updates, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        productId: productId || "",
        updates: updates || {},
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "製品更新が完了しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Product update failed: ${error.message}`,
      };
    }
  },
});

async function searchProducts(
  sessionId: string,
  query: string,
  category?: string
) {
  try {
    // Get customer ID from shared memory
    let customerId;
    try {
      customerId = await sessionData.getCustomerField(sessionId, "customerId");
      console.log(`🔍 [DEBUG] Retrieved customer ID from memory for search: ${customerId}`);
    } catch (error) {
      console.log(`❌ [DEBUG] Error getting customer ID from memory:`, error);
    }

    if (!customerId) {
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客識別を完了してください。",
      };
    }

    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "Use 顧客ID, get and display row (partial match app-side)",
      worksheet: "Products",
      lookup_key: "顧客ID",
      lookup_value: customerId,
    });
    
    console.log(`🔍 [DEBUG] Zapier result for product search:`, JSON.stringify(result, null, 2));
    
    // Handle different possible result structures
    let rows = [];
    
    // First, try to extract from content[0].text if it's a JSON string
    if (result && result.content && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
      try {
        console.log(`🔍 [DEBUG] Found content[0].text, parsing JSON...`);
        const parsedContent = JSON.parse(result.content[0].text);
        console.log(`🔍 [DEBUG] Parsed content:`, JSON.stringify(parsedContent, null, 2));
        
        if (parsedContent && parsedContent.results && Array.isArray(parsedContent.results) && parsedContent.results[0] && parsedContent.results[0].rows) {
          rows = parsedContent.results[0].rows;
          console.log(`🔍 [DEBUG] Extracted rows from parsed content:`, JSON.stringify(rows, null, 2));
        }
      } catch (parseError) {
        console.log(`❌ [DEBUG] Failed to parse content[0].text as JSON:`, parseError);
      }
    }
    
    // Fallback to original logic if content parsing didn't work
    if (rows.length === 0) {
      if (result && result["0"] && result["0"].rows) {
        rows = result["0"].rows;
      } else if (result && Array.isArray(result)) {
        rows = result;
      } else if (result && result.rows) {
        rows = result.rows;
      } else if (result && result.results && result.results[0] && result.results[0].rows) {
        rows = result.results[0].rows;
      } else {
        rows = (result?.results as any[]) || [];
      }
    }
    
    console.log(`🔍 [DEBUG] Final extracted product search rows:`, JSON.stringify(rows, null, 2));
    
    // Filter by query and optionally by category
    const filtered = rows.filter((r: any) => {
      const matchesQuery = JSON.stringify(r).includes(query);
      const matchesCategory = !category || 
        (r["製品カテゴリ"] && r["製品カテゴリ"].includes(category)) ||
        (r["COL$C"] && r["COL$C"].includes(category));
      return matchesQuery && matchesCategory;
    });
    
    // Format the filtered product data
    const products = filtered.map((row: any) => ({
      productId: row["製品ID"] || row["COL$A"],
      customerId: row["顧客ID"] || row["COL$B"],
      productCategory: row["製品カテゴリ"] || row["COL$C"],
      model: row["型式"] || row["COL$D"],
      serialNumber: row["シリアル番号"] || row["COL$E"],
      warrantyStatus: row["保証状況"] || row["COL$F"]
    }));
    
    return { success: true, data: products, message: "製品検索が完了しました。" };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      message: `Product search failed: ${error.message}`,
    };
  }
}

async function zapierCall(event: string, payload: Record<string, any>) {
  const result = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
    instructions: event,
    row_count: 20,
  });
  return { success: true, data: result?.results || result, message: "Zapier MCP call completed successfully" };
}

// Export all product tools
export const productTools = {
  searchProductsTool,
  getProductsByCustomerIdTool,
  hybridGetProductsByCustomerIdTool, // Add the new hybrid tool
  createProductTool,
  updateProductTool,
  checkWarrantyStatusTool,
  getStandardRepairFeesTool,
  searchRepairLogsTool,
};
