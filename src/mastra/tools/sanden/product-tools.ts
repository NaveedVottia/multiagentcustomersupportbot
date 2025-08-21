import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  execute: async ({ context }) => {
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
  execute: async ({ context }) => {
    const { customerId, sessionId } = context;

    try {
      // Send to Zapier webhook to get products by customer ID
      const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error("ZAPIER_WEBHOOK_URL not configured");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "customer_lookup",
          payload: {
            customerId,
            sessionId,
            action: "getProducts",
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Zapier webhook failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data || result,
        message: result.message || "顧客の製品情報を取得しました。",
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
  execute: async ({ context }) => {
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
  execute: async ({ context }) => {
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
  // Send to Zapier webhook for product search
  try {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("ZAPIER_WEBHOOK_URL not configured");
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "Repair",
        payload: {
          query,
          category,
          sessionId,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Zapier webhook failed: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return {
      success: true,
      data: result.data || [],
      message: result.message || "製品検索が完了しました。",
    };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      message: `Product search failed: ${error.message}`,
    };
  }
}

async function zapierCall(event: string, payload: Record<string, any>) {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("ZAPIER_WEBHOOK_URL not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Zapier webhook failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  return {
    success: true,
    data: result.data || result,
    message: result.message || "Zapier call completed successfully",
  };
}

// Export all product tools
export const productTools = {
  searchProductsTool,
  getProductsByCustomerIdTool,
  createProductTool,
  updateProductTool,
};
