import { createTool } from "@mastra/core/tools";
import { langfuse } from "../../../integrations/langfuse";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp";

let mastraInstance: any;

export function setMastraInstance(instance: any) {
  mastraInstance = instance;
}

// SANITIZATION HELPER - Remove CUSTOMER_DATA_* markers and sensitive data
const sanitizeResponse = (text: string): string => {
  return text
    .replace(/CUSTOMER_DATA_START[\s\S]*?CUSTOMER_DATA_END/g, '')
    .replace(/CUSTOMER_DATA_\w+/g, '')
    .replace(/CUSTOMER_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

function getArgs<T = any>(args: any): T {
  // Accept tool args from multiple shapes: {input}, {context}, or top-level
  const inputPart = (args && typeof args === "object" ? args.input : undefined) || {};
  const contextPart = (args && typeof args === "object" ? args.context : undefined) || {};
  const topLevelPart: Record<string, any> = {};
  if (args && typeof args === "object") {
    for (const [key, value] of Object.entries(args)) {
      if (key === "writer" || key === "mastra" || key === "input" || key === "context") continue;
      topLevelPart[key] = value;
    }
  }
  const payload = { ...topLevelPart, ...contextPart, ...inputPart };
  return payload as T;
}

function extractDataFromResponse(response: string, dataType: string): any {
  const startTag = `${dataType}_DATA_START`;
  const endTag = `${dataType}_DATA_END`;
  const startIndex = response.indexOf(startTag);
  const endIndex = response.indexOf(endTag);
  if (startIndex !== -1 && endIndex !== -1) {
    const jsonStr = response.substring(startIndex + startTag.length, endIndex).trim();
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
  return null;
}

type ToolExecuteArgs = { input?: any; context?: any; writer?: any; mastra?: any };

export const delegateTo = createTool({
  id: "delegateTo",
  description: "Delegates to another agent and pipes their stream back",
  // Accept both strict and loose calls; default to customer-identification
  inputSchema: z.object({ agentId: z.string().optional(), message: z.string().optional(), context: z.record(z.any()).optional() }),
  outputSchema: z.object({ ok: z.boolean(), agentId: z.string(), extractedData: z.any().optional() }),
  async execute(args: ToolExecuteArgs) {
    const { writer, mastra } = args as any;
    const parsed = getArgs(args) as { agentId?: string; message?: string; context?: Record<string, any> };
    const agentId = parsed.agentId || "routing-agent-customer-identification";
    const agentContext = parsed.context;
    const message = parsed.message || "顧客情報の確認をお願いします。";
    const traceId = await langfuse.startTrace("tool.delegateTo", { agentId, hasContext: !!agentContext });
    try {
      const instance = (mastra as any) || mastraInstance;
      const agent = instance?.getAgentById ? instance.getAgentById(agentId) : instance?.agents?.[agentId];
      if (!agent) throw new Error(`agent_not_found:${agentId}`);
      const messages = [
        { role: "system", content: `Context: ${JSON.stringify(agentContext || {})}` },
        { role: "user", content: message },
      ];
      const stream = await agent.stream(messages);
      let fullResponse = "";
      if (stream) {
        for await (const chunk of stream.textStream) {
          // SANITIZE CHUNKS BEFORE WRITING TO UI
          let sanitizedChunk = chunk;
          if (typeof chunk === "string") {
            sanitizedChunk = sanitizeResponse(chunk);
            fullResponse += chunk; // Keep original for data extraction
          }
          
          if (writer) writer.write(sanitizedChunk);
        }
      }
      let extractedData = null;
      if (agentId === "routing-agent-customer-identification") extractedData = extractDataFromResponse(fullResponse, "CUSTOMER");
      else if (agentId === "repair-agent-product-selection") extractedData = extractDataFromResponse(fullResponse, "PRODUCT");
      else if (agentId === "repair-qa-agent-issue-analysis") extractedData = extractDataFromResponse(fullResponse, "ISSUE");
      else if (agentId === "repair-visit-confirmation-agent") extractedData = extractDataFromResponse(fullResponse, "REPAIR");
      
      // Automatically log customer data when extracted
      if (extractedData && agentId === "routing-agent-customer-identification") {
        try {
          const instance = (mastra as any) || mastraInstance;
          if (instance?.tools?.logCustomerData) {
            await instance.tools.logCustomerData.execute({ customerData: extractedData, source: "customer-identification" });
          }
          
          // Also try to look up real customer data from database if store name is mentioned
          if (extractedData.storeName || extractedData.name) {
            try {
              if (instance?.tools?.lookupCustomerFromDatabase) {
                const lookupResult = await instance.tools.lookupCustomerFromDatabase.execute({ 
                  storeName: extractedData.storeName || extractedData.name,
                  searchType: "store_name"
                });
                
                if (lookupResult.found && lookupResult.customerData) {
                  console.log("Found real customer data from database:", lookupResult.customerData);
                  // Replace the fake data with real data
                  extractedData = { ...extractedData, ...lookupResult.customerData };
                }
              }
            } catch (error) {
              console.error("Failed to lookup customer data from database:", error);
            }
          }
        } catch (error) {
          console.error("Failed to auto-log customer data:", error);
        }
      }
      
      await langfuse.logToolExecution(traceId, "delegateTo", { agentId, messageLength: message?.length || 0 }, { ok: true, agentId, extractedData }, { extractedKeys: extractedData ? Object.keys(extractedData) : [] });
      await langfuse.endTrace(traceId, { success: true });
      return { ok: true, agentId, extractedData };
    } catch (error) {
      // Do not stream internal errors to user; return neutral failure
      await langfuse.logToolExecution(null, "delegateTo", { agentId }, { ok: false }, { error: String(error) });
      await langfuse.endTrace(null, { success: false });
      return { ok: false, agentId, extractedData: null as any };
    }
  },
});

export const escalateToHuman = createTool({
  id: "escalateToHuman",
  description: "Escalate to human support for emergency or complex issues",
  inputSchema: z.object({ reason: z.string(), priority: z.enum(["Low", "Medium", "High", "Emergency"]), context: z.record(z.any()).optional() }),
  outputSchema: z.object({ success: z.boolean(), escalationId: z.string().optional(), message: z.string().optional() }),
  async execute(args: ToolExecuteArgs) {
    const { reason, priority, context } = getArgs(args) as { reason: string; priority: "Low"|"Medium"|"High"|"Emergency"; context?: any };
    const traceId = await langfuse.startTrace("tool.escalateToHuman", { priority });
    if (priority !== "Emergency") {
      // Return neutral success; agent will phrase user-facing message
      const res = { success: true, escalationId: `DELEGATE-${Date.now()}`, message: "" };
      await langfuse.logToolExecution(traceId, "escalateToHuman", { reason, priority }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    }
    const escalationId = `ESC-${Date.now()}`;
    try {
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "orchestrator escalation log",
        Timestamp: new Date().toISOString(),
        "Repair ID": context?.repairId || "",
        Status: priority,
        "Customer ID": context?.customerId || "",
        "Product ID": context?.productId || "",
        "担当者 (Handler)": "HUMAN",
        Issue: reason,
        Source: "orchestrator",
        Raw: JSON.stringify(context || {}),
      });
    } catch {}
    const out = { success: true, escalationId, message: "" };
    await langfuse.logToolExecution(traceId, "escalateToHuman", { reason, priority }, out);
    await langfuse.endTrace(traceId, { success: true });
    return out;
  },
});

export const validateContext = createTool({
  id: "validateContext",
  description: "Validate workflow context structure",
  inputSchema: z.object({ context: z.record(z.any()), requiredFields: z.array(z.string()).optional(), schema: z.string().optional() }),
  outputSchema: z.object({ isValid: z.boolean(), missingFields: z.array(z.string()), message: z.string() }),
  async execute(args: ToolExecuteArgs) {
    const { context, requiredFields, schema } = getArgs(args) as { context: any; requiredFields?: string[]; schema?: string };
    const traceId = await langfuse.startTrace("tool.validateContext");
    if (schema) return { isValid: true, missingFields: [], message: "ok" };
    const missing: string[] = [];
    for (const field of requiredFields || []) {
      const keys = field.split('.');
      let value: any = context;
      for (const key of keys) value = value?.[key];
      if (value === undefined || value === null) missing.push(field);
    }
    const res = { isValid: missing.length === 0, missingFields: missing, message: missing.length === 0 ? "ok" : "missing" };
    await langfuse.logToolExecution(traceId, "validateContext", { requiredFields }, res);
    await langfuse.endTrace(traceId, { success: true });
    return res;
  },
});

export const updateWorkflowState = createTool({
  id: "updateWorkflowState",
  description: "Update workflow state with new data",
  inputSchema: z.object({ currentState: z.record(z.any()).optional(), updates: z.record(z.any()).optional(), newState: z.record(z.any()).optional() }),
  outputSchema: z.object({ success: z.boolean(), newState: z.record(z.any()) }),
  async execute(args: ToolExecuteArgs) {
    const payload = getArgs(args) as { currentState?: any; updates?: any; newState?: any };
    const traceId = await langfuse.startTrace("tool.updateWorkflowState");
    const newState = payload.newState ?? { ...(payload.currentState || {}), ...(payload.updates || {}) };
    const res = { success: true, newState };
    await langfuse.logToolExecution(traceId, "updateWorkflowState", { hasUpdates: !!payload.updates }, res);
    await langfuse.endTrace(traceId, { success: true });
    return res;
  },
});

export const lookupCustomerFromDatabase = createTool({
  id: "lookupCustomerFromDatabase",
  description: "Look up real customer data from the database using store name or other identifiers",
  inputSchema: z.object({ storeName: z.string(), searchType: z.enum(["store_name", "customer_id", "phone", "email"]).optional() }),
  outputSchema: z.object({ success: z.boolean(), customerData: z.record(z.any()).optional(), found: z.boolean() }),
  async execute(args: ToolExecuteArgs) {
    const { storeName, searchType = "store_name" } = getArgs(args) as { storeName: string; searchType?: string };
    const traceId = await langfuse.startTrace("tool.lookupCustomerFromDatabase");
    
    try {
      // Map search type to database column
      const lookupColumn = searchType === "store_name" ? "会社名" : 
                          searchType === "customer_id" ? "顧客ID" :
                          searchType === "phone" ? "電話番号" : "メールアドレス";
      
      // Create smart search queries for store name matching
      let searchQueries = [storeName];
      if (searchType === "store_name") {
        // Add common variations and translations
        if (storeName.toLowerCase().includes("welcia")) {
          searchQueries.push("ウエルシア");
          searchQueries.push("ウエルシア 川崎駅前店");
        }
        if (storeName.toLowerCase().includes("kawasaki")) {
          searchQueries.push("川崎");
        }
        if (storeName.toLowerCase().includes("station")) {
          searchQueries.push("駅前");
        }
        if (storeName.toLowerCase().includes("donki") || storeName.includes("ドン・キホーテ")) {
          searchQueries.push("ドン・キホーテ");
        }
        if (storeName.toLowerCase().includes("shibuya") || storeName.includes("渋谷")) {
          searchQueries.push("渋谷");
        }
      }
      
      // Try each search query
      for (const query of searchQueries) {
        try {
          console.log(`🔍 [Customer Lookup] Trying query: "${query}" with column: "${lookupColumn}"`);
          
          const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
            instructions: `Look up customer data by ${searchType} with query: ${query}`,
            worksheet: "Customers",
            lookup_key: lookupColumn,
            lookup_value: query,
            row_count: "5"
          });
          
          console.log(`🔍 [Customer Lookup] Zapier result for "${query}":`, JSON.stringify(result, null, 2));
          
          if (result && result.length > 0) {
            console.log(`🔍 [Customer Lookup] Processing result for "${query}":`, JSON.stringify(result, null, 2));
            
            // Handle Zapier MCP response structure
            // The result has content array with text that contains JSON
            let parsedResult: any = null;
            
            if (result[0]?.content && Array.isArray(result[0].content)) {
              console.log(`🔍 [Customer Lookup] Found content array with ${result[0].content.length} items`);
              const textContent = result[0].content.find((item: any) => item.type === "text")?.text;
              console.log(`🔍 [Customer Lookup] Text content found:`, textContent ? "YES" : "NO");
              if (textContent) {
                console.log(`🔍 [Customer Lookup] Text content preview:`, textContent.substring(0, 100) + "...");
                try {
                  parsedResult = JSON.parse(textContent);
                  console.log(`🔍 [Customer Lookup] ✅ Successfully parsed JSON result`);
                  console.log(`🔍 [Customer Lookup] Parsed JSON result:`, JSON.stringify(parsedResult, null, 2));
                } catch (parseError) {
                  console.error(`❌ [Customer Lookup] Failed to parse JSON:`, parseError);
                  console.error(`❌ [Customer Lookup] Parse error details:`, JSON.stringify(parseError, null, 2));
                }
              } else {
                console.log(`❌ [Customer Lookup] No text content found in result`);
              }
            } else {
              console.log(`❌ [Customer Lookup] No content array found in result`);
            }
            
            // Handle new Zapier response format with numbered keys
            if (parsedResult && typeof parsedResult === "object") {
              console.log(`🔍 [Customer Lookup] Processing parsedResult:`, JSON.stringify(parsedResult, null, 2));
              
              // Look for numbered keys (0, 1, 2, etc.) that contain rows
              const numberedKeys = Object.keys(parsedResult).filter(key => !isNaN(Number(key)));
              console.log(`🔍 [Customer Lookup] Found numbered keys:`, numberedKeys);
              
              for (const key of numberedKeys) {
                const resultSection = parsedResult[key];
                console.log(`🔍 [Customer Lookup] Processing key "${key}":`, JSON.stringify(resultSection, null, 2));
                
                if (resultSection?.rows && Array.isArray(resultSection.rows) && resultSection.rows.length > 0) {
                  console.log(`🔍 [Customer Lookup] Found rows array with ${resultSection.rows.length} rows`);
                  const row = resultSection.rows[0];
                  console.log(`🔍 [Customer Lookup] Found row data:`, JSON.stringify(row, null, 2));
                  
                  const customerData = {
                    customerId: row["COL$A"] || row["顧客ID"],
                    storeName: row["COL$B"] || row["会社名"],
                    email: row["COL$C"] || row["メールアドレス"],
                    phone: row["COL$D"] || row["電話番号"],
                    location: row["COL$E"] || row["所在地"],
                    found: true
                  };
                  
                  console.log(`🔍 [Customer Lookup] Extracted customer data:`, JSON.stringify(customerData, null, 2));
                  
                  if (customerData.storeName || customerData.customerId) {
                    console.log(`🔍 [Customer Lookup] ✅ Customer data validation passed, returning success`);
                    const res = { success: true, customerData, found: true };
                    await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType, matchedQuery: query }, res);
                    await langfuse.endTrace(traceId, { success: true });
                    return res;
                  } else {
                    console.log(`❌ [Customer Lookup] Customer data validation failed: storeName=${customerData.storeName}, customerId=${customerData.customerId}`);
                  }
                } else {
                  console.log(`🔍 [Customer Lookup] No rows found in key "${key}"`);
                }
              }
              
              // Fallback: try old format for backward compatibility
              if (parsedResult?.results && Array.isArray(parsedResult.results) && parsedResult.results.length > 0) {
                console.log(`🔍 [Customer Lookup] Trying old format with results array`);
                const firstResult = parsedResult.results[0];
                
                if (firstResult.rows && Array.isArray(firstResult.rows) && firstResult.rows.length > 0) {
                  const row = firstResult.rows[0];
                  const customerData = {
                    customerId: row["COL$A"] || row["顧客ID"],
                    storeName: row["COL$B"] || row["会社名"],
                    email: row["COL$C"] || row["メールアドレス"],
                    phone: row["COL$D"] || row["電話番号"],
                    location: row["COL$E"] || row["所在地"],
                    found: true
                  };
                  
                  if (customerData.storeName || customerData.customerId) {
                    console.log(`🔍 [Customer Lookup] ✅ Customer data found using old format`);
                    const res = { success: true, customerData, found: true };
                    await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType, matchedQuery: query }, res);
                    await langfuse.endTrace(traceId, { success: true });
                    return res;
                  }
                }
              }
              
              console.log(`❌ [Customer Lookup] No valid data found in any format`);
            } else {
              console.log(`❌ [Customer Lookup] Invalid parsedResult format`);
            }
          }
        } catch (error) {
          console.error(`❌ [Customer Lookup] Failed to search with query "${query}":`, error);
          console.error(`❌ [Customer Lookup] Error details:`, JSON.stringify(error, null, 2));
        }
      }
      
      const res = { success: true, customerData: null, found: false };
      await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType, triedQueries: searchQueries }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    } catch (error) {
      console.error("Failed to lookup customer data:", error);
      const res = { success: false, customerData: null, found: false };
      await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType }, res);
      await langfuse.endTrace(traceId, { success: false });
      return res;
    }
  },
});

