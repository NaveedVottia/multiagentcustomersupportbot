import { zapierMcp } from "../../integrations/zapier-mcp.js";

// Google Sheets Tools
export const googleSheetsLookupRows = async (params: {
  spreadsheet_id: string;
  worksheet_name: string;
  filters: Record<string, any>;
}) => {
  return await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", params);
};

export const googleSheetsGetManyRows = async (params: {
  spreadsheet_id: string;
  worksheet_name: string;
  filters?: Record<string, any>;
  limit?: number;
}) => {
  return await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", params);
};

export const googleSheetsCreateRow = async (params: {
  spreadsheet_id: string;
  worksheet_name: string;
  row_data: Record<string, any>;
}) => {
  return await zapierMcp.callTool("google_sheets_create_spreadsheet_row", params);
};

export const googleSheetsUpdateRow = async (params: {
  spreadsheet_id: string;
  worksheet_name: string;
  row_id: string;
  row_data: Record<string, any>;
}) => {
  return await zapierMcp.callTool("google_sheets_update_spreadsheet_row", params);
};

export const googleSheetsFindWorksheet = async (params: {
  spreadsheet_id: string;
  worksheet_name?: string;
}) => {
  return await zapierMcp.callTool("google_sheets_find_worksheet", params);
};

// Google Calendar Tools
export const googleCalendarQuickAddEvent = async (params: {
  calendar_id: string;
  event_text: string;
  date?: string;
  time?: string;
}) => {
  return await zapierMcp.callTool("google_calendar_quick_add_event", params);
};

// Slack Tools
export const slackSendDirectMessage = async (params: {
  user_id: string;
  message: string;
  thread_ts?: string;
}) => {
  return await zapierMcp.callTool("slack_send_direct_message", params);
};

// AI Content Extraction Tool
export const aiExtractContentFromUrl = async (params: {
  url: string;
  extraction_type?: string;
  instructions?: string;
}) => {
  return await zapierMcp.callTool("ai_by_zapier_extract_content_from_url_beta", params);
};

// Helper function to get available tools
export const getAvailableZapierTools = async () => {
  try {
    // This would require exposing the toolset from the ZapierMcpClient
    // For now, return the known tool names
    return [
      "google_sheets_lookup_spreadsheet_rows_advanced",
      "google_sheets_get_many_spreadsheet_rows_advanced", 
      "google_sheets_create_spreadsheet_row",
      "google_sheets_update_spreadsheet_row",
      "google_sheets_find_worksheet",
      "google_calendar_quick_add_event",
      "slack_send_direct_message",
      "ai_by_zapier_extract_content_from_url_beta"
    ];
  } catch (error) {
    console.error("Error getting available Zapier tools:", error);
    return [];
  }
};

// Export all tools for easy access
export const zapierTools = {
  // Google Sheets
  lookupRows: googleSheetsLookupRows,
  getManyRows: googleSheetsGetManyRows,
  createRow: googleSheetsCreateRow,
  updateRow: googleSheetsUpdateRow,
  findWorksheet: googleSheetsFindWorksheet,
  
  // Google Calendar
  quickAddEvent: googleCalendarQuickAddEvent,
  
  // Slack
  sendDirectMessage: slackSendDirectMessage,
  
  // AI Content Extraction
  extractContentFromUrl: aiExtractContentFromUrl,
  
  // Utility
  getAvailableTools: getAvailableZapierTools
};
