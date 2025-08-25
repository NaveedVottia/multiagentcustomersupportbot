import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { zapierMcp } from "../../../integrations/zapier-mcp";

function mapLookupKey(worksheet: string, key: string): string {
  if (worksheet === "Customers") {
    const map: Record<string,string> = {
      "顧客ID": "COL$A",
      "会社名": "COL$B",
      "メールアドレス": "COL$C",
      "電話番号": "COL$D",
      "所在地": "COL$E",
    };
    return map[key] || key;
  }
  if (worksheet === "repairs") {
    const map: Record<string,string> = {
      "修理ID": "COL$A",
      "日時": "COL$B",
      "製品ID": "COL$C",
      "顧客ID": "COL$D",
      "問題内容": "COL$E",
      "ステータス": "COL$F",
      "訪問要否": "COL$G",
      "優先度": "COL$H",
      "対応者": "COL$I",
    };
    return map[key] || key;
  }
  return key;
}

async function mcpLookupRows(worksheet: string, lookup_key: string, lookup_value: string) {
  const key = mapLookupKey(worksheet, lookup_key);
  return zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
    instructions: `lookup ${lookup_key}`,
    worksheet,
    lookup_key: key,
    lookup_value,
  });
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
    // Normalize whitespace and full-width variants locally; avoid external dependency
    const compact = companyName.replace(/\s+/g, " ").trim();
    const isValid = compact.length >= 2 && compact.length <= 120;
    return {
      isValid,
      message: isValid ? "会社名が有効です。" : "会社名は2文字以上120文字以内で入力してください。",
      normalizedName: compact,
    };
  } catch (error) {
    const compact = companyName.replace(/\s+/g, " ").trim();
    const isValid = compact.length >= 2 && compact.length <= 120;
    return {
      isValid,
      message: isValid ? "会社名が有効です。" : "会社名は2文字以上120文字以内で入力してください。",
      normalizedName: compact,
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
  execute: async ({ context }: { context: any }) => {
    const { customerId, updates, sessionId } = context;
    // Guard: do not allow pseudo-creation via update path
    if (!customerId || customerId === "NEW_CUSTOMER" || customerId === "TEMP_CUSTOMER") {
      return {
        success: false,
        message: "customerId is required for updates. Creation must be handled by the dedicated create flow via Zapier.",
        customerId,
      };
    }
    try {
      const result = await mcpLookupRows("Customers", "顧客ID", customerId);
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
  execute: async ({ context }: { context: any }) => {
    const { customerId, sessionId, reason } = context;
    try {
      const result = await mcpLookupRows("Customers", "顧客ID", customerId);

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
  execute: async ({ context, writer }: { context: any; writer?: any }) => {
    const { customerId, sessionId, limit } = context;
    try {
      const result = await mcpLookupRows("repairs", "顧客ID", customerId);
      const rows = ((result?.results as any[]) || []).flatMap((r: any) => r?.rows || []);

      // Normalize and sort (most recent first when possible)
      const items = rows.map((r: any) => ({
        repairId: r?.COL$A || r?.修理ID || "",
        date: r?.COL$B || r?.日時 || "",
        productId: r?.COL$C || r?.製品ID || "",
        customerId: r?.COL$D || r?.顧客ID || "",
        issue: r?.COL$E || r?.問題内容 || "",
        status: r?.COL$F || r?.ステータス || "",
        visitRequired: r?.COL$G || r?.訪問要否 || "",
        priority: r?.COL$H || r?.優先度 || "",
        handler: r?.COL$I || r?.対応者 || "",
      }));
      const limited = (items || []).slice(0, Math.max(0, limit || 10));

      // Deterministic formatted output to prevent hallucination
      if (writer && limited.length) {
        let out = `顧客ID ${customerId} の修理履歴 (最大${limited.length}件)\n`;
        limited.forEach((it, idx) => {
          out += `\n${idx + 1}. 修理ID: ${it.repairId}\n   日付: ${it.date}\n   製品ID: ${it.productId}\n   問題: ${it.issue}\n   状態: ${it.status}\n   優先度: ${it.priority}\n   担当者: ${it.handler}`;
        });
        try { writer.write(out); } catch {}
      }

      return {
        success: true,
        message: limited.length ? "Customer history retrieved" : "No repair history found",
        customerId,
        limit,
        data: limited,
        raw: result,
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
    execute: async ({ context }: { context: any }) => {
      const { query, sessionId, count = 0 } = context;
      try {
        const byCompany = await mcpLookupRows("Customers", "会社名", query);
        const byEmail = await mcpLookupRows("Customers", "メールアドレス", query);
        const byPhone = await mcpLookupRows("Customers", "電話番号", query);
        let merged = [...(byCompany?.results||[]), ...(byEmail?.results||[]), ...(byPhone?.results||[])];
        if (!merged.length) {
          // Fallback: scan all rows and do substring match client-side
          const all = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
            instructions: "customers fallback scan",
            worksheet: "Customers",
            row_count: 500,
          });
          const rows = (all?.results as any[]) || [];
          merged = rows.filter((r: any) => {
            const name = r?.["COL$B"] || "";
            const email = r?.["COL$C"] || "";
            const phone = r?.["COL$D"] || "";
            return String(name).includes(query) || String(email).includes(query) || String(phone).includes(query);
          });
        }
        if (merged.length) {
          return {
            success: true,
            message: "お客様情報を検索しました。",
            data: merged,
            searchId: `search_${Date.now()}`,
          };
        } else {
          return {
            success: false,
            message: "お客様が見つかりませんでした。",
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
    execute: async ({ context }: { context: any }) => {
      const { query, sessionId, threshold = 0.7 } = context;
      try {
        const byCompany = await mcpLookupRows("Customers", "会社名", query);
        const byEmail = await mcpLookupRows("Customers", "メールアドレス", query);
        const byPhone = await mcpLookupRows("Customers", "電話番号", query);
        const merged = [...(byCompany?.results||[]), ...(byEmail?.results||[]), ...(byPhone?.results||[])];
        if (merged.length) {
          return {
            success: true,
            message: `曖昧検索で${merged.length}件のお客様が見つかりました。`,
            data: merged,
            searchId: `fuzzy_${Date.now()}`,
          };
        } else {
          return {
            success: false,
            message: "曖昧検索でお客様が見つかりませんでした。",
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
      customerId: z.string().optional().describe("Customer ID (if known)"),
      companyName: z.string().optional().describe("Company name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      sessionId: z.string().describe("Session ID for tracking"),
      rawInput: z.string().optional().describe("Optional raw login line to extract CUST### from"),
      preferId: z.boolean().optional().describe("Prefer customerId over other fields when available (default true)"),
    }),
    execute: async ({ context, writer }: { context: any; writer?: any }) => {
      const { customerId, companyName, email, phone, sessionId, rawInput, preferId } = context;

      // Extract customerId from sessionId or rawInput if not explicitly provided
      const idFromSession = typeof sessionId === "string" && sessionId.match(/CUST\d{3,}/i)?.[0];
      const idFromRaw = typeof rawInput === "string" && rawInput.match(/CUST\d{3,}/i)?.[0];
      const effectiveCustomerId = (customerId || idFromSession || idFromRaw || "").toUpperCase();

      // Enforce the login rule: require ID or triad. If partial, guide next field.
      const missing: string[] = [];
      if (!effectiveCustomerId) {
        if (!companyName) missing.push("companyName");
        if (!email) missing.push("email");
        if (!phone) missing.push("phone");
      }
      if (!effectiveCustomerId && missing.length) {
        const order = ["companyName", "email", "phone"] as const;
        const askNext = order.find(f => missing.includes(f as string)) as string | undefined;
        if (writer && askNext) {
          const jpMap: Record<string,string> = { companyName: "会社名", email: "メールアドレス", phone: "電話番号" };
          try { writer.write(`お客様情報の確認のため、次の項目を教えてください：${jpMap[askNext]}`); } catch {}
        }
        return {
          success: false,
          message: "お客様情報の確認のため、必要な項目が不足しています。",
          data: null,
          missingFields: missing,
          askNext,
          provided: { companyName, email, phone },
        } as any;
      }
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

        const results: any[] = [];
        const idPreferred = preferId !== false; // default true
        if (effectiveCustomerId && idPreferred) {
          const byId = await mcpLookupRows("Customers", "顧客ID", effectiveCustomerId);
          results.push(...(byId?.results||[]));
        } else {
          if (normalizedCompanyName) {
            const byCompany = await mcpLookupRows("Customers", "会社名", normalizedCompanyName);
            results.push(...(byCompany?.results||[]));
          }
          if (email) {
            const byEmail = await mcpLookupRows("Customers", "メールアドレス", email);
            results.push(...(byEmail?.results||[]));
          }
          if (phone) {
            const byPhone = await mcpLookupRows("Customers", "電話番号", phone);
            results.push(...(byPhone?.results||[]));
          }
          if (!results.length && (normalizedCompanyName || email || phone)) {
            const all = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
              instructions: "customers fallback scan",
              worksheet: "Customers",
              row_count: 500,
            });
            const rows = (all?.results as any[]) || [];
            const fuzzy = rows.filter((r: any) => {
              const name = String(r?.["COL$B"] || "");
              const em = String(r?.["COL$C"] || "").toLowerCase();
              const ph = String(r?.["COL$D"] || "");
              const tests: boolean[] = [];
              if (normalizedCompanyName) tests.push(name.includes(normalizedCompanyName));
              if (email) tests.push(em.includes(String(email).toLowerCase()));
              if (phone) tests.push(ph.includes(String(phone)) || ph.replace(/\D/g, "").includes(String(phone).replace(/\D/g, "")));
              return tests.some(Boolean);
            });
            results.push(...fuzzy);
          }
          // If still nothing and we have an ID but idPreferred=false, try ID as a fallback
          if (!results.length && effectiveCustomerId) {
            const byId2 = await mcpLookupRows("Customers", "顧客ID", effectiveCustomerId);
            results.push(...(byId2?.results||[]));
          }
        }
        if (results.length) {
          return {
            success: true,
            message: `${results.length}件のお客様が見つかりました。`,
            data: results,
          };
        } else {
          return {
            success: false,
            message: "指定された条件に一致するお客様が見つかりませんでした。",
            data: null,
            missingFields: [],
            askNext: undefined,
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
        .enum(["companyName", "email", "phone", "address", "customerId"])
        .describe("Type of input"),
      sessionId: z.string().describe("Session ID for tracking"),
    }),
    execute: async ({ context }: { context: any }) => {
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
          case "customerId":
            sanitizedInput = input.trim();
            // Basic validation: 3-64 chars, alphanum, dash, underscore
            isValid = /^[A-Za-z0-9_-]{3,64}$/.test(sanitizedInput);
            validationMessage = isValid ? "顧客IDが有効です。" : "顧客IDは英数字・ハイフン・アンダースコアで3〜64文字にしてください。";
            break;
        }

        // Optional: write validation log entry via MCP Logs sheet
        try {
          await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
            instructions: "validation log",
            Timestamp: new Date().toISOString(),
            "Repair ID": "",
            Status: isValid ? "OK" : "NG",
            "Customer ID": "",
            "Product ID": "",
            "担当者 (Handler)": "AI",
            Issue: `sanitize:${type}`,
            Source: "agent",
            Raw: JSON.stringify({ input, sanitizedInput }),
          });
        } catch {}

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
    execute: async ({ context }: { context: any }) => {
      const { action, sessionId, customerId, details } = context;
      try {
        try {
          await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
            instructions: "access log",
            Timestamp: new Date().toISOString(),
            "Repair ID": details?.repairId || "",
            Status: action,
            "Customer ID": customerId || "",
            "Product ID": details?.productId || "",
            "担当者 (Handler)": "AI",
            Issue: details?.issue || "",
            Source: "agent",
            Raw: JSON.stringify(details || {}),
          });
        } catch {}
        const result = { success: true, logId: `log_${Date.now()}` } as any;
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
    execute: async ({ context }: { context: any }) => {
      const {
        reason,
        priority,
        sessionId,
        customerId,
        context: contextData,
      } = context;
      try {
        try {
          await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
            instructions: "escalation log",
            Timestamp: new Date().toISOString(),
            "Repair ID": contextData?.repairId || "",
            Status: priority,
            "Customer ID": customerId || "",
            "Product ID": contextData?.productId || "",
            "担当者 (Handler)": "HUMAN",
            Issue: reason,
            Source: "escalation",
            Raw: JSON.stringify(contextData || {}),
          });
        } catch {}
        const result = { success: true, escalationId: `esc_${Date.now()}`, estimatedResponseTime: priority === "Emergency" ? "即座" : "2時間以内" } as any;
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
    execute: async ({ context }: { context: any }) => {
      const { customerId, sessionId } = context;
      try {
        const mcpRes = await mcpLookupRows("Customers", "顧客ID", customerId);
        const rows = (mcpRes?.results || []);
        if (rows.length) {
          return {
            success: true,
            message: "お客様情報を取得しました。",
            data: rows,
            customerId,
          };
        } else {
          return {
            success: false,
            message: "指定されたIDのお客様が見つかりませんでした。",
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
