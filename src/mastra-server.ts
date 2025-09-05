import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastraPromise } from "./mastra/index";
import { langfuse } from "./integrations/langfuse";
import { tracing } from "./integrations/tracing";

// Load environment variables
dotenv.config({ path: "./server.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session management for conversation context
interface SessionData {
  customerId?: string;
  customerProfile?: any;
  currentAgent?: string;
  conversationStep?: string;
  lastInteraction?: number;
  delegationContext?: {
    targetAgent: string;
    message: string;
    timestamp: number;
  };
}

const sessionStore = new Map<string, SessionData>();

// Helper function to get or create session
function getSession(sessionId: string): SessionData {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, {
      lastInteraction: Date.now()
    });
  }
  return sessionStore.get(sessionId)!;
}

// Helper function to get session ID from request
function getSessionId(req: Request): string {
  // Try to get session ID from headers, query params, or body
  const sessionId = req.headers['x-session-id'] as string || 
                   req.query.sessionId as string || 
                   req.body.sessionId as string ||
                   `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔍 [DEBUG] Session ID for request: ${sessionId}`);
  return sessionId;
}

// Create Express app
const app = express();

// Set server timeout to 40 seconds for Zapier calls
app.use((req, res, next) => {
  // Set timeout to 40 seconds for all requests
  req.setTimeout(40000);
  res.setTimeout(40000);
  next();
});

