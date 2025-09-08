import { Langfuse } from 'langfuse';

export class TracingIntegration {
  private langfuse: Langfuse | null = null;
  private enabled: boolean = false;

  constructor() {
    this.tryInitFromEnv();
  }

  private tryInitFromEnv(): void {
    if (this.enabled && this.langfuse) return;
    const host = process.env.LANGFUSE_HOST;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

    if (!host || !secretKey || !publicKey) {
      if (!this.enabled) {
        console.warn('[Tracing] Langfuse configuration missing. Tracing disabled.');
      }
      this.enabled = false;
      return;
    }

    try {
      // Initialize Langfuse client
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: host,
      });

      this.enabled = true;
      console.log('[Tracing] Langfuse tracing initialized successfully');

    } catch (error) {
      console.error('[Tracing] Failed to initialize tracing:', error);
      this.enabled = false;
    }
  }

  // Create streaming trace for ai.streamtext integration
  async createStreamingTrace(sessionId: string, agentId: string, userMessage: string) {
    if (!this.enabled || !this.langfuse) return null;

    try {
      const trace = await this.langfuse.trace({
        name: `agent.${agentId}.stream`,
        sessionId: sessionId,
        metadata: {
          agentId,
          sessionId,
          userMessage: userMessage.substring(0, 100), // Truncate for metadata
          timestamp: new Date().toISOString(),
        },
      });

      // Create a generation for the streaming response
      const generation = trace.generation({
        name: `${agentId}.response`,
        model: 'mastra-agent',
        input: userMessage,
        metadata: {
          agentId,
          sessionId,
          streaming: true,
        },
      });

      return { trace, generation };
    } catch (error) {
      console.warn('[Tracing] Failed to create streaming trace:', error);
      return null;
    }
  }

  // Log streaming chunks with ai.streamtext
  async logStreamingChunk(generation: any, chunk: string, isComplete: boolean = false) {
    if (!generation || !this.enabled) return;

    try {
      if (isComplete) {
        await generation.end({
          output: chunk,
          metadata: {
            completed: true,
            chunkCount: chunk.length,
          },
        });
      } else {
        // Log intermediate chunks
        generation.update({
          output: chunk,
          metadata: {
            streaming: true,
            chunkLength: chunk.length,
          },
        });
      }
    } catch (error) {
      console.warn('[Tracing] Failed to log streaming chunk:', error);
    }
  }

  // Create detailed conversation flow trace in Japanese format
  async createConversationFlowTrace(sessionId: string, conversationData: {
    userInput: string;
    agentId: string;
    agentOutput: string;
    nextAgent?: string;
    processingTime: number;
    customerInfo?: any;
  }) {
    if (!this.enabled || !this.langfuse) return null;

    try {
      // Format the conversation data in Japanese
      let conversationText = `ユーザー入力\n"${conversationData.userInput}"\n\n`;
      conversationText += `${conversationData.agentId}\n`;
      conversationText += `出力（"${conversationData.agentOutput}"）\n`;
      
      if (conversationData.nextAgent) {
        conversationText += `次の引き渡し先（"${conversationData.nextAgent}"）\n`;
      }
      
      conversationText += `処理時間：${conversationData.processingTime}s`;

      const trace = await this.langfuse.trace({
        name: `conversation.flow.${conversationData.agentId}`,
        sessionId: sessionId,
        metadata: {
          sessionId,
          agentId: conversationData.agentId,
          userInput: conversationData.userInput,
          agentOutput: conversationData.agentOutput,
          nextAgent: conversationData.nextAgent,
          processingTime: conversationData.processingTime,
          timestamp: new Date().toISOString(),
        },
      });

      // Create generation with formatted conversation text
      const generation = trace.generation({
        name: `${conversationData.agentId}.conversation`,
        model: 'mastra-agent',
        input: conversationData.userInput,
        output: conversationText,
        metadata: {
          agentId: conversationData.agentId,
          sessionId,
          conversationFormat: 'japanese-structured',
          processingTime: conversationData.processingTime,
        },
      });

      return { trace, generation };
    } catch (error) {
      console.warn('[Tracing] Failed to create conversation flow trace:', error);
      return null;
    }
  }

  // Check if tracing is enabled
  isEnabled(): boolean {
    // Try to reinitialize if not enabled
    if (!this.enabled) {
      this.tryInitFromEnv();
    }
    return this.enabled;
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.langfuse) {
      await this.langfuse.shutdown();
      console.log('[Tracing] Tracing shutdown complete');
    }
  }
}

// Export singleton instance
export const tracing = new TracingIntegration();
