import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export class TracingIntegration {
  private sdk: NodeSDK | null = null;
  private enabled: boolean = false;

  constructor() {
    this.tryInitFromEnv();
  }

  private tryInitFromEnv(): void {
    if (this.enabled && this.sdk) return;
    const host = process.env.LANGFUSE_HOST;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;

    if (!host || !secretKey) {
      if (!this.enabled) {
        console.warn('[Tracing] Langfuse configuration missing. Tracing disabled.');
      }
      this.enabled = false;
      return;
    }

    try {
      // Configure the trace exporter to send to Langfuse
      const traceExporter = new OTLPTraceExporter({
        url: `${host}/api/public/traces`,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Create the SDK without instrumentations to avoid compatibility issues
      this.sdk = new NodeSDK({
        traceExporter,
        serviceName: 'sanden-repair-system',
      });

      // Initialize the SDK
      this.sdk.start();
      this.enabled = true;
      console.log('[Tracing] OpenTelemetry tracing initialized successfully');

    } catch (error) {
      console.error('[Tracing] Failed to initialize tracing:', error);
      this.enabled = false;
    }
  }

  // Create a span for conversation tracking with timing
  createConversationSpan(sessionId: string, operation: string, metadata?: Record<string, any>) {
    if (!this.enabled) return null;

    const tracer = trace.getTracer('sanden-repair-system');
    const span = tracer.startSpan(`conversation.${operation}`, {
      attributes: {
        'session.id': sessionId,
        'operation.type': operation,
        'service.name': 'sanden-repair-system',
        'conversation.start_time': Date.now(),
        ...metadata,
      },
    });

    return span;
  }

  // Add conversation details to a span with enhanced format
  addConversationDetails(span: any, details: {
    customerId?: string;
    customerProfile?: any;
    currentAgent?: string;
    conversationStep?: string;
    userMessage?: string;
    agentResponse?: string;
    nextAgent?: string;
    toolsCalled?: string[];
    toolCalls?: Array<{name: string, input: any, output: any, duration: number}>;
    processingTime?: number;
    metadata?: Record<string, any>;
  }) {
    if (!span || !this.enabled) return;

    const startTime = span.attributes['conversation.start_time'] || Date.now();
    const currentTime = Date.now();
    const processingTime = details.processingTime || (currentTime - startTime);

    span.setAttributes({
      'conversation.customer_id': details.customerId || '',
      'conversation.current_agent': details.currentAgent || '',
      'conversation.step': details.conversationStep || '',
      'conversation.user_message': details.userMessage || '',
      'conversation.agent_response': details.agentResponse || '',
      'conversation.next_agent': details.nextAgent || '',
      'conversation.tools_called': details.toolsCalled?.join(',') || '',
      'conversation.processing_time_ms': processingTime,
      'conversation.processing_time_seconds': Math.round(processingTime / 1000),
      ...details.metadata,
    });

    // Add detailed tool call information
    if (details.toolCalls && details.toolCalls.length > 0) {
      details.toolCalls.forEach((toolCall, index) => {
        span.setAttributes({
          [`tool_call.${index}.name`]: toolCall.name,
          [`tool_call.${index}.input`]: JSON.stringify(toolCall.input),
          [`tool_call.${index}.output`]: JSON.stringify(toolCall.output),
          [`tool_call.${index}.duration_ms`]: toolCall.duration,
        });
      });
    }

    // Add customer profile as a JSON attribute if available
    if (details.customerProfile) {
      span.setAttributes({
        'conversation.customer_profile': JSON.stringify(details.customerProfile),
      });
    }
  }

  // End a span with optional error
  endSpan(span: any, error?: Error) {
    if (!span || !this.enabled) return;

    if (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    } else {
      span.setStatus({
        code: SpanStatusCode.OK,
      });
    }

    span.end();
  }

  // Create a span for agent operations
  createAgentSpan(agentId: string, operation: string, sessionId: string) {
    if (!this.enabled) return null;

    const tracer = trace.getTracer('sanden-repair-system');
    const span = tracer.startSpan(`agent.${agentId}.${operation}`, {
      attributes: {
        'agent.id': agentId,
        'agent.operation': operation,
        'session.id': sessionId,
        'service.name': 'sanden-repair-system',
      },
    });

    return span;
  }

  // Create a span for tool calls
  createToolSpan(toolName: string, sessionId: string, parameters?: any) {
    if (!this.enabled) return null;

    const tracer = trace.getTracer('sanden-repair-system');
    const span = tracer.startSpan(`tool.${toolName}`, {
      attributes: {
        'tool.name': toolName,
        'session.id': sessionId,
        'tool.parameters': JSON.stringify(parameters || {}),
        'service.name': 'sanden-repair-system',
      },
    });

    return span;
  }

  // Get current trace context
  getCurrentTraceContext() {
    if (!this.enabled) return null;
    return context.active();
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
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('[Tracing] Tracing shutdown complete');
    }
  }
}

// Export singleton instance
export const tracing = new TracingIntegration();