export const logCustomerData = createTool({
  id: "logCustomerData",
  description: "Automatically log extracted customer data to Google Sheets via Zapier MCP",
  inputSchema: z.object({ customerData: z.record(z.any()), source: z.string().optional() }),
  outputSchema: z.object({ success: z.boolean(), logId: z.string().optional() }),
  async execute(args: ToolExecuteArgs) {
    const { customerData, source } = getArgs(args) as { customerData: any; source?: string };
    const traceId = await langfuse.startTrace("tool.logCustomerData");
    
    try {
      // Log to Google Sheets via Zapier MCP using correct database schema
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "Log customer data extraction to Customers worksheet",
        worksheet: "Customers",
        "顧客ID": customerData.customerId || `CUST-${Date.now()}`,
        "会社名": customerData.storeName || customerData.name || customerData.companyName || "",
        "メールアドレス": customerData.email || customerData.emailAddress || "",
        "電話番号": customerData.phoneNumber || customerData.phone || customerData.telephone || "",
        "所在地": customerData.address || customerData.location || customerData.area || "",
        "Source": source || "customer-identification",
        "Raw Data": JSON.stringify(customerData),
        "Status": "Identified",
        "担当者 (Handler)": "AI",
      });
      
      const logId = `LOG-${Date.now()}`;
      const res = { success: true, logId };
      await langfuse.logToolExecution(traceId, "logCustomerData", { customerData, source }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    } catch (error) {
      console.error("Failed to log customer data:", error);
      const res = { success: false, logId: null };
      await langfuse.logToolExecution(traceId, "logCustomerData", { customerData, source }, res);
      await langfuse.endTrace(traceId, { success: false });
      return res;
    }
  },
});

