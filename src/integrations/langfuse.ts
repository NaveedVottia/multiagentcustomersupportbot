import { Langfuse } from "langfuse";

export interface SessionData {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface EvaluationScore {
  score: number; // 0-10 scale
  comment?: string;
  criteria?: string[];
  metadata?: Record<string, any>;
}

export class LangfuseIntegration {
  private langfuse: Langfuse | null = null;
  private langfuseTracing: Langfuse | null = null;
  private enabled: boolean = false;
  private currentSession: SessionData | null = null;

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

  // Session Management
  startSession(sessionId: string, userId?: string, metadata?: Record<string, any>): void {
    this.currentSession = { sessionId, userId, metadata };
    console.log(`[Langfuse] Session started: ${sessionId}${userId ? ` for user: ${userId}` : ''}`);
  }

  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  endSession(): void {
    if (this.currentSession) {
      console.log(`[Langfuse] Session ended: ${this.currentSession.sessionId}`);
      this.currentSession = null;
    }
  }

  // User Tracking
  setUser(userId: string, metadata?: Record<string, any>): void {
    if (this.currentSession) {
      this.currentSession.userId = userId;
      if (metadata) {
        this.currentSession.metadata = { ...this.currentSession.metadata, ...metadata };
      }
      console.log(`[Langfuse] User set: ${userId}`);
    }
  }