// Middleware
// CORS configuration to allow UI origins and streaming
const allowedOrigins = (process.env.CORS_ORIGINS || "https://demo.dev-maestra.vottia.me,https://mastra.demo.dev-maestra.vottia.me").split(",").map(o => o.trim());
const corsConfig = {
  origin: function(origin: any, callback: any) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Session-Id", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Type"],
} as any;
app.use(cors(corsConfig));
// Use a regex for catch-all OPTIONS to avoid path-to-regexp '*' error on Express 5
app.options(/.*/, cors(corsConfig));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Health check: Checking Mastra instance...");
    const mastra = await mastraPromise;
    console.log("mastra type:", typeof mastra);
    console.log("mastra.agents:", mastra.agents);
    console.log("mastra.getAgentById:", typeof mastra.getAgentById);
    
    // Test agent access
    const knownAgentIds = [
      'customer-identification',
      'repair-agent',
      'repair-history-ticket',
      'repair-scheduling'
    ];
    
    console.log("Trying known agent IDs:", knownAgentIds);
    for (const agentId of knownAgentIds) {
      try {
        const agent = mastra.getAgentById(agentId);
        if (agent) {
          console.log(`✅ Found agent: ${agentId}`);
        } else {
          console.log(`❌ Agent not found: ${agentId}`);
        }
      } catch (error) {
        console.log(`❌ Error accessing agent ${agentId}:`, error);
      }
    }
    
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      agents: knownAgentIds,
      mastra: "initialized"
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(500).json({ 
      status: "unhealthy", 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to get agent by ID
async function getAgentById(agentId: string) {
  try {
    const mastra = await mastraPromise;
    return mastra.getAgentById(agentId);
  } catch (error) {
    console.error(`❌ Error getting agent ${agentId}:`, error);
    return null;
  }
}

// Helper function to encode chunks for Mastra f0ed protocol
function encodeChunk(chunk: string): string {
  return chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Sanitize assistant text to avoid exposing internal delegation/handoff verbiage to users
function sanitizeAssistantText(text: string): string {
  try {
    let out = text;
    // Remove internal delegation markers entirely
    out = out.replace(/DELEGATION_TO_[A-Z0-9_-]+:[^\n]*/g, "");
    // Remove common Japanese handoff statements
    out = out.replace(/(?:引き継ぎました|引き継がせていただきます|委譲させていただきます)[^\n。]*[。\n]?/g, "");
    out = out.replace(/(?:エージェントに(?:引き継|委譲))[^\n。]*[。\n]?/g, "");
    // Remove English handoff phrases
    out = out.replace(/\b(?:transfer|hand\s*over|delegat(?:e|ion)|hand\s*off)[^\n]*\n?/gi, "");
    // Collapse excessive whitespace/newlines
    out = out.replace(/\n{3,}/g, "\n\n").replace(/\s{2,}/g, " ");
    return out;
  } catch {
    return text;
  }
}

// Stream Mastra response using f0ed protocol and collect both raw and sanitized responses
async function streamMastraResponseWithCollection(stream: any, res: Response): Promise<{ fullTextLength: number; fullResponse: string; rawFullResponse: string }> {
  let totalLengthSanitized = 0;
  let rawFullResponse = "";
  let sanitizedFullResponse = "";
  
  try {
    for await (const chunk of stream.textStream) {
      if (typeof chunk === 'string' && chunk.trim()) {
        // Append raw chunk first
        rawFullResponse += chunk;
        // Re-sanitize the entire accumulated text to handle cross-chunk patterns
        const sanitizedNow = sanitizeAssistantText(rawFullResponse);
        // Compute the delta to stream only newly sanitized content
        const delta = sanitizedNow.slice(sanitizedFullResponse.length);
        totalLengthSanitized += delta.length;
        sanitizedFullResponse = sanitizedNow;
        for (const ch of delta) {
          res.write(`0:"${encodeChunk(ch)}"\n`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error streaming response:", error);
    const fallback = sanitizeAssistantText("申し訳ございませんが、エラーが発生しました。");
    totalLengthSanitized = fallback.length;
    rawFullResponse += fallback;
    sanitizedFullResponse += fallback;
    for (const ch of fallback) {
      res.write(`0:"${encodeChunk(ch)}"\n`);
    }
  }

  if (totalLengthSanitized === 0) {
    const msg = "";
    res.write(`0:"${encodeChunk(msg)}"\n`);
  }

  return { fullTextLength: totalLengthSanitized, fullResponse: sanitizedFullResponse, rawFullResponse };
}

// Prepare headers for Mastra streaming protocol
function prepareStreamHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Hint for some proxies (e.g., Nginx) to not buffer
  res.setHeader('X-Accel-Buffering', 'no');
  // Flush headers immediately
  try { res.flushHeaders(); } catch {}
}

// Write message id line and flush
function writeMessageId(res: Response, messageId: string): void {
  res.write(`f:{"messageId":"${messageId}"}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Write finish metadata (e:/d:) and flush
function writeFinish(res: Response, fullTextLength: number): void {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Simple test endpoint without streaming
app.post("/api/agents/customer-identification/test", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 Test endpoint with ${messages.length} messages`);
    
    const agent = await getAgentById("customer-identification");
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }
    
    const resolvedAgent = await agent;
    console.log("🔍 Resolved agent for test");
    console.log("🔍 Agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Agent type:", typeof resolvedAgent);
    
    // Try to execute without streaming
    if (typeof resolvedAgent.stream === 'function') {
      console.log("🔍 Testing stream method...");
      const stream = await resolvedAgent.stream(messages);
      console.log("🔍 Stream created, trying to read...");
      
      // Try to read from the stream
      let result = "";
      for await (const chunk of stream.textStream) {
        if (typeof chunk === 'string') {
          result += chunk;
        }
      }
      
      return res.json({ success: true, result: result });
    } else if (typeof resolvedAgent.execute === 'function') {
      const result = await resolvedAgent.execute(messages);
      return res.json({ success: true, result: result });
    } else if (typeof resolvedAgent.run === 'function') {
      const result = await resolvedAgent.run(messages);
      return res.json({ success: true, result: result });
    } else {
      return res.status(500).json({ error: "Agent does not have execute or run method", methods: Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)) });
    }
    
  } catch (error: unknown) {
    console.error("❌ [Test endpoint] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Main endpoint for the customer identification agent (main entry point)
app.post("/api/agents/customer-identification/stream", async (req: Request, res: Response) => {
  let traceId: string | null = null;
  let fullResponse = "";
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 Processing request with ${messages.length} messages`);
    console.log(`🔍 Session ID: ${sessionId}`);
    console.log(`🔍 Current session:`, JSON.stringify(session, null, 2));
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Extract text from content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        // Extract text from assistant content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    console.log(`🔍 Normalized messages:`, JSON.stringify(normalizedMessages, null, 2));
    
    // Always use customer-identification as the orchestrator agent
    let targetAgentId = "customer-identification";
    const currentUserInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // If customer is identified for the first time, update session
    if (!session.customerId && currentUserInput.match(/CUST\d+/)) {
      session.customerId = currentUserInput;
      session.conversationStep = "menu";
      console.log(`🔍 Customer identified: ${session.customerId}`);
      
      // Also store customer data in shared memory for tools to access
      try {
        const mastra = await mastraPromise;
        const customerAgent = mastra.getAgentById("customer-identification");
        if (customerAgent) {
          const resolvedAgent = await customerAgent;
          if (resolvedAgent.memory) {
            // Also write session-scoped keys into shared Mastra Memory for cross-agent access
            try {
              const { sharedMastraMemory } = await import("./mastra/shared-memory");
              // Use namespaced keys that other agents read
              sharedMastraMemory.set(`customer.${sessionId}.customerId`, session.customerId);
              sharedMastraMemory.set(`customer.${sessionId}.lastInteraction`, new Date().toISOString());
              sharedMastraMemory.set(`customer.${sessionId}.currentAgent`, "customer-identification");
            } catch (e) {
              console.log("❌ Failed to set session-scoped keys in shared memory:", e);
            }

            // Keep direct agent memory keys for backward compatibility
            resolvedAgent.memory.set("customerId", session.customerId);
            resolvedAgent.memory.set("sessionId", sessionId);
            console.log(`🔍 Stored customer data in shared memory: ${session.customerId}`);
          }
        }
      } catch (error) {
        console.log(`❌ Error storing customer data in shared memory:`, error);
      }
    }
    
    // Update session timestamp
    session.lastInteraction = Date.now();
    
    const agent = await getAgentById(targetAgentId);
    if (!agent) {
      return res.status(500).json({ error: `Agent '${targetAgentId}' not found` });
    }
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Create a context object with session data for tools only
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };
    
    console.log(`🔍 Tool context:`, JSON.stringify(toolContext, null, 2));
    
    // Update shared memory with session-specific data
    try {
      const { getSessionMemory } = await import("./mastra/agents/sanden/customer-identification");
      const sessionMemory = getSessionMemory(sessionId);
      
      // Store session data in memory
      if (session.customerId) {
        sessionMemory.set("customerId", session.customerId);
        sessionMemory.set("sessionId", sessionId);
        console.log(`🔍 [DEBUG] Updated session memory with customerId: ${session.customerId}`);
      }
    } catch (error) {
      console.log(`❌ [DEBUG] Error updating session memory:`, error);
    }
    
    // Try different methods based on Mastra documentation
    let stream;
    if (typeof resolvedAgent.stream === 'function') {
      // Don't pass session data in context to avoid message format issues
      stream = await resolvedAgent.stream(normalizedMessages);
    } else if (typeof resolvedAgent.execute === 'function') {
      const result = await resolvedAgent.execute(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else if (typeof resolvedAgent.run === 'function') {
      const result = await resolvedAgent.run(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else {
      throw new Error(`Agent does not have stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)).join(', ')}`);
    }
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines) and collect full response
    const { fullTextLength, fullResponse, rawFullResponse } = await streamMastraResponseWithCollection(stream, res);
    
    // Check for delegation instructions in the response (support hyphenated IDs)
    const delegationMatch = rawFullResponse.match(/DELEGATION_TO_([A-Za-z0-9_-]+):\s*(.+)/);
    if (delegationMatch) {
      const targetAgent = delegationMatch[1].toLowerCase();
      const delegationMessage = delegationMatch[2];
      
      console.log(`🔧 [DELEGATION] Detected delegation to: ${targetAgent}`);
      console.log(`🔧 [DELEGATION] Message: ${delegationMessage}`);
      
      // Map agent names to conversation steps
      const agentToStepMap: Record<string, string> = {
        "repair-history-ticket": "repair-history",
        "repair-agent": "product-selection", 
        "repair-scheduling": "scheduling",
        "customer-identification": "identification"
      };
      
      // Update session with delegation target
      session.conversationStep = agentToStepMap[targetAgent] || "identification";
      session.lastInteraction = Date.now();
      
      console.log(`🔧 [DELEGATION] Updated session step to: ${session.conversationStep}`);
      
      // Store delegation context in session
      session.delegationContext = {
        targetAgent: targetAgent,
        message: delegationMessage,
        timestamp: Date.now()
      };
      
      // Update session in global store
      sessionStore.set(sessionId, session);
      
      console.log(`🔧 [DELEGATION] Session updated:`, JSON.stringify(session, null, 2));
    } else {
      // Fallback: detect textual delegation without tool marker
      try {
        const lower = (rawFullResponse || fullResponse || "").toLowerCase();
        let inferredTarget: string | null = null;
        if (lower.includes("repair-agent")) inferredTarget = "repair-agent";
        else if (lower.includes("repair-scheduling")) inferredTarget = "repair-scheduling";
        else if (lower.includes("repair-history-ticket")) inferredTarget = "repair-history-ticket";
        else if (lower.includes("customer-identification")) inferredTarget = "customer-identification";
        const mentionsDelegation = lower.includes("委譲") || lower.includes("引き継") || lower.includes("delegat");
        if (inferredTarget && mentionsDelegation) {
          const agentToStepMap: Record<string, string> = {
            "repair-history-ticket": "repair-history",
            "repair-agent": "product-selection",
            "repair-scheduling": "scheduling",
            "customer-identification": "identification",
          };
          session.conversationStep = agentToStepMap[inferredTarget] || "identification";
          session.delegationContext = {
            targetAgent: inferredTarget,
            message: "Textual delegation detected",
            timestamp: Date.now(),
          };
          session.lastInteraction = Date.now();
          sessionStore.set(sessionId, session);
          console.log(`🔧 [DELEGATION][FALLBACK] Inferred delegation to: ${inferredTarget}`);
        }
      } catch (e) {
        console.log(`❌ [DELEGATION][FALLBACK] Error inferring delegation:`, e);
      }
    }
    
    // Create conversation flow trace (clean format without tool calls)
    const traceUserInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    const processingTime = Date.now() - (session.lastInteraction || Date.now());
    const nextAgent = session.conversationStep === "menu" ? "determined_by_user_selection" : 
                     session.conversationStep === "repair-history" ? "repair-history-ticket" :
                     session.conversationStep === "product-selection" ? "repair-agent" :
                     session.conversationStep === "scheduling" ? "repair-scheduling" : "";
    
    traceId = await langfuse.createConversationFlowTrace(
      traceUserInput,
      targetAgentId,
      fullResponse,
      nextAgent,
      processingTime,
      {
        sessionId,
        customerId: session.customerId,
        conversationStep: session.conversationStep
      }
    );
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    console.log(`✅ Updated session:`, JSON.stringify(session, null, 2));
    console.log(`✅ Trace created: ${traceId}`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /customer-identification/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Legacy endpoint for UI compatibility - implements linear agent-to-agent pattern
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const session = getSession(sessionId);
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    
    console.log(`🔍 Processing UI request with ${messages.length} messages`);
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Extract text from content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        // Extract text from assistant content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    console.log(`🔍 Normalized messages:`, JSON.stringify(normalizedMessages, null, 2));
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, messageId);
    
    // Implement linear agent-to-agent pattern with shared memory identifiers
    const userId = session.customerId || `user-${sessionId}`;
    const threadId = `thread-${sessionId}`;
    const memIds = { resource: userId, thread: threadId };
    
    console.log(`🔧 [LINEAR] Using memory IDs:`, memIds);
    
    // Get the current user input
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // Determine which agent to call based on session state
    let currentAgent;
    let agentResponse = "";
    
    if (!session.customerId || session.conversationStep === "identification") {
      // Customer identification phase
      currentAgent = await getAgentById("customer-identification");
      console.log(`🔧 [LINEAR] Calling customer-identification agent`);
      
      const stream = await currentAgent.stream(normalizedMessages);
      let fullResponse = "";
      
      for await (const chunk of stream.textStream) {
        if (chunk && typeof chunk === 'string') {
          fullResponse += chunk;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.content) {
          fullResponse += chunk.content;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.content) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.text) {
          fullResponse += chunk.text;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.text) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        }
      }
      
      agentResponse = fullResponse;
      
      // Check if customer was identified and update session
      if ((agentResponse.includes("修理サービスメニュー") || agentResponse.includes("修理サービスメニュー") || agentResponse.includes("メニュー")) && !session.customerId) {
        // Extract customer ID from the response or use a default
        session.customerId = "CUST007"; // This should be extracted from the response
        session.conversationStep = "menu";
        sessionStore.set(sessionId, session);
        console.log(`🔧 [LINEAR] Customer identified, updated session:`, session);
      }
      
    } else if (session.conversationStep === "menu") {
      // Menu selection phase - determine which agent to delegate to
      const menuOption = userInput.trim();
      
      if (menuOption === "1") {
        currentAgent = await getAgentById("repair-history-ticket");
        console.log(`🔧 [LINEAR] Delegating to repair-history-ticket agent`);
        session.conversationStep = "repair-history";
      } else if (menuOption === "2") {
        currentAgent = await getAgentById("repair-agent");
        console.log(`🔧 [LINEAR] Delegating to repair-agent`);
        session.conversationStep = "product-selection";
      } else if (menuOption === "3") {
        currentAgent = await getAgentById("repair-scheduling");
        console.log(`🔧 [LINEAR] Delegating to repair-scheduling agent`);
        session.conversationStep = "scheduling";
      } else {
        // Invalid option, stay with customer identification
        currentAgent = await getAgentById("customer-identification");
        console.log(`🔧 [LINEAR] Invalid option, staying with customer-identification`);
      }
      
      sessionStore.set(sessionId, session);
      
      // Call the delegated agent with shared memory
      const stream = await currentAgent.stream(normalizedMessages);
      let fullResponse = "";
      
      for await (const chunk of stream.textStream) {
        if (chunk && typeof chunk === 'string') {
          fullResponse += chunk;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.content) {
          fullResponse += chunk.content;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.content) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.text) {
          fullResponse += chunk.text;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.text) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        }
      }
      
      agentResponse = fullResponse;
      
    } else {
      // Other phases - call appropriate agent
      if (session.conversationStep === "repair-history") {
        currentAgent = await getAgentById("repair-history-ticket");
      } else if (session.conversationStep === "product-selection") {
        currentAgent = await getAgentById("repair-agent");
      } else if (session.conversationStep === "scheduling") {
        currentAgent = await getAgentById("repair-scheduling");
      } else {
        currentAgent = await getAgentById("customer-identification");
      }
      
      console.log(`🔧 [LINEAR] Calling ${session.conversationStep} agent`);
      
      const stream = await currentAgent.stream(normalizedMessages);
      let fullResponse = "";
      
      for await (const chunk of stream.textStream) {
        if (chunk && typeof chunk === 'string') {
          fullResponse += chunk;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.content) {
          fullResponse += chunk.content;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.content) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        } else if (chunk && typeof chunk === 'object' && chunk.text) {
          fullResponse += chunk.text;
          // Split into characters and emit each as a separate 0: line
          for (const ch of chunk.text) {
            res.write(`0:"${encodeChunk(ch)}"\n`);
          }
        }
      }
      
      agentResponse = fullResponse;
    }
    
    // Detect delegation instruction from the agent's response and update session step
    try {
      const delegationMatch = agentResponse.match(/DELEGATION_TO_([A-Za-z0-9_-]+):\s*(.+)/);
      if (delegationMatch) {
        const targetAgent = delegationMatch[1].toLowerCase();
        const delegationMessage = delegationMatch[2];
        console.log(`🔧 [DELEGATION][LINEAR] Detected delegation to: ${targetAgent}`);
        console.log(`🔧 [DELEGATION][LINEAR] Message: ${delegationMessage}`);

        const agentToStepMap: Record<string, string> = {
          "repair-history-ticket": "repair-history",
          "repair-agent": "product-selection",
          "repair-scheduling": "scheduling",
          "customer-identification": "identification",
        };

        session.conversationStep = agentToStepMap[targetAgent] || "identification";
        session.delegationContext = {
          targetAgent,
          message: delegationMessage,
          timestamp: Date.now(),
        };
        sessionStore.set(sessionId, session);
        console.log(`🔧 [DELEGATION][LINEAR] Updated session step to: ${session.conversationStep}`);
      } else {
        // Fallback: detect textual delegation if no tool marker is present
        const lower = (agentResponse || "").toLowerCase();
        let inferredTarget: string | null = null;
        if (lower.includes("repair-agent")) inferredTarget = "repair-agent";
        else if (lower.includes("repair-scheduling")) inferredTarget = "repair-scheduling";
        else if (lower.includes("repair-history-ticket")) inferredTarget = "repair-history-ticket";
        else if (lower.includes("customer-identification")) inferredTarget = "customer-identification";
        const mentionsDelegation = lower.includes("委譲") || lower.includes("引き継") || lower.includes("delegat");
        if (inferredTarget && mentionsDelegation) {
          const agentToStepMap: Record<string, string> = {
            "repair-history-ticket": "repair-history",
            "repair-agent": "product-selection",
            "repair-scheduling": "scheduling",
            "customer-identification": "identification",
          };
          session.conversationStep = agentToStepMap[inferredTarget] || "identification";
          session.delegationContext = {
            targetAgent: inferredTarget,
            message: "Textual delegation detected",
            timestamp: Date.now(),
          };
          sessionStore.set(sessionId, session);
          console.log(`🔧 [DELEGATION][LINEAR][FALLBACK] Inferred delegation to: ${inferredTarget}`);
        }
      }
    } catch (e) {
      console.log(`❌ [DELEGATION][LINEAR] Error detecting delegation:`, e);
    }

    // Update session timestamp
    session.lastInteraction = Date.now();
    sessionStore.set(sessionId, session);
    
    // Send finish metadata
    writeFinish(res, agentResponse.length);
    
    console.log(`✅ UI Response complete, length: ${agentResponse.length} characters`);
    console.log(`✅ Updated session:`, JSON.stringify(session, null, 2));
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Legacy endpoint for UI compatibility - redirects to customer-identification
app.post("/api/agents/orchestrator/stream", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const conversationSpan = tracing.createConversationSpan(sessionId, "orchestrator_request");
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("customer-identification");
    
    if (!agent) {
      tracing.endSpan(conversationSpan, new Error("Agent 'customer-identification' not found"));
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }

    console.log(`🔍 Processing orchestrator request with ${messages.length} messages`);
    
    // Extract user input for tracing
    const userInput = messages.length > 0 ? messages[messages.length - 1]?.content : "";
    
    // Add initial conversation details to span
    tracing.addConversationDetails(conversationSpan, {
      currentAgent: "customer-identification",
      conversationStep: "orchestrator_redirect",
      userMessage: userInput,
      metadata: {
        "request.messages_count": messages.length,
        "request.session_id": sessionId,
      }
    });
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Create agent span for the actual processing
    const agentSpan = tracing.createAgentSpan("customer-identification", "stream", sessionId);
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent;
    const stream = await resolvedAgent.stream(normalizedMessages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const { fullTextLength } = await streamMastraResponseWithCollection(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    // Calculate processing time
    const processingTime = Date.now() - Date.now(); // Simplified for now
    
    // Update spans with final details including processing time
    tracing.addConversationDetails(conversationSpan, {
      agentResponse: `Response completed with ${fullTextLength} characters`,
      processingTime: processingTime,
      metadata: {
        "response.message_id": messageId,
        "response.length": fullTextLength,
        "response.processing_time_ms": processingTime,
      }
    });
    
    // Create Langfuse trace with structured format (temporarily disabled for debugging)
    // const langfuseTraceId = await langfuse.traceAgentExecution(
    //   "customer-identification",
    //   normalizedMessages,
    //   `Response completed with ${fullTextLength} characters`,
    //   {
    //     nextAgent: "determined_by_routing_logic",
    //     processingTime: processingTime,
    //     customerId: session.customerId,
    //     sessionId: sessionId
    //   }
    // );
    
    tracing.endSpan(agentSpan);
    tracing.endSpan(conversationSpan);
    
    console.log(`✅ Orchestrator Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /orchestrator/stream error:", error);
    const errorObj = error instanceof Error ? error : new Error("Unknown error");
    tracing.endSpan(conversationSpan, errorObj);
    const message = errorObj.message;
    return res.status(500).json({ error: message });
  }
});

// Individual agent endpoints for direct access
app.post("/api/agents/repair-agent/stream", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const conversationSpan = tracing.createConversationSpan(sessionId, "repair_agent_request");
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-agent");
    
    if (!agent) {
      tracing.endSpan(conversationSpan, new Error("Repair agent not found"));
      return res.status(500).json({ error: "Repair agent not found" });
    }

    // Add conversation details to span
    tracing.addConversationDetails(conversationSpan, {
      currentAgent: "repair-agent",
      conversationStep: "direct_agent_call",
      userMessage: messages.length > 0 ? messages[messages.length - 1]?.content : "",
      metadata: {
        "request.messages_count": messages.length,
        "request.session_id": sessionId,
      }
    });

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Create agent span for the actual processing
    const agentSpan = tracing.createAgentSpan("repair-agent", "stream", sessionId);

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const { fullTextLength } = await streamMastraResponseWithCollection(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    // Calculate processing time
    const processingTime = Date.now() - Date.now(); // Simplified for now
    
    // Update spans with final details including processing time
    tracing.addConversationDetails(conversationSpan, {
      agentResponse: `Response completed with ${fullTextLength} characters`,
      processingTime: processingTime,
      metadata: {
        "response.message_id": messageId,
        "response.length": fullTextLength,
        "response.processing_time_ms": processingTime,
      }
    });
    
    // Create Langfuse trace with structured format (temporarily disabled for debugging)
    // const langfuseTraceId = await langfuse.traceAgentExecution(
    //   "repair-agent",
    //   messages,
    //   `Response completed with ${fullTextLength} characters`,
    //   {
    //     nextAgent: "determined_by_agent_logic",
    //     processingTime: processingTime,
    //     customerId: session.customerId,
    //     sessionId: sessionId
    //   }
    // );
    
    tracing.endSpan(agentSpan);
    tracing.endSpan(conversationSpan);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-agent/stream error:", error);
    const errorObj = error instanceof Error ? error : new Error("Unknown error");
    tracing.endSpan(conversationSpan, errorObj);
    const message = errorObj.message;
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-history-ticket/stream", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const conversationSpan = tracing.createConversationSpan(sessionId, "repair_history_request");
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-history-ticket");
    
    if (!agent) {
      tracing.endSpan(conversationSpan, new Error("Repair history agent not found"));
      return res.status(500).json({ error: "Repair history agent not found" });
    }

    // Add conversation details to span
    tracing.addConversationDetails(conversationSpan, {
      currentAgent: "repair-history-ticket",
      conversationStep: "direct_agent_call",
      userMessage: messages.length > 0 ? messages[messages.length - 1]?.content : "",
      metadata: {
        "request.messages_count": messages.length,
        "request.session_id": sessionId,
      }
    });

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Create agent span for the actual processing
    const agentSpan = tracing.createAgentSpan("repair-history-ticket", "stream", sessionId);

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const { fullTextLength } = await streamMastraResponseWithCollection(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    // Update spans with final details
    tracing.addConversationDetails(conversationSpan, {
      agentResponse: `Response completed with ${fullTextLength} characters`,
      metadata: {
        "response.message_id": messageId,
        "response.length": fullTextLength,
      }
    });
    
    tracing.endSpan(agentSpan);
    tracing.endSpan(conversationSpan);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-history-ticket/stream error:", error);
    const errorObj = error instanceof Error ? error : new Error("Unknown error");
    tracing.endSpan(conversationSpan, errorObj);
    const message = errorObj.message;
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-scheduling/stream", async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const conversationSpan = tracing.createConversationSpan(sessionId, "repair_scheduling_request");
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const session = getSession(sessionId);
    const agent = await getAgentById("repair-scheduling");
    
    if (!agent) {
      tracing.endSpan(conversationSpan, new Error("Repair scheduling agent not found"));
      return res.status(500).json({ error: "Repair scheduling agent not found" });
    }

    // Add conversation details to span
    tracing.addConversationDetails(conversationSpan, {
      currentAgent: "repair-scheduling",
      conversationStep: "direct_agent_call",
      customerId: session.customerId,
      userMessage: messages.length > 0 ? messages[messages.length - 1]?.content : "",
      metadata: {
        "request.messages_count": messages.length,
        "request.session_id": sessionId,
        "session.customer_id": session.customerId || "",
      }
    });

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Create agent span for the actual processing
    const agentSpan = tracing.createAgentSpan("repair-scheduling", "stream", sessionId);

    // Create a context object with session data for tools
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const { fullTextLength } = await streamMastraResponseWithCollection(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    // Update spans with final details
    tracing.addConversationDetails(conversationSpan, {
      agentResponse: `Response completed with ${fullTextLength} characters`,
      metadata: {
        "response.message_id": messageId,
        "response.length": fullTextLength,
      }
    });
    
    tracing.endSpan(agentSpan);
    tracing.endSpan(conversationSpan);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-scheduling/stream error:", error);
    const errorObj = error instanceof Error ? error : new Error("Unknown error");
    tracing.endSpan(conversationSpan, errorObj);
    const message = errorObj.message;
    return res.status(500).json({ error: message });
  }
});

// Start server
const PORT = process.env.PORT || 80;

const server = app.listen(PORT, () => {
  console.log(`🚀 Mastra server started successfully!`);
  console.log(`🌐 Server running on port ${PORT} (configured in Lightsail firewall)`);
  console.log(`🔗 Main endpoint: POST /api/agents/customer-identification/stream`);
  console.log(`🔗 Legacy endpoints: POST /api/agents/repair-workflow-orchestrator/stream (redirects to customer-identification)`);
  console.log(`🔗 Individual agent endpoints:`);
  console.log(`   - POST /api/agents/repair-agent/stream`);
  console.log(`   - POST /api/agents/repair-history-ticket/stream`);
  console.log(`   - POST /api/agents/repair-scheduling/stream`);
  console.log(`🔗 Health check: GET /health`);
});

// Set server timeout to 60 seconds for long-running requests
server.timeout = 60000;

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully...');
  await tracing.shutdown();
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  await tracing.shutdown();
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});
