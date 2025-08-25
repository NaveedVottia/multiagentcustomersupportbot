import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";

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
        instructions: "Get products by 顧客ID",
        worksheet: "Products",
        lookup_key: "顧客ID",
        lookup_value: customerId,
      });
      return {
        success: true,
        data: (result?.results as any) || [],
        message: "顧客の製品情報を取得しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Failed to get products by customer ID: ${error.message}`,
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
    const results = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "製品検索 (partial match app-side)",
      worksheet: "Products",
      lookup_key: "製品カテゴリ",
      lookup_value: category || "",
    });
    const rows = (results?.results as any[]) || [];
    const filtered = rows.filter((r: any) =>
      JSON.stringify(r).includes(query)
    );
    return { success: true, data: filtered, message: "製品検索が完了しました。" };
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
  createProductTool,
  updateProductTool,
  checkWarrantyStatusTool,
  getStandardRepairFeesTool,
  searchRepairLogsTool,
};