export const streamToZapierFormat = createTool({
  id: "streamToZapierFormat",
  description: "Streams response in Zapier-compatible format for UI consumption",
  inputSchema: z.object({ 
    message: z.string(), 
    messageId: z.string().optional(),
    showProcessing: z.boolean().optional() 
  }),
  outputSchema: z.object({ success: z.boolean(), streamFormat: z.string() }),
  async execute(args: ToolExecuteArgs) {
    const { writer, mastra } = args as any;
    const { message, messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, showProcessing = false } = getArgs(args) as { message: string; messageId?: string; showProcessing?: boolean };
    
    const traceId = await langfuse.startTrace("tool.streamToZapierFormat", { messageLength: message?.length || 0 });
    
    try {
      // Generate Zapier-compatible streaming format
      const streamFormat = generateZapierStreamFormat(message, messageId, showProcessing);
      
      // If writer is available, stream the formatted response
      if (writer) {
        // Stream the f: line first
        writer.write(`f:{"messageId":"${messageId}"}\n`);
        
        // Stream each character with 0: prefix
        for (const char of message) {
          writer.write(`0:"${char}"\n`);
        }
        
        // Stream the e: line
        const usage = { promptTokens: 0, completionTokens: message.length };
        writer.write(`e:{"finishReason":"stop","usage":${JSON.stringify(usage)},"isContinued":false}\n`);
        
        // Stream the d: line
        writer.write(`d:{"finishReason":"stop","usage":${JSON.stringify(usage)}}\n`);
      }
      
      const res = { success: true, streamFormat };
      await langfuse.logToolExecution(traceId, "streamToZapierFormat", { messageLength: message?.length || 0, messageId }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    } catch (error) {
      console.error("Failed to stream in Zapier format:", error);
      const res = { success: false, streamFormat: "" };
      await langfuse.logToolExecution(traceId, "streamToZapierFormat", { messageLength: message?.length || 0, messageId }, res);
      await langfuse.endTrace(traceId, { success: false });
      return res;
    }
  },
});

// Helper function to generate Zapier-compatible streaming format
function generateZapierStreamFormat(message: string, messageId: string, showProcessing: boolean = false): string {
  const usage = { promptTokens: 0, completionTokens: message.length };
  
  let stream = `f:{"messageId":"${messageId}"}\n`;
  
  // Add processing indicator if requested
  if (showProcessing) {
    stream += `0:"(処理中...)"\n`;
  }
  
  // Stream each character
  for (const char of message) {
    stream += `0:"${char}"\n`;
  }
  
  // Add end markers
  stream += `e:{"finishReason":"stop","usage":${JSON.stringify(usage)},"isContinued":false}\n`;
  stream += `d:{"finishReason":"stop","usage":${JSON.stringify(usage)}}\n`;
  
  return stream;
}

export const streamRealtimeToZapier = createTool({
  id: "streamRealtimeToZapier",
  description: "Streams response in real-time using Zapier-compatible format with proper chunking",
  inputSchema: z.object({ 
    message: z.string(), 
    messageId: z.string().optional(),
    chunkDelay: z.number().optional(),
    showProcessing: z.boolean().optional() 
  }),
  outputSchema: z.object({ success: z.boolean(), messageId: z.string() }),
  async execute(args: ToolExecuteArgs) {
    const { writer, mastra } = args as any;
    const { message, messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, chunkDelay = 50, showProcessing = false } = getArgs(args) as { message: string; messageId?: string; chunkDelay?: number; showProcessing?: boolean };
    
    const traceId = await langfuse.startTrace("tool.streamRealtimeToZapier", { messageLength: message?.length || 0, chunkDelay });
    
    try {
      // If writer is available, stream in real-time
      if (writer) {
        // Start with message metadata
        writer.write(`f:{"messageId":"${messageId}"}\n`);
        
        // Add processing indicator if requested
        if (showProcessing) {
          writer.write(`0:"(処理中...)"\n`);
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
        
        // Stream each character with delay for realistic typing effect
        for (const char of message) {
          writer.write(`0:"${char}"\n`);
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
        
        // Add end markers
        const usage = { promptTokens: 0, completionTokens: message.length };
        writer.write(`e:{"finishReason":"stop","usage":${JSON.stringify(usage)},"isContinued":false}\n`);
        writer.write(`d:{"finishReason":"stop","usage":${JSON.stringify(usage)}}\n`);
      }
      
      const res = { success: true, messageId };
      await langfuse.logToolExecution(traceId, "streamRealtimeToZapier", { messageLength: message?.length || 0, messageId, chunkDelay }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    } catch (error) {
      console.error("Failed to stream real-time in Zapier format:", error);
      const res = { success: false, messageId: "" };
      await langfuse.logToolExecution(traceId, "streamRealtimeToZapier", { messageLength: message?.length || 0, messageId, chunkDelay }, res);
      await langfuse.endTrace(traceId, { success: false });
      return res;
    }
  },
});

export const streamZapierResponse = createTool({
  id: "streamZapierResponse",
  description: "Converts Zapier API responses to streaming format for UI consumption",
  inputSchema: z.object({ 
    zapierResponse: z.any(),
    messageId: z.string().optional(),
    showProcessing: z.boolean().optional() 
  }),
  outputSchema: z.object({ success: z.boolean(), streamFormat: z.string() }),
  async execute(args: ToolExecuteArgs) {
    const { writer, mastra } = args as any;
    const { zapierResponse, messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, showProcessing = false } = getArgs(args) as { zapierResponse: any; messageId?: string; showProcessing?: boolean };
    
    const traceId = await langfuse.startTrace("tool.streamZapierResponse", { responseType: typeof zapierResponse });
    
    try {
      // Convert Zapier response to human-readable text
      const message = convertZapierResponseToText(zapierResponse);
      
      // Generate Zapier-compatible streaming format
      const streamFormat = generateZapierStreamFormat(message, messageId, showProcessing);
      
      // If writer is available, stream the formatted response
      if (writer) {
        // Stream the f: line first
        writer.write(`f:{"messageId":"${messageId}"}\n`);
        
        // Add processing indicator if requested
        if (showProcessing) {
          writer.write(`0:"(処理中...)"\n`);
        }
        
        // Stream each character with 0: prefix
        for (const char of message) {
          writer.write(`0:"${char}"\n`);
        }
        
        // Stream the e: line
        const usage = { promptTokens: 0, completionTokens: message.length };
        writer.write(`e:{"finishReason":"stop","usage":${JSON.stringify(usage)},"isContinued":false}\n`);
        
        // Stream the d: line
        writer.write(`d:{"finishReason":"stop","usage":${JSON.stringify(usage)}}\n`);
      }
      
      const res = { success: true, streamFormat };
      await langfuse.logToolExecution(traceId, "streamZapierResponse", { responseType: typeof zapierResponse, messageLength: message?.length || 0, messageId }, res);
      await langfuse.endTrace(traceId, { success: true });
      return res;
    } catch (error) {
      console.error("Failed to stream Zapier response:", error);
      const res = { success: false, streamFormat: "" };
      await langfuse.logToolExecution(traceId, "streamZapierResponse", { responseType: typeof zapierResponse, messageId }, res);
      await langfuse.endTrace(traceId, { success: false });
      return res;
    }
  },
});

// Helper function to convert Zapier response to human-readable text
function convertZapierResponseToText(zapierResponse: any): string {
  if (!zapierResponse || typeof zapierResponse !== "object") {
    return "No data found.";
  }
  
  try {
    // Handle the new Zapier format with numbered keys
    const numberedKeys = Object.keys(zapierResponse).filter(key => !isNaN(Number(key)));
    
    if (numberedKeys.length > 0) {
      const results: any[] = [];
      
      for (const key of numberedKeys) {
        const resultSection = zapierResponse[key];
        if (resultSection?.rows && Array.isArray(resultSection.rows)) {
          results.push(...resultSection.rows);
        }
      }
      
      if (results.length > 0) {
        return formatCustomerResults(results);
      }
    }
    
    // Fallback: try old format
    if (zapierResponse?.results && Array.isArray(zapierResponse.results)) {
      const allRows: any[] = [];
      for (const result of zapierResponse.results) {
        if (result?.rows && Array.isArray(result.rows)) {
          allRows.push(...result.rows);
        }
      }
      if (allRows.length > 0) {
        return formatCustomerResults(allRows);
      }
    }
    
    return "No data found.";
  } catch (error) {
    console.error("Error converting Zapier response:", error);
    return "An error occurred while processing data.";
  }
}

// Helper function to format customer results as readable text
function formatCustomerResults(rows: any[]): string {
  if (rows.length === 0) return "No data found.";
  
  let text = `Customer data found (${rows.length} records):\n\n`;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const customerId = row["COL$A"] || row["顧客ID"] || "Unknown";
    const storeName = row["COL$B"] || row["会社名"] || "Unknown";
    const email = row["COL$C"] || row["メールアドレス"] || "Unknown";
    const phone = row["COL$D"] || row["電話番号"] || "Unknown";
    const location = row["COL$E"] || row["所在地"] || "Unknown";
    
    text += `${i + 1}. ${storeName}\n`;
    text += `   Customer ID: ${customerId}\n`;
    text += `   Email: ${email}\n`;
    text += `   Phone: ${phone}\n`;
    text += `   Location: ${location}\n\n`;
  }
  
  return text.trim();
}

export const orchestratorTools = { 
  delegateTo, 
  escalateToHuman, 
  validateContext, 
  updateWorkflowState, 
  logCustomerData, 
  lookupCustomerFromDatabase,
  streamToZapierFormat,
  streamRealtimeToZapier,
  streamZapierResponse
};
