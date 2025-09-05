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
    const agentId = parsed.agentId || "customer-identification";
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
      if (agentId === "customer-identification") extractedData = extractDataFromResponse(fullResponse, "CUSTOMER");
      else if (agentId === "repair-agent") extractedData = extractDataFromResponse(fullResponse, "PRODUCT");
      else if (agentId === "repair-history-ticket") extractedData = extractDataFromResponse(fullResponse, "ISSUE");
      else if (agentId === "repair-scheduling") extractedData = extractDataFromResponse(fullResponse, "REPAIR");
      
      // Automatically log customer data when extracted
      if (extractedData && agentId === "customer-identification") {
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
      
      await langfuse.logToolExecution(traceId, "delegateTo", { agentId, messageLength: message?.length || 0 }, { ok: true, agentId, extractedData });
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

// Add forceDelegation tool that maps to delegateTo for Langfuse prompt compatibility
export const forceDelegation = createTool({
  id: "forceDelegation",
  description: "Force delegation to another agent (alias for delegateTo)",
  inputSchema: z.object({ agentId: z.string().optional(), message: z.string().optional(), context: z.record(z.any()).optional() }),
  outputSchema: z.object({ ok: z.boolean(), agentId: z.string(), extractedData: z.any().optional() }),
  async execute(args: ToolExecuteArgs) {
    console.log("🔧 forceDelegation tool called with args:", JSON.stringify(args, null, 2));
    
    // Parse the arguments
    const parsed = getArgs(args) as { agentId?: string; message?: string; context?: Record<string, any> };
    const agentId = parsed.agentId || "customer-identification";
    const message = parsed.message || "顧客情報の確認をお願いします。";
    
    console.log("🔧 forceDelegation delegating to agent:", agentId, "with message:", message);
    
    // Call delegateTo with the parsed arguments
    const result = await delegateTo.execute(args);
    console.log("🔧 forceDelegation tool result:", JSON.stringify(result, null, 2));
    return result;
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
      // Map search type to exact database headers
      const lookupColumn = searchType === "store_name" ? "会社名" : 
                           searchType === "customer_id" ? "顧客ID" :
                           searchType === "phone" ? "電話番号" : "メールアドレス";
      
      const result = await Promise.race([
        zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
          instructions: `Look up customer data by ${lookupColumn}: ${storeName}`,
          worksheet: "Customers",
          lookup_key: lookupColumn,
          lookup_value: storeName,
          row_count: "5"
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Zapier call timeout after 40 seconds")), 40000))
      ]);
      
      let rows: any[] = [];
      if (result && result.results && Array.isArray(result.results)) {
        rows = result.results[0]?.rows || [];
      } else if (Array.isArray(result)) {
        rows = result as any[];
      } else if (result && (result as any).rows) {
        rows = (result as any).rows;
      } else if (result && (result as any)["0"] && (result as any)["0"].rows) {
        rows = (result as any)["0"].rows;
      }
      
      if (rows.length > 0) {
        const best = rows[0];
        const customerData = {
          customerId: best["顧客ID"] || best["COL$A"] || best["id"],
          storeName: best["会社名"] || best["COL$B"] || best["storeName"],
          email: best["メールアドレス"] || best["COL$C"] || best["email"],
          phone: best["電話番号"] || best["COL$D"] || best["phone"],
          location: best["所在地"] || best["COL$E"] || best["location"],
        };
        const res = { success: true, customerData, found: !!customerData.customerId };
        await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType, lookupColumn }, res);
        await langfuse.endTrace(traceId, { success: true });
        return res;
      }

      const res = { success: true, customerData: null, found: false };
      await langfuse.logToolExecution(traceId, "lookupCustomerFromDatabase", { storeName, searchType, lookupColumn }, res);
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
      await zapierMcp.callTool("google_sheets_create_spreadsheet_row", {
        instructions: "Log customer data extraction to Customers worksheet",
        worksheet: "Customers",
        "顧客ID": customerData.customerId || `CUST-${Date.now()}`,
        "会社名": customerData.storeName || customerData.name || customerData.companyName || "",
        "メールアドレス": customerData.email || customerData.emailAddress || "",
        "電話番号": customerData.phone || customerData.telephone || "",
        "所在地": customerData.address || customerData.location || "",
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

export const orchestratorTools = { delegateTo, escalateToHuman, validateContext, updateWorkflowState, logCustomerData, lookupCustomerFromDatabase };
