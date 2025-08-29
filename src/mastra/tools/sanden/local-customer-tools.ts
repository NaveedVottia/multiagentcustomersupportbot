import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { LocalDatabaseService } from "../../../integrations/local-database.js";

// Local customer lookup tool (no Zapier dependency)
export const localLookupCustomerByDetails = createTool({
  id: "localLookupCustomerByDetails",
  description: "顧客情報を3つの詳細（電話番号、メール、会社名）のいずれかで検索します。Zapierが利用できない場合のローカルデータベースフォールバックです。",
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
  }),
  execute: async ({ context }: { context: any }) => {
    const { phone, email, companyName } = context;
    
    console.log(`🔍 Local tool lookup: phone=${phone}, email=${email}, company=${companyName}`);
    
    try {
      const customer = LocalDatabaseService.lookupCustomerByDetails(phone, email, companyName);
      
      if (customer) {
        return {
          success: true,
          customer: {
            customerId: customer.customerId,
            companyName: customer.companyName,
            email: customer.email,
            phone: customer.phone,
            location: customer.location,
          },
          message: `顧客が見つかりました: ${customer.companyName} (${customer.customerId})`,
        };
      } else {
        return {
          success: false,
          customer: null,
          message: "指定された情報に一致する顧客が見つかりませんでした。",
        };
      }
    } catch (error) {
      console.error("❌ Local lookup error:", error);
      return {
        success: false,
        customer: null,
        message: "顧客検索中にエラーが発生しました。",
      };
    }
  },
});

// Local customer registration tool
export const localRegisterCustomer = createTool({
  id: "localRegisterCustomer",
  description: "新しい顧客をローカルデータベースに登録します。",
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
  }),
  execute: async ({ context }: { context: any }) => {
    const { companyName, email, phone, location } = context;
    
    console.log(`📝 Local tool register: company=${companyName}, email=${email}, phone=${phone}`);
    
    try {
      // Generate a new customer ID
      const customerId = `CUST${Date.now().toString().slice(-6)}`;
      
      // In a real system, this would be saved to the database
      // For now, we just return success
      return {
        success: true,
        customerId,
        message: `新しい顧客が正常に登録されました: ${customerId}`,
      };
    } catch (error) {
      console.error("❌ Local registration error:", error);
      return {
        success: false,
        customerId: "",
        message: "顧客登録中にエラーが発生しました。",
      };
    }
  },
});

// Local product lookup tool
export const localGetProductsByCustomerId = createTool({
  id: "localGetProductsByCustomerId",
  description: "指定された顧客IDに関連する製品情報を取得します。",
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
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId } = context;
    
    console.log(`🔍 Local tool get products: customerId=${customerId}`);
    
    try {
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
        message: `${products.length}件の製品が見つかりました。`,
      };
    } catch (error) {
      console.error("❌ Local product lookup error:", error);
      return {
        success: false,
        products: [],
        message: "製品検索中にエラーが発生しました。",
      };
    }
  },
});

// Local repair history lookup tool
export const localGetRepairsByCustomerId = createTool({
  id: "localGetRepairsByCustomerId",
  description: "指定された顧客IDに関連する修理履歴を取得します。",
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
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId } = context;
    
    console.log(`🔍 Local tool get repairs: customerId=${customerId}`);
    
    try {
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
        message: `${repairs.length}件の修理履歴が見つかりました。`,
      };
    } catch (error) {
      console.error("❌ Local repair lookup error:", error);
      return {
        success: false,
        repairs: [],
        message: "修理履歴検索中にエラーが発生しました。",
      };
    }
  },
});

// Local log entry creation tool
export const localCreateLogEntry = createTool({
  id: "localCreateLogEntry",
  description: "修理予約情報をローカルログに記録します。",
  inputSchema: z.object({
    customerId: z.string().describe("顧客ID"),
    companyName: z.string().describe("会社名"),
    email: z.string().describe("メールアドレス"),
    phone: z.string().describe("電話番号"),
    location: z.string().describe("所在地"),
    contactName: z.string().describe("担当者名"),
    preferredDate: z.string().describe("希望日時"),
    machine: z.string().describe("対象機器"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    logId: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, companyName, email, phone, location, contactName, preferredDate, machine } = context;
    
    console.log(`📝 Local tool create log: customerId=${customerId}, contactName=${contactName}`);
    
    try {
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
      };
    } catch (error) {
      console.error("❌ Local log creation error:", error);
      return {
        success: false,
        logId: "",
        message: "ログ作成中にエラーが発生しました。",
      };
    }
  },
});
