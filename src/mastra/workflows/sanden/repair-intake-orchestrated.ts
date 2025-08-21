import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { repairWorkflowOrchestratorAgent } from "../../agents/sanden/workflow-orchestrator";

// Define the unified context schema
const WorkflowContextSchema = z.object({
  sessionId: z.string().optional(),
  step: z.string().optional(),
  customerData: z.object({
    顧客ID: z.string(),
    会社名: z.string(),
    メールアドレス: z.string(),
    電話番号: z.string(),
    所在地: z.string(),
  }).optional(),
  productData: z.object({
    製品ID: z.string(),
    製品カテゴリ: z.string(),
    型式: z.string(),
    シリアル番号: z.string(),
    保証状況: z.string(),
  }).optional(),
  issueData: z.object({
    問題内容: z.string(),
    優先度: z.string(),
    訪問要否: z.string(),
  }).optional(),
  repairData: z.object({
    修理ID: z.string(),
    日時: z.string(),
    ステータス: z.string(),
    対応者: z.string(),
  }).optional(),
  workflowDuration: z.number().optional(),
});

// Orchestrator step that manages the entire workflow
const orchestratorStep = createStep({
  id: "workflow-orchestrator",
  inputSchema: z.object({
    userInput: z.string().describe("Initial user input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
    currentContext: WorkflowContextSchema.optional().describe("Current workflow context data."),
  }),
  outputSchema: z.object({
    status: z.enum(["completed", "emergency_escalated", "error_escalated"]),
    修理ID: z.string().optional(),
    escalationId: z.string().optional(),
    customerData: WorkflowContextSchema.shape.customerData.optional(),
    productData: WorkflowContextSchema.shape.productData.optional(),
    issueData: WorkflowContextSchema.shape.issueData.optional(),
    repairData: WorkflowContextSchema.shape.repairData.optional(),
    sessionId: z.string(),
    workflowDuration: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { userInput, sessionId, currentContext } = inputData;
    const sessionIdValue = sessionId || `session-${Date.now()}`;
    let currentContextValue = currentContext || { sessionId: sessionIdValue };

    // Initial call to the orchestrator agent
    const result = await repairWorkflowOrchestratorAgent.generate([
      { role: "user", content: userInput },
      { role: "system", content: `Current workflow context: ${JSON.stringify(currentContextValue)}` }
    ]);

    const response = result.text;
    console.log("Orchestrator Agent Response:", response);

    // Simulate parsing the orchestrator's decision and context updates
    // In a real scenario, the orchestrator agent would use tools to update context and call next agents
    // For now, we'll simulate a direct completion or escalation
    if (response.includes("緊急事態") || response.includes("escalateToHuman")) {
      return {
        status: "emergency_escalated" as const,
        escalationId: `ESC-${Date.now()}`,
        sessionId: sessionIdValue,
        workflowDuration: 0, // Placeholder
      };
    } else if (response.includes("お疲れ様でした") || response.includes("セッション終了")) {
      return {
        status: "completed" as const,
        修理ID: `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId: sessionIdValue,
        workflowDuration: 0, // Placeholder
      };
    } else {
      // For now, if not explicitly completed or escalated, assume error for simplicity
      return {
        status: "error_escalated" as const,
        escalationId: `ERR-${Date.now()}`,
        sessionId: sessionIdValue,
        workflowDuration: 0, // Placeholder
      };
    }
  },
});

// Create the orchestrated workflow
export const repairIntakeOrchestratedWorkflow = createWorkflow({
  id: "repairIntakeOrchestratedWorkflow",
  inputSchema: z.object({
    userInput: z.string().describe("Initial user input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: z.object({
    status: z.enum(["completed", "emergency_escalated", "error_escalated"]),
    修理ID: z.string().optional(),
    escalationId: z.string().optional(),
    customerData: WorkflowContextSchema.shape.customerData.optional(),
    productData: WorkflowContextSchema.shape.productData.optional(),
    issueData: WorkflowContextSchema.shape.issueData.optional(),
    repairData: WorkflowContextSchema.shape.repairData.optional(),
    sessionId: z.string(),
    workflowDuration: z.number(),
  }),
})
  .then(orchestratorStep)
  .commit();
