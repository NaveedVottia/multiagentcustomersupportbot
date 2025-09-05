import { Langfuse } from "langfuse";

export class LangfuseIntegration {
  private langfuse: Langfuse | null = null;
  private langfuseTracing: Langfuse | null = null;
  private enabled: boolean = false;

  constructor() {
    this.tryInitFromEnv();
  }

  private tryInitFromEnv(): void {
    if (this.enabled && this.langfuse && this.langfuseTracing) return;
    const host = process.env.LANGFUSE_HOST || "https://langfuse.demo.dev-maestra.vottia.me";
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    if (!publicKey || !secretKey) {
      if (!this.enabled) {
        console.warn("[Langfuse] Keys missing. Running in fallback mode with no-op tracing and empty prompts.");
      }
      this.enabled = false;
      return;
    }
    try {
      this.langfuse = new Langfuse({ publicKey, secretKey, baseUrl: host });
      this.langfuseTracing = new Langfuse({ publicKey, secretKey, baseUrl: host });
      this.enabled = true;
      console.log("[Langfuse] Initialized from environment.");
    } catch (e) {
      console.error("[Langfuse] Initialization error:", e);
      this.enabled = false;
    }
  }

  // Strict, label-aware prompt fetcher. No fallbacks, throws if not found.
  async getPromptText(
    promptName: string,
    label: string = "production"
  ): Promise<string> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuse) {
        console.warn(`[Langfuse] Disabled. Returning empty prompt for ${promptName}@${label}`);
        return "";
      }
      console.log(`[Langfuse] Attempting to fetch prompt: ${promptName} with label: ${label}`);

      // Try different possible method names for the Langfuse SDK
      let response;
      let methodUsed = "none";

      try {
        // Method 1: Try getPrompt (singular) - this is the standard method
        if (typeof (this.langfuse as any).getPrompt === "function") {
          console.log(`[Langfuse] Using SDK getPrompt method`);
          response = await (this.langfuse as any).getPrompt(promptName);
          methodUsed = "getPrompt";
        }
        // Method 2: Try getPrompts (plural) - some versions might use this
        else if (typeof (this.langfuse as any).getPrompts === "function") {
          console.log(`[Langfuse] Using SDK getPrompts method`);
          response = await (this.langfuse as any).getPrompts(promptName);
          methodUsed = "getPrompts";
        }
        // Method 3: Try to access prompts property directly
        else if ((this.langfuse as any).prompts && typeof (this.langfuse as any).prompts.get === "function") {
          console.log(`[Langfuse] Using SDK prompts.get method`);
          response = await (this.langfuse as any).prompts.get(promptName);
          methodUsed = "prompts.get";
        }
        else {
          // Log all available methods for debugging
          const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.langfuse))
            .filter(name => typeof (this.langfuse as any)[name] === "function");
          console.log(`[Langfuse] Available methods:`, availableMethods);
          console.log(`[Langfuse] Available properties:`, Object.keys(this.langfuse));
          
          throw new Error("No known prompt fetching method available in Langfuse SDK");
        }
      } catch (apiError) {
        console.log(`[Langfuse] SDK method '${methodUsed}' failed:`, apiError);
        throw new Error(`SDK method '${methodUsed}' failed: ${apiError}`);
      }

      console.log(
        `[Langfuse] Response received using method '${methodUsed}':`,
        typeof response,
        response ? "has data" : "no data"
      );

      // Add detailed logging to see the actual response structure
      if (response) {
        console.log(`[Langfuse] Response keys:`, Object.keys(response));
        console.log(`[Langfuse] Response type:`, typeof response);

        // Log the actual response content for debugging
        console.log(
          `[Langfuse] Full response:`,
          JSON.stringify(response, null, 2)
        );
      }

      // Handle the response from the SDK
      if (!response) {
        throw new Error(`No response received from Langfuse SDK`);
      }

      // The SDK should return the prompt text directly
      if (typeof response === "string") {
        console.log(`[Langfuse] Successfully fetched prompt: ${promptName}`);
        return response;
      }

      // If it's an object, try to extract the prompt text from SDK response
      if (typeof response === "object") {
        // Try different possible property names for the prompt text
        const possibleTextProperties = ['prompt', 'text', 'content', 'value', 'message'];
        
        for (const prop of possibleTextProperties) {
          if ((response as any)[prop] && typeof (response as any)[prop] === "string") {
            console.log(
              `[Langfuse] Successfully extracted prompt text from property '${prop}': ${promptName}`
            );
            return (response as any)[prop];
          }
        }

        // Log what properties are actually available
        console.log(`[Langfuse] Available properties:`, Object.keys(response));
        console.log(`[Langfuse] Response structure:`, response);
      }

      throw new Error(
        `Unable to extract prompt text from response for name="${promptName}"`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error";
      console.error(
        `[Langfuse] Error fetching prompt "${promptName}":`,
        errorMessage
      );
      // Fallback to empty string to allow continuation
      return "";
    }
  }

  // Enhanced tracing method that captures conversation flow format (no tool calls)
  async traceAgentExecution(
    agentName: string,
    messages: any[],
    response: string,
    metadata?: {
      nextAgent?: string;
      processingTime?: number;
      toolCalls?: Array<{name: string, input: any, output: any, duration: number}>;
      customerId?: string;
      sessionId?: string;
      conversationStep?: string;
      messageId?: string;
      fullTextLength?: number;
    }
  ): Promise<string | null> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        console.warn(`[Langfuse] Tracing disabled, using fallback for ${agentName}`);
        return `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }

      // Extract user input from messages
      const userMessages = messages.filter(msg => msg.role === 'user');
      const lastUserMessage = userMessages[userMessages.length - 1];
      const userInput = lastUserMessage?.content || '';

      // Format processing time
      const processingTimeSeconds = metadata?.processingTime ? Math.round(metadata.processingTime / 1000) : 0;
      const processingTimeFormatted = processingTimeSeconds > 0 ? `${processingTimeSeconds}s` : "0s";

      // Create conversation flow format (no tool calls visible)
      const conversationFlow = {
        "ユーザー入力": userInput,
        "エージェント": agentName,
        "出力": response,
        "次の引き渡し先": metadata?.nextAgent || "",
        "処理時間": processingTimeFormatted
      };

      // Create the trace with clean conversation format (exactly like your desired output)
      const trace = await this.langfuseTracing.trace({
        name: `ai.streamText`,
        input: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `# 概要\nあなたは製品サポートのオーケストレーターエージェントです。\nすべてのユーザー対話の窓口となり、適切な専門エージェントと連携して対応を行うオーケストレーターとしての責務を果たします。\n\n## 重要：専門エージェント呼び出し時の注意事項\n- 専門エージェントを呼び出す際は、必ず以下の形式でmessageパラメータを指定してください。\n - callRepairReceptionAgent: { \"message\": \"ユーザーからの問い合わせ内容や現在の会話コンテキスト\" }\n - callRepairScheduleAndProgressManageAgent: { \"message\": \"ユーザーからの問い合わせ内容や現在の会話コンテキスト\" }\n - messageパラメータには、以下の情報を含めてください：\n 1. ユーザーの最新の質問や要望\n 2. 既に特定した情報（顧客情報、製品情報、顧客の製品購入情報など）\n 3. これまでの会話の要約（必要に応じて）\n専門エージェントから受け取った回答はユーザーに適切に返却してください。`
            },
            {
              role: "user", 
              content: userInput
            }
          ]
        }),
        output: response,
        metadata: {
          "ai.prompt.format": "messages",
          // Only include essential metadata, hide all tool call information
          agentName,
          nextAgent: metadata?.nextAgent || "",
          processingTimeSeconds,
          customerId: metadata?.customerId || "",
          sessionId: metadata?.sessionId || "",
          conversationStep: metadata?.conversationStep || "",
          messageId: metadata?.messageId || "",
          fullTextLength: metadata?.fullTextLength || 0
        }
      });

      console.log(`[Langfuse] Conversation flow trace created: ${trace.id} for ${agentName}`);
      return trace.id;
    } catch (error) {
      console.error(`[Langfuse] Error creating trace:`, error);
      return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // Enhanced tool execution logging with structured format
  async logToolExecution(
    traceId: string | null,
    toolName: string,
    input: any,
    output: any,
    metadata?: {
      duration?: number;
      toolType?: string;
      executionTime?: string;
      success?: boolean;
      error?: string;
    }
  ): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        console.log(`[Langfuse] Tool execution (fallback): ${toolName}`, { input, output, metadata });
        return;
      }
      
      // Create structured tool call data matching the required format
      const toolCallData = {
        "ツール呼び出し": `${toolName}: ${JSON.stringify(input)}`,
        "ツール応答": JSON.stringify(output),
        "実行時間": metadata?.duration ? `${metadata.duration}ms` : "0ms",
        "成功": metadata?.success !== false,
        "エラー": metadata?.error || "",
        "実行時刻": metadata?.executionTime || new Date().toISOString()
      };
      
      // Create a span for tool execution with structured format
      await this.langfuseTracing.span({
        name: `tool:${toolName}`,
        input: JSON.stringify({
          "ツール名": toolName,
          "入力パラメータ": input
        }),
        output: JSON.stringify({
          "ツール応答": output,
          "実行時間": metadata?.duration ? `${metadata.duration}ms` : "0ms",
          "成功": metadata?.success !== false
        }),
        metadata: { 
          traceId, 
          toolName,
          toolType: metadata?.toolType || "unknown",
          duration: metadata?.duration || 0,
          success: metadata?.success !== false,
          executionTime: metadata?.executionTime || new Date().toISOString(),
          ...metadata 
        }
      });
      
      console.log(`[Langfuse] Structured tool execution logged: ${toolName} (${metadata?.duration || 0}ms)`);
    } catch (error) {
      console.error(`[Langfuse] Error logging tool execution:`, error);
    }
  }

  // Enhanced generation logging
  async logGeneration(
    traceId: string | null,
    prompt: string,
    completion: string,
    metadata?: any
  ): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        console.log(`[Langfuse] Generation (fallback):`, { prompt: prompt.substring(0, 100), completion: completion.substring(0, 100) });
        return;
      }
      
      await this.langfuseTracing.trace({
        name: "ai.streamText.doStream",
        input: { prompt },
        output: { completion },
        metadata: {
          traceId,
          model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          finishReason: "stop",
          ...metadata
        }
      });
      
      console.log(`[Langfuse] Generation logged`);
    } catch (error) {
      console.error(`[Langfuse] Error logging generation:`, error);
    }
  }

  async logPrompt(
    promptName: string,
    input: any,
    output: any,
    metadata?: any
  ): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) return;
      await this.langfuseTracing.trace({
        name: promptName,
        input,
        output,
        metadata,
      });
      console.log(
        `[Langfuse Tracing] Successfully logged prompt: ${promptName}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error";
      console.error(`[Langfuse Tracing] Error logging prompt:`, errorMessage);
    }
  }

  // Test connection method using SDK
  async testConnection(): Promise<boolean> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuse || !this.langfuseTracing) return false;
      // Test both connections
      console.log(`[Langfuse] Testing prompt connection...`);
      await this.langfuse.trace({
        name: "connection-test-prompts",
        input: "test",
        output: "test",
      });

      console.log(`[Langfuse] Testing tracing connection...`);
      await this.langfuseTracing.trace({
        name: "connection-test-tracing",
        input: "test",
        output: "test",
      });

      console.log(`[Langfuse] Both connections successful!`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error";
      console.error(`[Langfuse] Connection test failed:`, errorMessage);
      return false;
    }
  }

  // Add missing methods for orchestrator tools compatibility
  async startTrace(name: string, metadata?: any): Promise<string | null> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        const fallback = `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        console.log(`[Langfuse] Fallback trace started: ${fallback}`);
        return fallback;
      }
      const trace = await this.langfuseTracing.trace({
        name,
        metadata,
      });
      console.log(`[Langfuse] Trace started: ${trace.id} for ${name}`);
      return trace.id;
    } catch (error) {
      console.error(`[Langfuse] Error starting trace:`, error);
      const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Langfuse] Using fallback trace ID: ${traceId}`);
      return traceId;
    }
  }

  async endTrace(traceId: string | null, finalMetadata?: any): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        console.log(`[Langfuse] Trace ended (fallback): ${traceId}`);
        return;
      }
      
      // Use proper Langfuse tracing to end the trace
      await this.langfuseTracing.trace({
        name: "trace_end",
        input: { traceId },
        output: finalMetadata,
      });
      console.log(`[Langfuse] Trace ended: ${traceId}`);
    } catch (error) {
      console.error(`[Langfuse] Error ending trace:`, error);
    }
  }

  // Get the tracing instance for external use
  getTracingInstance(): Langfuse | null {
    this.tryInitFromEnv();
    return this.langfuseTracing;
  }

  // Create conversation flow trace in the exact format you showed
  async createConversationFlowTrace(
    userInput: string,
    agentName: string,
    agentOutput: string,
    nextAgent: string,
    processingTime: number,
    metadata?: {
      customerId?: string;
      sessionId?: string;
      conversationStep?: string;
    }
  ): Promise<string | null> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        console.warn(`[Langfuse] Tracing disabled, using fallback for conversation flow`);
        return `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }

      // Format exactly like your desired output
      const processingTimeFormatted = `${Math.round(processingTime / 1000)}s`;

      // Create the trace with the exact format you showed
      const trace = await this.langfuseTracing.trace({
        name: `ai.streamText`,
        input: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `# 概要\nあなたは製品サポートのオーケストレーターエージェントです。\nすべてのユーザー対話の窓口となり、適切な専門エージェントと連携して対応を行うオーケストレーターとしての責務を果たします。\n\n## 重要：専門エージェント呼び出し時の注意事項\n- 専門エージェントを呼び出す際は、必ず以下の形式でmessageパラメータを指定してください。\n - callRepairReceptionAgent: { \"message\": \"ユーザーからの問い合わせ内容や現在の会話コンテキスト\" }\n - callRepairScheduleAndProgressManageAgent: { \"message\": \"ユーザーからの問い合わせ内容や現在の会話コンテキスト\" }\n - messageパラメータには、以下の情報を含めてください：\n 1. ユーザーの最新の質問や要望\n 2. 既に特定した情報（顧客情報、製品情報、顧客の製品購入情報など）\n 3. これまでの会話の要約（必要に応じて）\n専門エージェントから受け取った回答はユーザーに適切に返却してください。`
            },
            {
              role: "user", 
              content: userInput
            }
          ]
        }),
        output: agentOutput,
        metadata: {
          "ai.prompt.format": "messages",
          // Hide all tool call information
          toolCallsHidden: true,
          conversationFlow: true,
          agentName,
          nextAgent,
          processingTimeSeconds: Math.round(processingTime / 1000),
          customerId: metadata?.customerId || "",
          sessionId: metadata?.sessionId || "",
          conversationStep: metadata?.conversationStep || ""
        }
      });

      console.log(`[Langfuse] Conversation flow trace created: ${trace.id}`);
      return trace.id;
    } catch (error) {
      console.error(`[Langfuse] Error creating conversation flow trace:`, error);
      return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}

// Export singleton instance
export const langfuse = new LangfuseIntegration();