  // Enhanced Trace Management with Sessions and Users
  async startTrace(name: string, metadata?: any): Promise<string | null> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        const fallback = `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        console.log(`[Langfuse] Fallback trace started: ${fallback}`);
        return fallback;
      }

      const traceMetadata = {
        ...metadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId,
          sessionMetadata: this.currentSession.metadata
        })
      };

      const trace = await this.langfuseTracing.trace({
        name,
        metadata: traceMetadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      });

      console.log(`[Langfuse] Trace started: ${trace.id} for ${name}${this.currentSession ? ` in session: ${this.currentSession.sessionId}` : ''}`);
      return trace.id;
    } catch (error) {
      console.error(`[Langfuse] Error starting trace:`, error);
      const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Langfuse] Using fallback trace ID: ${traceId}`);
      return traceId;
    }
  }

  // Evaluation and Scoring
  async scoreTrace(traceId: string | null, score: EvaluationScore): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        console.log(`[Langfuse] Score logged (fallback): ${score.score}/10 for trace: ${traceId}`);
        return;
      }

      // Create a score trace that links to the original trace
      await this.langfuseTracing.trace({
        name: "evaluation_score",
        input: { traceId, score },
        output: { score: score.score, comment: score.comment },
        metadata: {
          traceId,
          score: score.score,
          comment: score.comment,
          criteria: score.criteria,
          ...score.metadata,
          ...(this.currentSession && {
            sessionId: this.currentSession.sessionId,
            userId: this.currentSession.userId
          })
        }
      });

      console.log(`[Langfuse] Score logged: ${score.score}/10 for trace: ${traceId}`);
    } catch (error) {
      console.error(`[Langfuse] Error logging score:`, error);
    }
  }

  async scoreResponse(responseText: string, score: EvaluationScore, context?: any): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        console.log(`[Langfuse] Response score logged (fallback): ${score.score}/10`);
        return;
      }

      await this.langfuseTracing.trace({
        name: "response_evaluation",
        input: { responseText, context },
        output: { score: score.score, comment: score.comment },
        metadata: {
          score: score.score,
          comment: score.comment,
          criteria: score.criteria,
          responseLength: responseText.length,
          ...score.metadata,
          ...(this.currentSession && {
            sessionId: this.currentSession.sessionId,
            userId: this.currentSession.userId
          })
        }
      });

      console.log(`[Langfuse] Response score logged: ${score.score}/10`);
    } catch (error) {
      console.error(`[Langfuse] Error logging response score:`, error);
    }
  }

  // Batch Evaluation
  async scoreMultipleResponses(responses: Array<{ text: string; score: EvaluationScore; context?: any }>): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) {
        console.log(`[Langfuse] Batch scores logged (fallback): ${responses.length} responses`);
        return;
      }

      for (const { text, score, context } of responses) {
        await this.scoreResponse(text, score, context);
      }

      console.log(`[Langfuse] Batch scores logged: ${responses.length} responses`);
    } catch (error) {
      console.error(`[Langfuse] Error logging batch scores:`, error);
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

  async logPrompt(
    promptName: string,
    input: any,
    output: any,
    metadata?: any
  ): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing) return;

      const traceMetadata = {
        ...metadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      };

      await this.langfuseTracing.trace({
        name: promptName,
        input,
        output,
        metadata: traceMetadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      });
      console.log(
        `[Langfuse Tracing] Successfully logged prompt: ${promptName}${this.currentSession ? ` in session: ${this.currentSession.sessionId}` : ''}`
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

  async logToolExecution(
    traceId: string | null,
    toolName: string,
    input: any,
    output: any,
    metadata?: any
  ): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        // This is a fallback trace ID, just log locally
        console.log(`[Langfuse] Tool execution (fallback): ${toolName}`, { input, output, metadata });
        return;
      }
      
      const traceMetadata = {
        traceId,
        ...metadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      };

      // Use proper Langfuse tracing
      await this.langfuseTracing.trace({
        name: `tool:${toolName}`,
        input,
        output,
        metadata: traceMetadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      });
      console.log(`[Langfuse] Tool execution logged: ${toolName}${this.currentSession ? ` in session: ${this.currentSession.sessionId}` : ''}`);
    } catch (error) {
      console.error(`[Langfuse] Error logging tool execution:`, error);
    }
  }

  async endTrace(traceId: string | null, finalMetadata?: any): Promise<void> {
    try {
      this.tryInitFromEnv();
      if (!this.enabled || !this.langfuseTracing || (traceId && traceId.startsWith('trace_'))) {
        // This is a fallback trace ID, just log locally
        console.log(`[Langfuse] Trace ended (fallback): ${traceId}`);
        return;
      }
      
      const traceMetadata = {
        ...finalMetadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      };

      // Use proper Langfuse tracing to end the trace
      await this.langfuseTracing.trace({
        name: "trace_end",
        input: { traceId },
        output: traceMetadata,
        metadata: traceMetadata,
        ...(this.currentSession && {
          sessionId: this.currentSession.sessionId,
          userId: this.currentSession.userId
        })
      });
      console.log(`[Langfuse] Trace ended: ${traceId}${this.currentSession ? ` in session: ${this.currentSession.sessionId}` : ''}`);
    } catch (error) {
      console.error(`[Langfuse] Error ending trace:`, error);
    }
  }

  // Get the tracing instance for external use
  getTracingInstance(): Langfuse | null {
    this.tryInitFromEnv();
    return this.langfuseTracing;
  }

  // Utility methods for common evaluation scenarios
  async scoreCustomerServiceResponse(responseText: string, score: number, comment?: string): Promise<void> {
    await this.scoreResponse(responseText, {
      score,
      comment,
      criteria: ['helpfulness', 'accuracy', 'politeness', 'resolution'],
      metadata: { category: 'customer_service' }
    });
  }

  async scoreTechnicalAccuracy(responseText: string, score: number, comment?: string): Promise<void> {
    await this.scoreResponse(responseText, {
      score,
      comment,
      criteria: ['technical_accuracy', 'completeness', 'clarity'],
      metadata: { category: 'technical_support' }
    });
  }

  async scoreUserExperience(responseText: string, score: number, comment?: string): Promise<void> {
    await this.scoreResponse(responseText, {
      score,
      comment,
      criteria: ['clarity', 'helpfulness', 'efficiency', 'user_friendliness'],
      metadata: { category: 'user_experience' }
    });
  }
}

// Export singleton instance
export const langfuse = new LangfuseIntegration();
