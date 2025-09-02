import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { mastraPromise } from "../../index";

// Step for validating user input
const validateUserInput = createStep({
  id: "validateUserInput",
  inputSchema: z.object({
    userInput: z.string(),
  }),
  outputSchema: z.object({
    isValid: z.boolean(),
    shouldDelegate: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string } }) => {
    const { userInput } = inputData;
    
    // Check if user selected option "1" (repair service)
    const shouldDelegate = userInput === "1";
    const isValid = userInput && userInput.trim().length > 0;
    
    return { 
      isValid, 
      shouldDelegate 
    };
  },
});

// Step for delegating to customer identification agent
const delegateToCustomerIdentification = createStep({
  id: "delegateToCustomerIdentification",
  inputSchema: z.object({
    userInput: z.string(),
  }),
  outputSchema: z.object({
    customerResponse: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string } }) => {
    try {
      // Get the Mastra instance and then the customer identification agent
      const mastra = await mastraPromise;
      const customerAgent = mastra.getAgentById("customer-identification");
      if (!customerAgent) {
        throw new Error("Customer identification agent not found");
      }
      
      // Call the customer identification agent
      const stream = await customerAgent.stream([
        { role: "user", content: "顧客識別をお願いします" }
      ]);
      
      // Collect the response
      let fullResponse = "";
      for await (const chunk of stream.textStream) {
        if (typeof chunk === "string") {
          fullResponse += chunk;
        }
      }
      
      return {
        customerResponse: fullResponse,
        success: true
      };
    } catch (error) {
      console.error("Error delegating to customer identification:", error);
      return {
        customerResponse: "申し訳ございませんが、顧客識別エージェントに接続できませんでした。",
        success: false
      };
    }
  },
});

// Step for handling non-delegation cases
const handleNonDelegation = createStep({
  id: "handleNonDelegation",
  inputSchema: z.object({
    userInput: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string } }) => {
    const { userInput } = inputData;
    
    // Handle different user inputs
    if (userInput === "2") {
      return { response: "FAQサービスをご利用いただきます。\n\nFAQサポート機能へようこそ。\n1. 問題を検索する\n2. サンデンのウェブサイトFAQを利用する\n3. メインメニューに戻る\n4. 終了する\n\n番号でお答えください。直接入力も可能です。" };
    } else if (userInput === "3") {
      return { response: "お問い合わせフォームはこちらからアクセスしてください: https://form.sanden-rs.com/m?f=40\n\n1. メインメニューに戻る\n2. 終了する" };
    } else {
      return { response: "申し訳ございませんが、その選択肢は認識できませんでした。\n\n1. 修理受付・修理履歴・修理予約\n2. 一般的なFAQ\n3. リクエスト送信用オンラインフォーム\n\n番号でお答えください。直接入力も可能です。" };
    }
  },
});

// Create the main workflow
export const orchestratorWorkflow = createWorkflow({
  id: "orchestratorWorkflow",
  inputSchema: z.object({
    userInput: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
  }),
})
  .then(validateUserInput)
  .branch([
    [
      async ({ inputData }: { inputData: { shouldDelegate: boolean } }) => inputData.shouldDelegate,
      delegateToCustomerIdentification
    ],
    [
      async () => true, // Default case
      handleNonDelegation
    ]
  ])
  .commit();

// Helper function to run the workflow
export async function runOrchestratorWorkflow(userInput: string) {
  try {
    const run = await orchestratorWorkflow.createRunAsync();
    const result = await run.start({ inputData: { userInput } });
    
    console.log("🔍 Workflow result:", JSON.stringify(result, null, 2));
    
    if (result.status === 'success' && result.output) {
      // Check which branch was taken and get the appropriate response
      const response = result.output.response || result.output.customerResponse || "申し訳ございませんが、応答を生成できませんでした。";
      return {
        response,
        success: true
      };
    } else {
      console.error("❌ Workflow failed:", result);
      return {
        response: "申し訳ございませんが、処理中にエラーが発生しました。",
        success: false
      };
    }
  } catch (error) {
    console.error("Workflow execution error:", error);
    return {
      response: "申し訳ございませんが、システムエラーが発生しました。",
      success: false
    };
  }
}
