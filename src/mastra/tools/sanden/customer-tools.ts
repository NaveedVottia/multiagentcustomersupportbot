import { z } from "zod";
import { createTool } from "@mastra/core/tools";

// Direct Zapier webhook call without fallbacks
async function sendZapierWebhook(event: string, payload: any): Promise<any> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("ZAPIER_WEBHOOK_URL not configured");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to send Zapier webhook: ${error}`);
  }
}

// Online validation functions that call external APIs
async function validateEmailOnline(email: string): Promise<{ isValid: boolean; message: string }> {
  try {
    // Call external email validation service
    const response = await fetch(`https://api.emailvalidation.io/v1/info?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        isValid: data.format_check && data.smtp_check,
        message: data.format_check && data.smtp_check ? "メールアドレスが有効です。" : "メールアドレスの形式が正しくありません。"
      };
    }
    
    // Fallback to basic regex validation if API fails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email) && email.length >= 5 && email.length <= 254;
    return {
      isValid,
      message: isValid ? "メールアドレスが有効です。" : "メールアドレスの形式が正しくありません。"
    };
  } catch (error) {
    // Fallback to basic regex validation if API fails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email) && email.length >= 5 && email.length <= 254;
    return {
      isValid,
      message: isValid ? "メールアドレスが有効です。" : "メールアドレスの形式が正しくありません。"
    };
  }
}

async function validatePhoneOnline(phone: string): Promise<{ isValid: boolean; message: string }> {
  try {
    // Call external phone validation service
    const cleanPhone = phone.replace(/\D/g, '');
    const response = await fetch(`https://api.phonevalidation.io/v1/validate?phone=${cleanPhone}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        isValid: data.valid && cleanPhone.length >= 10 && cleanPhone.length <= 20,
        message: data.valid && cleanPhone.length >= 10 && cleanPhone.length <= 20 ? "電話番号が有効です。" : "電話番号は10桁から20桁で入力してください。"
      };
    }
    
    // Fallback to basic validation if API fails
    const isValid = cleanPhone.length >= 10 && cleanPhone.length <= 20;
    return {
      isValid,
      message: isValid ? "電話番号が有効です。" : "電話番号は10桁から20桁で入力してください。"
    };
  } catch (error) {
    // Fallback to basic validation if API fails
    const cleanPhone = phone.replace(/\D/g, '');
    const isValid = cleanPhone.length >= 10 && cleanPhone.length <= 20;
    return {
      isValid,
      message: isValid ? "電話番号が有効です。" : "電話番号は10桁から20桁で入力してください。"
    };
  }
}

async function validateCompanyNameOnline(companyName: string): Promise<{ isValid: boolean; message: string; normalizedName: string }> {
  try {
    // Call external company validation service
    const response = await fetch(`https://api.company-information.service/validate?name=${encodeURIComponent(companyName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        isValid: data.valid && companyName.length >= 3 && companyName.length <= 100,
        message: data.valid && companyName.length >= 3 && companyName.length <= 100 ? "会社名が有効です。" : "会社名は3文字以上100文字以内で入力してください。",
        normalizedName: data.normalized_name || companyName.trim()
      };
    }
    
    // Fallback to basic validation if API fails
    const isValid = companyName.length >= 3 && companyName.length <= 100;
    return {
      isValid,
      message: isValid ? "会社名が有効です。" : "会社名は3文字以上100文字以内で入力してください。",
      normalizedName: companyName.trim()
    };
  } catch (error) {
    // Fallback to basic validation if API fails
    const isValid = companyName.length >= 3 && companyName.length <= 100;
    return {
      isValid,
      message: isValid ? "会社名が有効です。" : "会社名は3文字以上100文字以内で入力してください。",
      normalizedName: companyName.trim()
    };
  }
}

