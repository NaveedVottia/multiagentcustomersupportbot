import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { workingOrchestratorAgent } from "../../agents/sanden/working-orchestrator";

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
});

// Step 1: External API streaming connection
const externalApiStreamStep = createStep({
  id: "external-api-stream",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { userInput, sessionId } = inputData;
    const sessionIdValue = sessionId || `session-${Date.now()}`;

    try {
      // Connect to external API streaming endpoint
      const externalApiUrl = "http://54.150.79.178:80/api/agents/repair-workflow-orchestrator/stream";
      
      console.log(`🔄 Connecting to external API: ${externalApiUrl}`);
      console.log(`📝 User Input: ${userInput}`);
      console.log(`🆔 Session ID: ${sessionIdValue}`);

      // Make the request to the external API using SSE-compatible headers and payload
      const sseResponse = await fetch(externalApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/plain",
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: userInput },
          ],
        }),
      });

      if (!sseResponse.ok) {
        throw new Error(`External API request failed: ${sseResponse.status} ${sseResponse.statusText}`);
      }

      // Read a small portion of the stream to surface initial feedback to the workflow
      let aggregatedText = "";
      try {
        const reader = (sseResponse.body as any)?.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          const startTime = Date.now();
          while (Date.now() - startTime < 1500) {
            const { value, done } = await reader.read();
            if (done) break;
            aggregatedText += decoder.decode(value, { stream: true });
            if (aggregatedText.length > 4000) break; // cap
          }
          try { await reader.cancel(); } catch {}
        } else {
          aggregatedText = await sseResponse.text();
        }
      } catch {}

      // Continue workflow; pass the partial stream text forward
      return {
        sessionId: sessionIdValue,
        step: "external-api-stream",
        status: "streaming" as const,
        nextStep: "orchestrator",
        workflowDuration: 0,
      };

    } catch (error: any) {
      console.error("❌ External API streaming error:", error);
      
      // Check for emergency keywords in user input
      const emergencyKeywords = ["火災", "発火", "煙", "fire", "smoke", "burning", "感電", "電気", "shock", "electric", "spark", "水漏れ", "漏水", "flood", "leak", "water damage"];
      const hasEmergency = emergencyKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasEmergency) {
        return {
          sessionId: sessionIdValue,
          step: "external-api-stream",
          status: "emergency_escalated" as const,
          workflowDuration: 0,
        };
      }

      return {
        sessionId: sessionIdValue,
        step: "external-api-stream",
        status: "error_escalated" as const,
        workflowDuration: 0,
      };
    }
  },
});

// Step 2: Orchestrator agent step for workflow management
const orchestratorStep = createStep({
  id: "workflow-orchestrator",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, status, step } = inputData;
    let currentContextValue = inputData;

    // If we already have a final status from the external API, return it
    if (status === "completed" || status === "emergency_escalated" || status === "error_escalated") {
      if (status === "completed") {
        return {
          ...currentContextValue,
          step: "orchestrator",
          status: "completed" as const,
          repairData: {
            修理ID: `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            日時: new Date().toISOString(),
            製品ID: "PROD001", // Placeholder
            顧客ID: "CUST001", // Placeholder
            問題内容: "Workflow completed",
            ステータス: "完了",
            訪問要否: "不要",
            優先度: "中",
            対応者: "AI",
          },
          nextStep: "workflow-complete",
        };
      } else if (status === "emergency_escalated") {
        return {
          ...currentContextValue,
          step: "orchestrator",
          status: "emergency_escalated" as const,
          nextStep: "emergency-handling",
        };
      } else {
        return {
          ...currentContextValue,
          step: "orchestrator",
          status: "error_escalated" as const,
          nextStep: "error-handling",
        };
      }
    }

    try {
      // For now, continue to customer identification
      return {
        ...currentContextValue,
        step: "orchestrator",
        status: "continue_workflow" as const,
        nextStep: "customer-identification",
      };

    } catch (error: any) {
      console.error("❌ Orchestrator step error:", error);
      return {
        ...currentContextValue,
        step: "orchestrator",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 3: Customer Identification Step
const customerIdentificationStep = createStep({
  id: "customer-identification",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step } = inputData;
    
    try {
      // Simulate customer identification - in real implementation, this would extract from user input
      const customerData = {
        顧客ID: `CUST-${Date.now()}`,
        会社名: "サンプル店舗",
        メールアドレス: "sample@example.com",
        電話番号: "03-1234-5678",
        所在地: "東京都・サンプル",
      };
      
      return {
        ...inputData,
        step: "customer-identification",
        customerData,
        nextStep: "product-selection",
        workflowDuration: Date.now() - parseInt(sessionId.replace('session-', '')),
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

// Step 4: Product Selection Step
const productSelectionStep = createStep({
  id: "product-selection",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, customerData } = inputData;
    
    try {
      if (!customerData) {
        throw new Error("Customer data not available");
      }
      
      // Simulate product selection - in real implementation, this would extract from user input
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
        step: "product-selection",
        productData,
        nextStep: "issue-analysis",
      };
    } catch (error: any) {
      console.error("❌ Product selection error:", error);
      return {
        ...inputData,
        step: "product-selection",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 5: Issue Analysis Step
const issueAnalysisStep = createStep({
  id: "issue-analysis",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, customerData, productData } = inputData;
    
    try {
      if (!customerData || !productData) {
        throw new Error("Customer or product data not available");
      }
      
      // Simulate issue analysis - in real implementation, this would extract from user input
      const issueData = {
        問題内容: "コーヒーが出ない",
        優先度: "中",
        訪問要否: "要",
      };
      
      return {
        ...inputData,
        step: "issue-analysis",
        issueData,
        nextStep: "visit-confirmation",
      };
    } catch (error: any) {
      console.error("❌ Issue analysis error:", error);
      return {
        ...inputData,
        step: "issue-analysis",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Step 6: Visit Confirmation Step
const visitConfirmationStep = createStep({
  id: "visit-confirmation",
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }: { inputData: any }) => {
    const { sessionId, step, customerData, productData, issueData } = inputData;
    
    try {
      if (!customerData || !productData || !issueData) {
        throw new Error("Required data not available");
      }
      
      // Create repair record
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
        step: "visit-confirmation",
        repairData,
        status: "completed" as const,
        nextStep: "workflow-complete",
      };
    } catch (error: any) {
      console.error("❌ Visit confirmation error:", error);
      return {
        ...inputData,
        step: "visit-confirmation",
        status: "error_escalated" as const,
        error: error.message,
        nextStep: "error-handling",
      };
    }
  },
});

// Create the comprehensive streaming workflow that handles the complete repair lifecycle
export const repairIntakeOrchestratedWorkflow = createWorkflow({
  id: "repairIntakeOrchestratedWorkflow",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: WorkflowContextSchema,
})
  .then(externalApiStreamStep)
  .then(orchestratorStep)
  .then(customerIdentificationStep)
  .then(productSelectionStep)
  .then(issueAnalysisStep)
  .then(visitConfirmationStep)
  .commit();

// Export the workflow for use in the main Mastra instance
export default repairIntakeOrchestratedWorkflow;
