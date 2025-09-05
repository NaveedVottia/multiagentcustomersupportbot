import { tracing } from "../integrations/tracing";

// Helper function to create a traced agent wrapper
export function createTracedAgent(originalAgent: any, agentId: string) {
  // Create a wrapper that preserves all original properties and methods
  const tracedAgent = {
    ...originalAgent,
    // Add the __registerMastra method that Mastra expects
    __registerMastra: originalAgent.__registerMastra || function() {},
    // Override the stream method to add tracing
    stream: async function(messages: any[], options?: any) {
      const sessionId = options?.sessionId || `session-${Date.now()}`;
      const agentSpan = tracing.createAgentSpan(agentId, "stream", sessionId);
      
      try {
        // Add initial conversation details
        tracing.addConversationDetails(agentSpan, {
          currentAgent: agentId,
          conversationStep: "agent_stream_start",
          userMessage: messages.length > 0 ? messages[messages.length - 1]?.content : "",
          metadata: {
            "agent.messages_count": messages.length,
            "agent.session_id": sessionId,
          }
        });

        // Call the original agent's stream method
        const stream = await originalAgent.stream(messages, options);
        
        // Create a wrapper for the stream to capture tool calls
        const tracedStream = {
          ...stream,
          textStream: (async function* () {
            let fullResponse = "";
            let toolCalls: string[] = [];
            
            try {
              for await (const chunk of stream.textStream) {
                fullResponse += chunk;
                
                // Check if this chunk contains tool call information
                if (typeof chunk === 'string' && chunk.includes('tool_call')) {
                  toolCalls.push(chunk);
                }
                
                yield chunk;
              }
              
              // Update span with final response details
              tracing.addConversationDetails(agentSpan, {
                agentResponse: fullResponse,
                toolsCalled: toolCalls.length > 0 ? toolCalls : undefined,
                metadata: {
                  "agent.response_length": fullResponse.length,
                  "agent.tool_calls_count": toolCalls.length,
                }
              });
              
            } catch (error) {
              tracing.endSpan(agentSpan, error as Error);
              throw error;
            }
          })()
        };
        
        return tracedStream;
        
      } catch (error) {
        tracing.endSpan(agentSpan, error as Error);
        throw error;
      }
    }
  };

  return tracedAgent;
}

// Helper function to trace tool calls
export function traceToolCall(toolName: string, sessionId: string, parameters?: any, result?: any) {
  const toolSpan = tracing.createToolSpan(toolName, sessionId, parameters);
  
  if (toolSpan) {
    // Add result information if available
    if (result) {
      toolSpan.setAttributes({
        'tool.result': JSON.stringify(result),
        'tool.success': true,
      });
    }
    
    tracing.endSpan(toolSpan);
  }
}

// Helper function to trace tool errors
export function traceToolError(toolName: string, sessionId: string, error: Error, parameters?: any) {
  const toolSpan = tracing.createToolSpan(toolName, sessionId, parameters);
  
  if (toolSpan) {
    tracing.endSpan(toolSpan, error);
  }
}