export const updateCustomer = createTool({
  id: "updateCustomer",
  description: "Update existing customer information in the system",
  inputSchema: z.object({
    customerId: z.string().describe("Unique customer identifier"),
    updates: z.object({
      companyName: z.string().optional().describe("Company name"),
      email: z.string().email().optional().describe("Customer email"),
      phone: z.string().optional().describe("Phone number"),
      address: z.string().optional().describe("Customer address"),
      contactPerson: z.string().optional().describe("Primary contact person"),
      notes: z.string().optional().describe("Additional notes"),
    }).describe("Fields to update"),
    sessionId: z.string().describe("Session identifier"),
  }),
  execute: async ({ context }) => {
    const { customerId, updates, sessionId } = context;
    try {
      // Send update request to Zapier
      const result = await sendZapierWebhook("customer_lookup", {
        customerId,
        updates,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: "Customer update request sent to Zapier",
        customerId,
        updates,
        zapierResponse: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update customer: ${error instanceof Error ? error.message : 'Error'}`,
        customerId,
        error: error instanceof Error ? error.message : 'Error',
      };
    }
  },
});

export const deleteCustomer = createTool({
  id: "deleteCustomer",
  description: "Delete a customer from the system",
  inputSchema: z.object({
    customerId: z.string().describe("Unique customer identifier"),
    sessionId: z.string().describe("Session identifier"),
    reason: z.string().optional().describe("Reason for deletion"),
  }),
  execute: async ({ context }) => {
    const { customerId, sessionId, reason } = context;
    try {
      // Send deletion request to Zapier
      const result = await sendZapierWebhook("customer_lookup", {
        customerId,
        sessionId,
        reason,
      });

      return {
        success: true,
        message: "Customer deletion request sent to Zapier",
        customerId,
        reason,
        zapierResponse: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete customer: ${error instanceof Error ? error.message : 'Error'}`,
        customerId,
        error: error instanceof Error ? error.message : 'Error',
      };
    }
  },
});

export const getCustomerHistory = createTool({
  id: "getCustomerHistory",
  description: "Retrieve customer interaction and repair history",
  inputSchema: z.object({
    customerId: z.string().describe("Unique customer identifier"),
    sessionId: z.string().describe("Session identifier"),
    limit: z.number().optional().default(10).describe("Number of history items to retrieve"),
  }),
  execute: async ({ context }) => {
    const { customerId, sessionId, limit } = context;
    try {
      // Send history request to Zapier
      const result = await sendZapierWebhook("customer_lookup", {
        customerId,
        sessionId,
        limit,
      });

      return {
        success: true,
        message: "Customer history request sent to Zapier",
        customerId,
        limit,
        zapierResponse: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve customer history: ${error instanceof Error ? error.message : 'Error'}`,
        customerId,
        error: error instanceof Error ? error.message : 'Error',
      };
    }
  },
});

export const customerTools = {
  searchCustomer: createTool({
    id: "searchCustomer",
    description: "Search for customer information in the online database",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Search query (company name, email, or phone)"),
      sessionId: z.string().describe("Session ID for tracking"),
      count: z.number().optional().describe("Number of previous attempts"),
    }),
    execute: async ({ context }) => {
      const { query, sessionId, count = 0 } = context;
      try {
        // Send search request to online customer database through Zapier
        const result = await sendZapierWebhook("customer_lookup", {
          query,
          sessionId,
          count,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: result.message || "お客様情報を検索しました。",
            data: result.data,
            searchId: result.searchId || `search_${Date.now()}`,
          };
        } else {
          return {
            success: false,
            message: result.message || "お客様が見つかりませんでした。",
            data: null,
            searchId: `search_${Date.now()}`,
          };
        }
      } catch (error) {
        throw new Error(`Customer search failed: ${error}`);
      }
    },
  }),

  // Fuzzy search customers with partial matching
  fuzzySearchCustomers: createTool({
    id: "fuzzySearchCustomers",
    description: "Fuzzy search for customers with partial matching in online database",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Partial search query (company name, email, or phone)"),
      sessionId: z.string().describe("Session ID for tracking"),
      threshold: z
        .number()
        .optional()
        .describe("Similarity threshold (0.0-1.0)"),
    }),
    execute: async ({ context }) => {
      const { query, sessionId, threshold = 0.7 } = context;
      try {
        // Send fuzzy search request to online customer database through Zapier
        const result = await sendZapierWebhook("customer_lookup", {
          query,
          sessionId,
          threshold,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: result.message || `曖昧検索で${result.data?.length || 0}件のお客様が見つかりました。`,
            data: result.data,
            searchId: result.searchId || `fuzzy_${Date.now()}`,
          };
        } else {
          return {
            success: false,
            message: result.message || "曖昧検索でお客様が見つかりませんでした。",
            data: null,
            searchId: `fuzzy_${Date.now()}`,
          };
        }
      } catch (error) {
        throw new Error(`Fuzzy customer search failed: ${error}`);
      }
    },
  }),

  // Get customer by details with online validation
  getCustomerByDetails: createTool({
    id: "getCustomerByDetails",
    description: "Get customer information by matching details from online database",
    inputSchema: z.object({
      companyName: z.string().optional().describe("Company name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      sessionId: z.string().describe("Session ID for tracking"),
    }),
    execute: async ({ context }) => {
      const { companyName, email, phone, sessionId } = context;
      try {
        // Validate inputs using online validation services
        const validationErrors = [];
        let normalizedCompanyName = companyName;

        if (companyName) {
          const companyValidation = await validateCompanyNameOnline(companyName);
          if (!companyValidation.isValid) {
            validationErrors.push(companyValidation.message);
          } else {
            normalizedCompanyName = companyValidation.normalizedName;
          }
        }

        if (email) {
          const emailValidation = await validateEmailOnline(email);
          if (!emailValidation.isValid) {
            validationErrors.push(emailValidation.message);
          }
        }

        if (phone) {
          const phoneValidation = await validatePhoneOnline(phone);
          if (!phoneValidation.isValid) {
            validationErrors.push(phoneValidation.message);
          }
        }

        if (validationErrors.length > 0) {
          return {
            success: false,
            message: "入力内容に問題があります。",
            errors: validationErrors,
            data: null,
          };
        }

        // Search for matching customer in online database through Zapier
        const result = await sendZapierWebhook("customer_lookup", {
          companyName: normalizedCompanyName,
          email,
          phone,
          sessionId,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: result.message || `${result.data?.length || 0}件のお客様が見つかりました。`,
            data: result.data,
          };
        } else {
          return {
            success: false,
            message: result.message || "指定された条件に一致するお客様が見つかりませんでした。",
            data: null,
          };
        }
      } catch (error) {
        throw new Error(`Failed to get customer by details: ${error}`);
      }
    },
  }),

  // Sanitize and validate input using online services
  sanitizeInput: createTool({
    id: "sanitizeInput",
    description: "Sanitize and validate user input using online validation services",
    inputSchema: z.object({
      input: z.string().describe("Input to sanitize"),
      type: z
        .enum(["companyName", "email", "phone", "address"])
        .describe("Type of input"),
      sessionId: z.string().describe("Session ID for tracking"),
    }),
    execute: async ({ context }) => {
      const { input, type, sessionId } = context;
      try {
        let sanitizedInput = input.trim();
        let isValid = false;
        let validationMessage = "";

        switch (type) {
          case "companyName":
            const companyValidation = await validateCompanyNameOnline(input);
            sanitizedInput = companyValidation.normalizedName;
            isValid = companyValidation.isValid;
            validationMessage = companyValidation.message;
            break;
          case "email":
            const emailValidation = await validateEmailOnline(input);
            sanitizedInput = input.trim().toLowerCase();
            isValid = emailValidation.isValid;
            validationMessage = emailValidation.message;
            break;
          case "phone":
            const phoneValidation = await validatePhoneOnline(input);
            sanitizedInput = input.trim();
            isValid = phoneValidation.isValid;
            validationMessage = phoneValidation.message;
            break;
          case "address":
            sanitizedInput = input.trim();
            isValid = sanitizedInput.length >= 5 && sanitizedInput.length <= 200;
            validationMessage = isValid ? "住所が有効です。" : "住所は5文字以上200文字以内で入力してください。";
            break;
        }

        // Send validation results to Zapier for external processing
        try {
          await sendZapierWebhook("input.sanitize", {
            input,
            type,
            sessionId,
            sanitizedInput,
            isValid,
            timestamp: new Date().toISOString(),
          });
        } catch (zapierError) {
          console.warn("Zapier webhook failed, continuing with local validation:", zapierError);
        }

        return {
          success: isValid,
          message: validationMessage,
          sanitizedInput,
          isValid,
        };
      } catch (error) {
        throw new Error(`Input sanitization failed: ${error}`);
      }
    },
  }),

  // Log access and audit information
  logAccess: createTool({
    id: "logAccess",
    description: "Log access and audit information to online systems",
    inputSchema: z.object({
      action: z.string().describe("Action performed"),
      sessionId: z.string().describe("Session ID"),
      customerId: z.string().optional().describe("Customer ID if applicable"),
      details: z.record(z.any()).optional().describe("Additional details"),
    }),
    execute: async ({ context }) => {
      const { action, sessionId, customerId, details } = context;
      try {
        // Send to Zapier for external logging
        const result = await sendZapierWebhook("access.log", {
          action,
          sessionId,
          customerId,
          details,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: "アクセスが記録されました。",
            logId: result.logId || `log_${Date.now()}`,
          };
        } else {
          return {
            success: false,
            message: result.message || "アクセスの記録に失敗しました。",
            logId: null,
          };
        }
      } catch (error) {
        throw new Error(`Access logging failed: ${error}`);
      }
    },
  }),

  // Escalate to human support
  escalateToHuman: createTool({
    id: "escalateToHuman",
    description: "Escalate complex issues to human support through online systems",
    inputSchema: z.object({
      reason: z.string().describe("Reason for escalation"),
      priority: z
        .enum(["Low", "Medium", "High", "Emergency"])
        .describe("Escalation priority"),
      sessionId: z.string().describe("Session ID"),
      customerId: z.string().optional().describe("Customer ID if available"),
      context: z.record(z.any()).optional().describe("Context information"),
    }),
    execute: async ({ context }) => {
      const {
        reason,
        priority,
        sessionId,
        customerId,
        context: contextData,
      } = context;
      try {
        // Send escalation request to online support system through Zapier
        const result = await sendZapierWebhook("support.escalate", {
          reason,
          priority,
          sessionId,
          customerId,
          context: contextData,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: "担当者へのエスカレーションが完了しました。",
            escalationId: result.escalationId || `esc_${Date.now()}`,
            estimatedResponseTime: result.estimatedResponseTime || (priority === "Emergency" ? "即座" : "2時間以内"),
          };
        } else {
          return {
            success: false,
            message: result.message || "エスカレーションに失敗しました。",
            escalationId: null,
            estimatedResponseTime: null,
          };
        }
      } catch (error) {
        throw new Error(`Escalation failed: ${error}`);
      }
    },
  }),

  getCustomerDetails: createTool({
    id: "getCustomerDetails",
    description: "Get detailed customer information by ID from online database",
    inputSchema: z.object({
      customerId: z.string().describe("Customer ID to retrieve details for"),
      sessionId: z.string().describe("Session ID for tracking"),
    }),
    execute: async ({ context }) => {
      const { customerId, sessionId } = context;
      try {
        // Get customer details from online database through Zapier
        const result = await sendZapierWebhook("customer.getDetails", {
          customerId,
          sessionId,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          return {
            success: true,
            message: "お客様情報を取得しました。",
            data: result.data,
            customerId,
          };
        } else {
          return {
            success: false,
            message: result.message || "指定されたIDのお客様が見つかりませんでした。",
            data: null,
          };
        }
      } catch (error) {
        throw new Error(`Failed to get customer details: ${error}`);
      }
    },
  }),

  updateCustomer,
  deleteCustomer,
  getCustomerHistory,
};
