import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { repairWorkflowOrchestratorAgent } from "../../agents/sanden/workflow-orchestrator";

// Define the streaming context schema that matches the database structure
const StreamingContextSchema = z.object({
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

// Step 1: External API streaming connection
const externalApiStreamStep = createStep({
  id: "external-api-stream",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
    currentContext: StreamingContextSchema.optional().describe("Current workflow context data"),
  }),
  outputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().describe("Session ID for tracking"),
    currentContext: StreamingContextSchema.optional().describe("Current workflow context data"),
    streamData: z.string().optional().describe("Streaming data from external API"),
    status: z.enum(["streaming", "completed", "emergency_escalated", "error_escalated"]),
    customerData: StreamingContextSchema.shape.customerData.optional(),
    productData: StreamingContextSchema.shape.productData.optional(),
    issueData: StreamingContextSchema.shape.issueData.optional(),
    nextStep: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { userInput, sessionId, currentContext } = inputData;
    const sessionIdValue = sessionId || `session-${Date.now()}`;
    let currentContextValue = currentContext || { sessionId: sessionIdValue };

    try {
      // Connect to external API streaming endpoint
      const externalApiUrl = "http://54.150.79.178/api/workflows/repair-intake/stream";
      
      console.log(`🔄 Connecting to external API: ${externalApiUrl}`);
      console.log(`📝 User Input: ${userInput}`);
      console.log(`🆔 Session ID: ${sessionIdValue}`);

      // Create the request payload for the external API
      const requestPayload = {
        userInput,
        sessionId: sessionIdValue,
        currentContext: currentContextValue,
        timestamp: new Date().toISOString(),
      };

      // Make the request to the external API
      const response = await fetch(externalApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`External API request failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log("✅ External API Response:", responseData);

      // Process the response and determine next steps
      if (responseData.status === "emergency") {
        return {
          userInput,
          sessionId: sessionIdValue,
          currentContext: currentContextValue,
          status: "emergency_escalated" as const,
        };
      } else if (responseData.status === "completed") {
        return {
          userInput,
          sessionId: sessionIdValue,
          currentContext: currentContextValue,
          status: "completed" as const,
          customerData: responseData.customerData,
          productData: responseData.productData,
          issueData: responseData.issueData,
        };
      } else if (responseData.status === "streaming") {
        // Handle streaming response - continue to next step
        return {
          userInput,
          sessionId: sessionIdValue,
          currentContext: currentContextValue,
          status: "streaming" as const,
          streamData: responseData.streamData,
          customerData: responseData.customerData,
          productData: responseData.productData,
          issueData: responseData.issueData,
          nextStep: responseData.nextStep || "orchestrator",
        };
      } else {
        // Handle error cases
        return {
          userInput,
          sessionId: sessionIdValue,
          currentContext: currentContextValue,
          status: "error_escalated" as const,
        };
      }

    } catch (error: any) {
      console.error("❌ External API streaming error:", error);
      
      // Check for emergency keywords in user input
      const emergencyKeywords = ["火災", "発火", "煙", "fire", "smoke", "burning", "感電", "電気", "shock", "electric", "spark", "水漏れ", "漏水", "flood", "leak", "water damage"];
      const hasEmergency = emergencyKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasEmergency) {
        return {
          userInput,
          sessionId: sessionIdValue,
          currentContext: currentContextValue,
          status: "emergency_escalated" as const,
        };
      }

      return {
        userInput,
        sessionId: sessionIdValue,
        currentContext: currentContextValue,
        status: "error_escalated" as const,
      };
    }
  },
});

// Step 2: Orchestrator agent step for workflow management
const orchestratorStep = createStep({
  id: "workflow-orchestrator",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().describe("Session ID for tracking"),
    currentContext: StreamingContextSchema.optional().describe("Current workflow context data"),
    streamData: z.string().optional().describe("Streaming data from external API"),
    status: z.enum(["streaming", "completed", "emergency_escalated", "error_escalated"]),
    customerData: StreamingContextSchema.shape.customerData.optional(),
    productData: StreamingContextSchema.shape.productData.optional(),
    issueData: StreamingContextSchema.shape.issueData.optional(),
    nextStep: z.string().optional(),
  }),
  outputSchema: z.object({
    status: z.enum(["completed", "emergency_escalated", "error_escalated", "continue_workflow"]),
    修理ID: z.string().optional(),
    escalationId: z.string().optional(),
    customerData: StreamingContextSchema.shape.customerData.optional(),
    productData: StreamingContextSchema.shape.productData.optional(),
    issueData: StreamingContextSchema.shape.issueData.optional(),
    repairData: StreamingContextSchema.shape.repairData.optional(),
    sessionId: z.string(),
    workflowDuration: z.number(),
    nextAgent: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { userInput, sessionId, currentContext, streamData, status, customerData, productData, issueData } = inputData;
    let currentContextValue = currentContext || { sessionId };

    // If we already have a final status from the external API, return it
    if (status === "completed" || status === "emergency_escalated" || status === "error_escalated") {
      if (status === "completed") {
        return {
          status: "completed" as const,
          修理ID: `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          workflowDuration: 0,
          customerData,
          productData,
          issueData,
        };
      } else if (status === "emergency_escalated") {
        return {
          status: "emergency_escalated" as const,
          escalationId: `ESC-${Date.now()}`,
          sessionId,
          workflowDuration: 0,
        };
      } else {
        return {
          status: "error_escalated" as const,
          escalationId: `ERR-${Date.now()}`,
          sessionId,
          workflowDuration: 0,
        };
      }
    }

    try {
      // Call the orchestrator agent with the streaming data
      const result = await repairWorkflowOrchestratorAgent.generate([
        { role: "user", content: userInput },
        { role: "system", content: `Current workflow context: ${JSON.stringify(currentContextValue)}` },
        { role: "assistant", content: `Stream data received: ${streamData || "No stream data"}` }
      ]);

      const response = result.text;
      console.log("🎯 Orchestrator Agent Response:", response);

      // Parse the orchestrator's decision and determine next steps
      if (response.includes("緊急事態") || response.includes("escalateToHuman")) {
        return {
          status: "emergency_escalated" as const,
          escalationId: `ESC-${Date.now()}`,
          sessionId,
          workflowDuration: 0,
        };
      } else if (response.includes("お疲れ様でした") || response.includes("セッション終了")) {
        return {
          status: "completed" as const,
          修理ID: `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          workflowDuration: 0,
        };
      } else if (response.includes("製品選択") || response.includes("product-selection")) {
        return {
          status: "continue_workflow" as const,
          sessionId,
          workflowDuration: 0,
          nextAgent: "repair-agent-product-selection",
          customerData: currentContextValue.customerData,
        };
      } else if (response.includes("問題分析") || response.includes("issue-analysis")) {
        return {
          status: "continue_workflow" as const,
          sessionId,
          workflowDuration: 0,
          nextAgent: "repair-qa-agent-issue-analysis",
          customerData: currentContextValue.customerData,
          productData: currentContextValue.productData,
        };
      } else if (response.includes("訪問確認") || response.includes("visit-confirmation")) {
        return {
          status: "continue_workflow" as const,
          sessionId,
          workflowDuration: 0,
          nextAgent: "repair-visit-confirmation-agent",
          customerData: currentContextValue.customerData,
          productData: currentContextValue.productData,
          issueData: currentContextValue.issueData,
        };
      } else {
        // Continue with current context
        return {
          status: "continue_workflow" as const,
          sessionId,
          workflowDuration: 0,
          customerData: currentContextValue.customerData,
          productData: currentContextValue.productData,
          issueData: currentContextValue.issueData,
        };
      }

    } catch (error: any) {
      console.error("❌ Orchestrator step error:", error);
      return {
        status: "error_escalated" as const,
        escalationId: `ERR-${Date.now()}`,
        sessionId,
        workflowDuration: 0,
      };
    }
  },
});

// Create the streaming workflow that connects multiple agents
export const repairIntakeStreamWorkflow = createWorkflow({
  id: "repairIntakeStreamWorkflow",
  inputSchema: z.object({
    userInput: z.string().describe("User input for the repair workflow"),
    sessionId: z.string().optional().describe("Session ID for tracking"),
  }),
  outputSchema: z.object({
    status: z.enum(["completed", "emergency_escalated", "error_escalated", "continue_workflow"]),
    修理ID: z.string().optional(),
    escalationId: z.string().optional(),
    customerData: StreamingContextSchema.shape.customerData.optional(),
    productData: StreamingContextSchema.shape.productData.optional(),
    issueData: StreamingContextSchema.shape.issueData.optional(),
    repairData: StreamingContextSchema.shape.repairData.optional(),
    sessionId: z.string(),
    workflowDuration: z.number(),
    nextAgent: z.string().optional(),
  }),
})
  .then(externalApiStreamStep)
  .then(orchestratorStep)
  .commit();
