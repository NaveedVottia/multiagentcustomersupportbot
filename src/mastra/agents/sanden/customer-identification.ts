import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
// Removed unused imports to prevent conflicts
import { delegateTo } from "../../tools/sanden/orchestrator-tools.js";
import { hybridLookupCustomerByDetails, hybridRegisterCustomer } from "../../tools/sanden/hybrid-customer-tools.js";
import { readFileSync } from 'fs';
import { join } from 'path';

// Agent factory function
async function createCustomerIdentificationAgent(): Promise<Agent> {
  console.log("🔍 Creating Customer Identification Agent...");
  
  // Load hardcoded prompt from file
  let instructions = "";
  try {
    const promptPath = join(process.cwd(), 'src/mastra/prompts/customer-identification-prompt.txt');
    instructions = readFileSync(promptPath, 'utf8').trim();
    console.log(`✅ Successfully loaded hardcoded instructions (length: ${instructions.length})`);
  } catch (error) {
    console.error("❌ Failed to load hardcoded prompt:", error);
    throw new Error("Failed to load customer-identification-prompt.txt");
  }
  
  console.log(`✅ Using hardcoded instructions (length: ${instructions.length})`);
  
  // Create agent with loaded instructions
  const agent = new Agent({ 
    name: "routing-agent-customer-identification",
    description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
    instructions: instructions,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      // Hybrid tools (Zapier first, local fallback)
      hybridLookupCustomerByDetails,
      hybridRegisterCustomer,
      // Simple input validation without external calls
      sanitizeInput: createTool({
        id: "sanitizeInput",
        description: "Simple input validation without external calls",
        inputSchema: z.object({
          input: z.string().describe("Input to validate"),
          type: z.enum(["email", "phone", "companyName"]).describe("Type of input"),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          message: z.string(),
          sanitizedInput: z.string(),
        }),
        execute: async ({ context }: { context: any }) => {
          const { input, type } = context;
          let sanitizedInput = input.trim();
          let isValid = false;
          let message = "";

          switch (type) {
            case "email":
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              isValid = emailRegex.test(sanitizedInput);
              message = isValid ? "メールアドレスが有効です。" : "メールアドレスの形式が正しくありません。";
              break;
            case "phone":
              const cleanPhone = sanitizedInput.replace(/\D/g, '');
              isValid = cleanPhone.length >= 10 && cleanPhone.length <= 20;
              message = isValid ? "電話番号が有効です。" : "電話番号は10桁から20桁で入力してください。";
              break;
            case "companyName":
              isValid = sanitizedInput.length >= 2 && sanitizedInput.length <= 100;
              message = isValid ? "会社名が有効です。" : "会社名は2文字以上100文字以内で入力してください。";
              break;
          }

          return {
            success: isValid,
            message,
            sanitizedInput,
          };
        },
      }),
      // Only essential tools for customer identification
      delegateTo,
    },
    memory: new Memory(),
  });

  console.log("✅ Customer Identification Agent created with instructions length:", instructions.length);
  console.log("🔧 Agent tools configured:", Object.keys(agent.tools));
  return agent;
}

export { createCustomerIdentificationAgent };
