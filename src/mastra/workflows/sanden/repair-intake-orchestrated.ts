import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { createRepairWorkflowOrchestrator } from "../../agents/sanden/repair-workflow-orchestrator.js";

// Define the unified workflow context schema that flows between all steps
const WorkflowContextSchema = z.object({
  sessionId: z.string(),
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
    顧客ID: z.string(),
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
    製品ID: z.string(),
    顧客ID: z.string(),
    問題内容: z.string(),
    ステータス: z.string(),
    訪問要否: z.string(),
    優先度: z.string(),
    対応者: z.string(),
  }).optional(),
  workflowDuration: z.number().optional(),
  status: z.enum(["streaming", "completed", "emergency_escalated", "error_escalated", "continue_workflow"]).optional(),
  nextStep: z.string().optional(),
  error: z.string().optional(),
  userInput: z.string().optional(),
  currentAgent: z.string().optional(),
});

// Step 1: Initial Orchestrator Step - Shows main menu and handles user selection
const initialOrchestratorStep = createStep({
  id: "initial-orchestrator",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { userInput, sessionId } = inputData;
    const sessionIdValue = sessionId || `session-${Date.now()}`;

    try {
      console.log(`🔄 Initial orchestrator step for session: ${sessionIdValue}`);
      console.log(`📝 User Input: ${userInput}`);

      // Check for emergency keywords first
      const emergencyKeywords = ["火災", "発火", "煙", "fire", "smoke", "burning", "感電", "電気", "shock", "electric", "spark", "水漏れ", "漏水", "flood", "leak", "water damage"];
      const hasEmergency = emergencyKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasEmergency) {
        console.log("🚨 Emergency detected, escalating to human");
        return {
          sessionId: sessionIdValue,
          step: "initial-orchestrator",
          status: "emergency_escalated" as const,
          workflowDuration: 0,
          nextStep: "emergency-handling",
        };
      }

      // Check if user is requesting repair service
      const repairKeywords = ["修理", "修理受付", "修理履歴", "修理予約", "repair", "maintenance", "fix", "broken", "故障", "問題"];
      const isRepairRequest = repairKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isRepairRequest) {
        console.log("🔧 Repair request detected, proceeding to customer identification");
        return {
          sessionId: sessionIdValue,
          step: "initial-orchestrator",
          status: "continue_workflow" as const,
          nextStep: "customer-identification",
          userInput,
        };
      }

      // Default: show main menu
      console.log("📋 Showing main menu");
      return {
        sessionId: sessionIdValue,
        step: "initial-orchestrator",
        status: "continue_workflow" as const,
        nextStep: "show-main-menu",
        userInput,
      };

    } catch (error: any) {
      console.error("❌ Initial orchestrator step error:", error);
      return {
        sessionId: sessionIdValue,
        step: "initial-orchestrator",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 2: Show Main Menu Step
const showMainMenuStep = createStep({
  id: "show-main-menu",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step } = inputData;
    
    try {
      console.log(`📋 Showing main menu for session: ${sessionId}`);
      
      // This step would typically return the menu text
      // In a real implementation, this would be handled by the orchestrator agent
      return {
        ...inputData,
        step: "show-main-menu",
        status: "continue_workflow" as const,
        nextStep: "wait-for-user-selection",
      };
    } catch (error: any) {
      console.error("❌ Show main menu error:", error);
      return {
        ...inputData,
        step: "show-main-menu",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 3: Customer Identification Step - Delegates to customer identification agent
const customerIdentificationStep = createStep({
  id: "customer-identification",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, userInput } = inputData;
    
    try {
      console.log(`🔍 Customer identification step for session: ${sessionId}`);
      
      // This step would delegate to the customer identification agent
      // The agent would handle the conversation flow and return customer data
      return {
        ...inputData,
        step: "customer-identification",
        status: "continue_workflow" as const,
        nextStep: "customer-identification-agent",
        currentAgent: "customer-identification",
      };
    } catch (error: any) {
      console.error("❌ Customer identification error:", error);
      return {
        ...inputData,
        step: "customer-identification",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 4: Customer Identification Agent Step - Handles the actual customer identification
const customerIdentificationAgentStep = createStep({
  id: "customer-identification-agent",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, userInput } = inputData;
    
    try {
      console.log(`🔍 Customer identification agent step for session: ${sessionId}`);
      
      // This step would use the customer identification agent to:
      // 1. Ask for email address
      // 2. Ask for phone number  
      // 3. Ask for company name
      // 4. Look up customer using hybridLookupCustomerByDetails tool
      
      // For now, simulate the process
      const customerData = {
        顧客ID: `CUST-${Date.now()}`,
        会社名: "サンプル店舗",
        メールアドレス: "sample@example.com",
        電話番号: "03-1234-5678",
        所在地: "東京都・サンプル",
      };
      
      return {
        ...inputData,
        step: "customer-identification-agent",
        customerData,
        status: "continue_workflow" as const,
        nextStep: "repair-agent",
        currentAgent: "repair-agent",
      };
    } catch (error: any) {
      console.error("❌ Customer identification agent error:", error);
      return {
        ...inputData,
        step: "customer-identification-agent",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 5: Repair Agent Step - Handles repair history, products, and scheduling
const repairAgentStep = createStep({
  id: "repair-agent",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, customerData, userInput } = inputData;
    
    try {
      console.log(`🔧 Repair agent step for session: ${sessionId}`);
      
      if (!customerData) {
        throw new Error("Customer data not available");
      }
      
      // This step would use the repair agent to:
      // 1. Show repair service menu
      // 2. Handle user selection (repair history, products, scheduling)
      // 3. Use appropriate Zapier MCP tools for data lookup
      
      // For now, simulate the process
      const productData = {
        製品ID: `PROD-${Date.now()}`,
        顧客ID: customerData.顧客ID,
        製品カテゴリ: "コーヒーマシン",
        型式: "CM-400F",
        シリアル番号: "SN400123",
        保証状況: "有効",
      };
      
      return {
        ...inputData,
        step: "repair-agent",
        productData,
        status: "continue_workflow" as const,
        nextStep: "repair-scheduling",
        currentAgent: "repair-scheduling-agent",
      };
    } catch (error: any) {
      console.error("❌ Repair agent error:", error);
      return {
        ...inputData,
        step: "repair-agent",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 6: Repair Scheduling Step - Handles final scheduling and confirmation
const repairSchedulingStep = createStep({
  id: "repair-scheduling",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, customerData, productData, userInput } = inputData;
    
    try {
      console.log(`📅 Repair scheduling step for session: ${sessionId}`);
      
      if (!customerData || !productData) {
        throw new Error("Required data not available");
      }
      
      // This step would use the repair scheduling agent to:
      // 1. Collect issue details
      // 2. Determine priority and visit requirements
      // 3. Schedule the repair visit
      // 4. Create final repair record
      
      // For now, simulate the process
      const issueData = {
        問題内容: "コーヒーが出ない",
        優先度: "中",
        訪問要否: "要",
      };
      
      const repairData = {
        修理ID: `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        日時: new Date().toISOString(),
        製品ID: productData.製品ID,
        顧客ID: customerData.顧客ID,
        問題内容: issueData.問題内容,
        ステータス: "未対応",
        訪問要否: issueData.訪問要否,
        優先度: issueData.優先度,
        対応者: "AI",
      };
      
      return {
        ...inputData,
        step: "repair-scheduling",
        issueData,
        repairData,
        status: "completed" as const,
        nextStep: "workflow-complete",
        workflowDuration: Date.now() - parseInt(sessionId.replace('session-', '')),
      };
    } catch (error: any) {
      console.error("❌ Repair scheduling error:", error);
      return {
        ...inputData,
        step: "repair-scheduling",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Create the comprehensive repair intake workflow
export const repairIntakeOrchestratedWorkflow = createWorkflow({
  id: "repairIntakeOrchestratedWorkflow",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: WorkflowContextSchema,
})
  .then(initialOrchestratorStep)
  .then(showMainMenuStep)
  .then(customerIdentificationStep)
  .then(customerIdentificationAgentStep)
  .then(repairAgentStep)
  .then(repairSchedulingStep)
  .commit();

// Export the workflow for use in the main Mastra instance
export default repairIntakeOrchestratedWorkflow;
