import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";
import { sharedMastraMemory } from "../../shared-memory";

export const createSchedulingEntry = createTool({
  id: "google_sheets_create_spreadsheet_row",
  description: "Create a new scheduling entry in Google Sheets",
  inputSchema: z.object({
    customerId: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    productId: z.string().optional(),
    productCategory: z.string().optional(),
    model: z.string().optional(),
    serialNumber: z.string().optional(),
    warrantyStatus: z.string().optional(),
    repairId: z.string().optional(),
    scheduledDateTime: z.string().optional(),
    issueDescription: z.string().optional(),
    status: z.string().optional(),
    visitRequired: z.string().optional(),
    priority: z.string().optional(),
    technician: z.string().optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const appointmentData = context;
    
    // If appointmentData is missing customer info, try to get it from session context
    if (!appointmentData?.customerId) {
      try {
        // Try to get customer data from session context first
        let customerId = appointmentData?.customerId;
        let storeName = appointmentData?.companyName;
        let email = appointmentData?.email;
        let phone = appointmentData?.phone;
        let location = appointmentData?.location;
        
        // If session data is available in context, use it
        if (context.session && context.session.customerId) {
          customerId = context.session.customerId;
          storeName = context.session.customerProfile?.storeName;
          email = context.session.customerProfile?.email;
          phone = context.session.customerProfile?.phone;
          location = context.session.customerProfile?.location;
          console.log(`🔍 [DEBUG] Retrieved customer data from session context:`, {
            customerId, storeName, email, phone, location
          });
        } else {
          // Fallback to shared memory
          customerId = sharedMastraMemory.get("customerId");
          storeName = sharedMastraMemory.get("storeName");
          email = sharedMastraMemory.get("email");
          phone = sharedMastraMemory.get("phone");
          location = sharedMastraMemory.get("location");
          console.log(`🔍 [DEBUG] Retrieved customer data from shared memory:`, {
            customerId, storeName, email, phone, location
          });
        }
        
        if (customerId) {
          // Enhance appointmentData with customer data
          Object.assign(appointmentData, {
            customerId: appointmentData?.customerId || customerId,
            companyName: appointmentData?.companyName || storeName,
            email: appointmentData?.email || email,
            phone: appointmentData?.phone || phone,
            location: appointmentData?.location || location,
          });
        }
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer data for scheduling:`, error);
      }
    }

    try {
      // Use the correct tool format as shown in the example
      const result = await zapierMcp.callTool("google_sheets_create_spreadsheet_row_at_top", {
        instructions: `Create repair scheduling log entry for ${appointmentData?.customerId || 'CUSTOMER'}`,
        "COL__DOLLAR__A": appointmentData?.customerId || "",
        "COL__DOLLAR__B": appointmentData?.companyName || "",
        "COL__DOLLAR__C": appointmentData?.email || "",
        "COL__DOLLAR__D": appointmentData?.phone || "",
        "COL__DOLLAR__E": appointmentData?.location || "",
        "COL__DOLLAR__F": appointmentData?.productId || "",
        "COL__DOLLAR__G": appointmentData?.productCategory || "",
        "COL__DOLLAR__H": appointmentData?.model || "",
        "COL__DOLLAR__I": appointmentData?.serialNumber || "",
        "COL__DOLLAR__J": appointmentData?.warrantyStatus || "",
        "COL__DOLLAR__K": appointmentData?.repairId || "",
        "COL__DOLLAR__L": appointmentData?.scheduledDateTime || "",
        "COL__DOLLAR__M": appointmentData?.issueDescription || "",
        "COL__DOLLAR__N": appointmentData?.status || "未対応",
        "COL__DOLLAR__O": appointmentData?.visitRequired || "要",
        "COL__DOLLAR__P": appointmentData?.priority || "中",
        "COL__DOLLAR__Q": appointmentData?.technician || "AI",
        "COL__DOLLAR__R": appointmentData?.notes || "",
        "COL__DOLLAR__S": appointmentData?.technician || "担当者",
        "COL__DOLLAR__T": appointmentData?.phone || "",
        "COL__DOLLAR__U": appointmentData?.scheduledDateTime || "",
        "COL__DOLLAR__V": appointmentData?.model || "",
      });
      
      console.log(`✅ [DEBUG] Created scheduling log entry:`, JSON.stringify(result, null, 2));
      
      // Also create calendar event
      try {
        const calendarResult = await zapierMcp.callTool("google_calendar_quick_add_event", {
          instructions: `Schedule repair appointment for ${appointmentData?.companyName || 'Customer'}`,
          text: `Repair appointment for ${appointmentData?.companyName || 'Customer'} - ${appointmentData?.model || 'Machine'} on ${appointmentData?.scheduledDateTime || 'scheduled date'}`,
        });
        console.log(`✅ [DEBUG] Created calendar event:`, JSON.stringify(calendarResult, null, 2));
      } catch (calendarError) {
        console.error("Calendar event creation failed:", calendarError);
      }
      
      return { 
        success: true, 
        data: { ...appointmentData, logEntry: result }, 
        message: `予約を作成しました。予約ID: ${appointmentData?.repairId || 'N/A'}` 
      };
      
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in createSchedulingEntry:`, error);
      return { 
        success: false, 
        data: null, 
        message: `Scheduling operation failed: ${error.message}` 
      };
    }
  },
});

export const googleSheetsCreateRow = createTool({
  id: "google_sheets_create_spreadsheet_row",
  description: "Create a new row in Google Sheets (Logs, Repairs, Customers, Products worksheets)",
  inputSchema: z.object({
    instructions: z.string().describe("Instructions for creating the row"),
    worksheet: z.string().describe("Worksheet name: Logs, Repairs, Customers, or Products"),
    "COL__DOLLAR__A": z.string().optional().describe("顧客ID"),
    "COL__DOLLAR__B": z.string().optional().describe("会社名"),
    "COL__DOLLAR__C": z.string().optional().describe("メールアドレス"),
    "COL__DOLLAR__D": z.string().optional().describe("電話番号"),
    "COL__DOLLAR__E": z.string().optional().describe("所在地"),
    "COL__DOLLAR__F": z.string().optional().describe("製品ID"),
    "COL__DOLLAR__G": z.string().optional().describe("製品カテゴリ"),
    "COL__DOLLAR__H": z.string().optional().describe("型式"),
    "COL__DOLLAR__I": z.string().optional().describe("シリアル番号"),
    "COL__DOLLAR__J": z.string().optional().describe("保証状況"),
    "COL__DOLLAR__K": z.string().optional().describe("Repair ID"),
    "COL__DOLLAR__L": z.string().optional().describe("日時"),
    "COL__DOLLAR__M": z.string().optional().describe("問題内容"),
    "COL__DOLLAR__N": z.string().optional().describe("ステータス"),
    "COL__DOLLAR__O": z.string().optional().describe("訪問要否"),
    "COL__DOLLAR__P": z.string().optional().describe("優先度"),
    "COL__DOLLAR__Q": z.string().optional().describe("対応者"),
    "COL__DOLLAR__R": z.string().optional().describe("備考"),
    "COL__DOLLAR__S": z.string().optional().describe("Name"),
    "COL__DOLLAR__T": z.string().optional().describe("phone"),
    "COL__DOLLAR__U": z.string().optional().describe("date"),
    "COL__DOLLAR__V": z.string().optional().describe("machine"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const result = await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: context.instructions,
        worksheet: context.worksheet || "Logs",
        "COL__DOLLAR__A": context["COL__DOLLAR__A"],
        "COL__DOLLAR__B": context["COL__DOLLAR__B"],
        "COL__DOLLAR__C": context["COL__DOLLAR__C"],
        "COL__DOLLAR__D": context["COL__DOLLAR__D"],
        "COL__DOLLAR__E": context["COL__DOLLAR__E"],
        "COL__DOLLAR__F": context["COL__DOLLAR__F"],
        "COL__DOLLAR__G": context["COL__DOLLAR__G"],
        "COL__DOLLAR__H": context["COL__DOLLAR__H"],
        "COL__DOLLAR__I": context["COL__DOLLAR__I"],
        "COL__DOLLAR__J": context["COL__DOLLAR__J"],
        "COL__DOLLAR__K": context["COL__DOLLAR__K"],
        "COL__DOLLAR__L": context["COL__DOLLAR__L"],
        "COL__DOLLAR__M": context["COL__DOLLAR__M"],
        "COL__DOLLAR__N": context["COL__DOLLAR__N"],
        "COL__DOLLAR__O": context["COL__DOLLAR__O"],
        "COL__DOLLAR__P": context["COL__DOLLAR__P"],
        "COL__DOLLAR__Q": context["COL__DOLLAR__Q"],
        "COL__DOLLAR__R": context["COL__DOLLAR__R"],
        "COL__DOLLAR__S": context["COL__DOLLAR__S"],
        "COL__DOLLAR__T": context["COL__DOLLAR__T"],
        "COL__DOLLAR__U": context["COL__DOLLAR__U"],
        "COL__DOLLAR__V": context["COL__DOLLAR__V"],
      });
      console.log(`✅ [DEBUG] Created Google Sheets row in ${context.worksheet || "Logs"} worksheet:`, JSON.stringify(result, null, 2));
      return { 
        success: true, 
        data: result, 
        message: `Google Sheets row created successfully in ${context.worksheet || "Logs"} worksheet` 
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error creating Google Sheets row:`, error);
      return { 
        success: false, 
        data: null, 
        message: `Google Sheets creation failed: ${error.message}` 
      };
    }
  },
});

export const googleSheetsUpdateRow = createTool({
  id: "google_sheets_update_spreadsheet_row_s",
  description: "Update existing rows in Google Sheets Logs worksheet",
  inputSchema: z.object({
    instructions: z.string().describe("Instructions for updating the row"),
    row_number: z.string().optional().describe("Row number to update (defaults to 2)"),
    "COL__DOLLAR__A": z.string().optional().describe("顧客ID"),
    "COL__DOLLAR__B": z.string().optional().describe("会社名"),
    "COL__DOLLAR__C": z.string().optional().describe("メールアドレス"),
    "COL__DOLLAR__D": z.string().optional().describe("電話番号"),
    "COL__DOLLAR__E": z.string().optional().describe("所在地"),
    "COL__DOLLAR__F": z.string().optional().describe("製品ID"),
    "COL__DOLLAR__G": z.string().optional().describe("製品カテゴリ"),
    "COL__DOLLAR__H": z.string().optional().describe("型式"),
    "COL__DOLLAR__I": z.string().optional().describe("シリアル番号"),
    "COL__DOLLAR__J": z.string().optional().describe("保証状況"),
    "COL__DOLLAR__K": z.string().optional().describe("Repair ID"),
    "COL__DOLLAR__L": z.string().optional().describe("日時"),
    "COL__DOLLAR__M": z.string().optional().describe("問題内容"),
    "COL__DOLLAR__N": z.string().optional().describe("ステータス"),
    "COL__DOLLAR__O": z.string().optional().describe("訪問要否"),
    "COL__DOLLAR__P": z.string().optional().describe("優先度"),
    "COL__DOLLAR__Q": z.string().optional().describe("対応者"),
    "COL__DOLLAR__R": z.string().optional().describe("備考"),
    "COL__DOLLAR__S": z.string().optional().describe("Name"),
    "COL__DOLLAR__T": z.string().optional().describe("phone"),
    "COL__DOLLAR__U": z.string().optional().describe("date"),
    "COL__DOLLAR__V": z.string().optional().describe("machine"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const result = await zapierMcp.callTool("google_sheets_update_spreadsheet_row_s", context);
      console.log(`✅ [DEBUG] Updated Google Sheets row:`, JSON.stringify(result, null, 2));
      return { 
        success: true, 
        data: result, 
        message: `Google Sheets row updated successfully` 
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error updating Google Sheets row:`, error);
      return { 
        success: false, 
        data: null, 
        message: `Google Sheets update failed: ${error.message}` 
      };
    }
  },
});

export const googleCalendarAddEvent = createTool({
  id: "google_calendar_quick_add_event",
  description: "Add a new event to Google Calendar",
  inputSchema: z.object({
    instructions: z.string().describe("Instructions for creating the calendar event"),
    text: z.string().describe("Event description text"),
    attendees: z.string().optional().describe("Event attendees"),
    calendarid: z.string().optional().describe("Calendar ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const result = await zapierMcp.callTool("google_calendar_quick_add_event", context);
      console.log(`✅ [DEBUG] Created calendar event:`, JSON.stringify(result, null, 2));
      return { 
        success: true, 
        data: result, 
        message: `Calendar event created successfully` 
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error creating calendar event:`, error);
      return { 
        success: false, 
        data: null, 
        message: `Calendar event creation failed: ${error.message}` 
      };
    }
  },
});

// ... existing code ...

export const schedulingTools = {
  createSchedulingEntry,
  googleSheetsCreateRow,
  googleSheetsUpdateRow,
  googleCalendarAddEvent,
};
