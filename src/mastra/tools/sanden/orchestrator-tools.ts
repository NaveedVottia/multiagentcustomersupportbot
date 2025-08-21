import { createTool } from "@mastra/core/tools";
import { z } from "zod";

let mastraInstance: any;

export function setMastraInstance(instance: any) {
  mastraInstance = instance;
}

function getArgs<T = any>(args: any): T {
  const payload = args?.input ?? args?.context ?? {};
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

export const delegateTo = createTool({
  id: "delegateTo",
  description: "Delegates to another agent and pipes their stream back",
  inputSchema: z.object({ agentId: z.string(), message: z.string(), context: z.record(z.any()).optional() }),
  outputSchema: z.object({ ok: z.boolean(), agentId: z.string(), extractedData: z.any().optional() }),
  async execute(args) {
    const { writer, mastra } = args as any;
    const { agentId, message, context: agentContext } = getArgs(args) as { agentId: string; message: string; context?: Record<string, any> };
    try {
      const instance = (mastra as any) || mastraInstance;
      const agent = instance?.getAgentById ? instance.getAgentById(agentId) : instance?.agents?.[agentId];
      if (!agent) throw new Error(`agent_not_found:${agentId}`);
      const messages = [
        { role: "system", content: `Context: ${JSON.stringify(agentContext || {})}` },
        { role: "user", content: message },
      ];
      const stream = agent.streamVNext ? await agent.streamVNext(messages) : await agent.stream(messages);
      let fullResponse = "";
      if (stream) {
        for await (const chunk of stream as any) {
          if (writer) writer.write(chunk);
          if ((chunk as any).text) fullResponse += (chunk as any).text; else if (typeof chunk === "string") fullResponse += chunk;
        }
      }
      let extractedData = null;
      if (agentId === "routing-agent-customer-identification") extractedData = extractDataFromResponse(fullResponse, "CUSTOMER");
      else if (agentId === "repair-agent-product-selection") extractedData = extractDataFromResponse(fullResponse, "PRODUCT");
      else if (agentId === "repair-qa-agent-issue-analysis") extractedData = extractDataFromResponse(fullResponse, "ISSUE");
      else if (agentId === "repair-visit-confirmation-agent") extractedData = extractDataFromResponse(fullResponse, "REPAIR");
      return { ok: true, agentId, extractedData };
    } catch (error) {
      // Do not stream internal errors to user; return neutral failure
      return { ok: false, agentId, extractedData: null as any };
    }
  },
});

export const escalateToHuman = createTool({
  id: "escalateToHuman",
  description: "Escalate to human support for emergency or complex issues",
  inputSchema: z.object({ reason: z.string(), priority: z.enum(["Low", "Medium", "High", "Emergency"]), context: z.record(z.any()).optional() }),
  outputSchema: z.object({ success: z.boolean(), escalationId: z.string().optional(), message: z.string().optional() }),
  async execute(args) {
    const { reason, priority, context } = getArgs(args) as { reason: string; priority: "Low"|"Medium"|"High"|"Emergency"; context?: any };
    if (priority !== "Emergency") {
      // Return neutral success; agent will phrase user-facing message
      return { success: true, escalationId: `DELEGATE-${Date.now()}`, message: "" };
    }
    const escalationId = `ESC-${Date.now()}`;
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "emergency_escalation", payload: { reason, priority, context, escalationId }, timestamp: new Date().toISOString() }) });
      } catch {}
    }
    return { success: true, escalationId, message: "" };
  },
});

export const validateContext = createTool({
  id: "validateContext",
  description: "Validate workflow context structure",
  inputSchema: z.object({ context: z.record(z.any()), requiredFields: z.array(z.string()).optional(), schema: z.string().optional() }),
  outputSchema: z.object({ isValid: z.boolean(), missingFields: z.array(z.string()), message: z.string() }),
  async execute(args) {
    const { context, requiredFields, schema } = getArgs(args) as { context: any; requiredFields?: string[]; schema?: string };
    if (schema) return { isValid: true, missingFields: [], message: "ok" };
    const missing: string[] = [];
    for (const field of requiredFields || []) {
      const keys = field.split('.');
      let value: any = context;
      for (const key of keys) value = value?.[key];
      if (value === undefined || value === null) missing.push(field);
    }
    return { isValid: missing.length === 0, missingFields: missing, message: missing.length === 0 ? "ok" : "missing" };
  },
});

export const updateWorkflowState = createTool({
  id: "updateWorkflowState",
  description: "Update workflow state with new data",
  inputSchema: z.object({ currentState: z.record(z.any()).optional(), updates: z.record(z.any()).optional(), newState: z.record(z.any()).optional() }),
  outputSchema: z.object({ success: z.boolean(), newState: z.record(z.any()) }),
  async execute(args) {
    const payload = getArgs(args) as { currentState?: any; updates?: any; newState?: any };
    const newState = payload.newState ?? { ...(payload.currentState || {}), ...(payload.updates || {}) };
    return { success: true, newState };
  },
});

export const orchestratorTools = { delegateTo, escalateToHuman, validateContext, updateWorkflowState };
