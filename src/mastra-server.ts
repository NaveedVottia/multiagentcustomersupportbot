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
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
}));
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

// Stream Mastra response using f0ed protocol with ai.streamtext tracing
async function streamMastraResponse(stream: any, res: Response, conversationData?: {
  sessionId: string;
  agentId: string;
  userInput: string;
  startTime: number;
}): Promise<number> {
  let totalLength = 0;
  let accumulatedText = '';
  
  try {
    for await (const chunk of stream.textStream) {
      if (typeof chunk === 'string' && chunk.trim()) {
        totalLength += chunk.length;
        accumulatedText += chunk;
        
        // Split into characters and emit each as a separate 0: line
        for (const ch of chunk) {
          res.write(`0:"${encodeChunk(ch)}"\n`);
        }
      }
    }
    
    // Create conversation flow trace after response is complete
    if (conversationData && accumulatedText) {
      const processingTime = Math.round((Date.now() - conversationData.startTime) / 1000);
      await tracing.createConversationFlowTrace(conversationData.sessionId, {
        userInput: conversationData.userInput,
        agentId: conversationData.agentId,
        agentOutput: accumulatedText,
        processingTime: processingTime,
      });
    }
    
  } catch (error) {
    console.error("❌ Error streaming response:", error);
    const fallback = "申し訳ございませんが、エラーが発生しました。";
    totalLength = fallback.length;
    
    // Create conversation flow trace for error case
    if (conversationData) {
      const processingTime = Math.round((Date.now() - conversationData.startTime) / 1000);
      await tracing.createConversationFlowTrace(conversationData.sessionId, {
        userInput: conversationData.userInput,
        agentId: conversationData.agentId,
        agentOutput: fallback,
        processingTime: processingTime,
      });
    }
    
    for (const ch of fallback) {
      res.write(`0:"${encodeChunk(ch)}"\n`);
    }
  }

  // If nothing was streamed, emit an empty line to satisfy protocol
  if (totalLength === 0) {
    const msg = "";
    if (conversationData) {
      const processingTime = Math.round((Date.now() - conversationData.startTime) / 1000);
      await tracing.createConversationFlowTrace(conversationData.sessionId, {
        userInput: conversationData.userInput,
        agentId: conversationData.agentId,
        agentOutput: msg,
        processingTime: processingTime,
      });
    }
    res.write(`0:"${encodeChunk(msg)}"\n`);
  }

  return totalLength;
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
    
    const orchestratorAgent = await agent;
    console.log("🔍 Resolved agent for test");
    console.log("🔍 Agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)));
    console.log("🔍 Agent type:", typeof orchestratorAgent);
    
    // Try to execute without streaming
    if (typeof orchestratorAgent.stream === 'function') {
      console.log("🔍 Testing stream method...");
      const stream = await orchestratorAgent.stream(messages);
      console.log("🔍 Stream created, trying to read...");
      
      // Try to read from the stream
      let result = "";
      for await (const chunk of stream.textStream) {
        if (typeof chunk === 'string') {
          result += chunk;
        }
      }
      
      return res.json({ success: true, result: result });
    } else if (typeof orchestratorAgent.execute === 'function') {
      const result = await orchestratorAgent.execute(messages);
      return res.json({ success: true, result: result });
    } else if (typeof orchestratorAgent.run === 'function') {
      const result = await orchestratorAgent.run(messages);
      return res.json({ success: true, result: result });
    } else {
      return res.status(500).json({ error: "Agent does not have execute or run method", methods: Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)) });
    }
    
  } catch (error: unknown) {
    console.error("❌ [Test endpoint] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Main endpoint for the customer identification agent (main entry point)
app.post("/api/agents/customer-identification/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
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
    
    // Determine which agent to use based on session state and user input
    let targetAgentId = "customer-identification";
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // If customer is already identified and user selects a menu option, route to appropriate agent
    if (session.customerId && session.conversationStep === "menu") {
      if (userInput === "1" || userInput.includes("修理履歴") || userInput.includes("repair history")) {
        // Keep using customer-identification agent but it will use directRepairHistory tool
        targetAgentId = "customer-identification";
        session.conversationStep = "repair-history";
        console.log(`🔍 Using customer-identification agent with directRepairHistory tool for customer: ${session.customerId}`);
      } else if (userInput === "2" || userInput.includes("製品") || userInput.includes("product")) {
        targetAgentId = "repair-agent";
        session.conversationStep = "product-selection";
        console.log(`🔍 Routing to repair-agent for customer: ${session.customerId}`);
      } else if (userInput === "3" || userInput.includes("予約") || userInput.includes("scheduling")) {
        targetAgentId = "repair-scheduling";
        session.conversationStep = "scheduling";
        console.log(`🔍 Routing to repair-scheduling for customer: ${session.customerId}`);
      }
    }
    
    // If customer is identified for the first time, update session
    if (!session.customerId && userInput.match(/CUST\d+/)) {
      session.customerId = userInput;
      session.conversationStep = "menu";
      console.log(`🔍 Customer identified: ${session.customerId}`);
      
      // Also store customer data in shared memory for tools to access
      try {
        const mastra = await mastraPromise;
        const customerAgent = mastra.getAgentById("customer-identification");
        if (customerAgent) {
          const orchestratorAgent = await customerAgent;
          if (orchestratorAgent.memory) {
            orchestratorAgent.memory.set("customerId", session.customerId);
            orchestratorAgent.memory.set("sessionId", sessionId);
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
    const orchestratorAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)));
    console.log("🔍 Resolved agent type:", typeof orchestratorAgent);
    console.log("🔍 Resolved agent stream method:", typeof orchestratorAgent.stream);
    
    // Create a context object with session data for tools only
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };
    
    console.log(`🔍 Tool context:`, JSON.stringify(toolContext, null, 2));
    
    // Create proper memory identifiers for agent calls - use unique thread per session
    const memoryIds = {
      resource: sessionId,
      thread: `customer-conversation-${sessionId}`
    };
    
    console.log(`🔍 [DEBUG] Using memory identifiers:`, memoryIds);
    
    // Try different methods based on Mastra documentation
    let stream;
    if (typeof orchestratorAgent.stream === 'function') {
      stream = await orchestratorAgent.stream(normalizedMessages, { memory: memoryIds });
    } else if (typeof orchestratorAgent.execute === 'function') {
      const result = await orchestratorAgent.execute(normalizedMessages);
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
    } else if (typeof orchestratorAgent.run === 'function') {
      const result = await orchestratorAgent.run(normalizedMessages);
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
      throw new Error(`Agent does not have stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)).join(', ')}`);
    }
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    console.log(`✅ Updated session:`, JSON.stringify(session, null, 2));
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /customer-identification/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Orchestrator endpoint - determines which agent to use based on conversation context
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 [ORCHESTRATOR] Processing ${messages.length} messages for session: ${sessionId}`);
    
    // Determine which agent to use based on conversation context
    let targetAgentId = "customer-identification"; // Default to customer identification
    
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Handle both string and array content formats
      let messageContent = "";
      if (lastMessage.content) {
        if (typeof lastMessage.content === 'string') {
          messageContent = lastMessage.content.toLowerCase();
        } else if (Array.isArray(lastMessage.content)) {
          messageContent = lastMessage.content
            .filter((item: any) => item.type === 'text' && item.text)
            .map((item: any) => item.text)
            .join(' ')
            .toLowerCase();
        }
      }
      
      // Check if customer is already identified
      if (session.customerId) {
        // Customer is identified, route to appropriate agent based on request
        if (messageContent.includes("1") || messageContent.includes("修理履歴") || messageContent.includes("repair history")) {
          targetAgentId = "repair-history-ticket";
        } else if (messageContent.includes("2") || messageContent.includes("登録製品") || messageContent.includes("product")) {
          targetAgentId = "repair-agent";
        } else if (messageContent.includes("3") || messageContent.includes("予約") || messageContent.includes("schedule")) {
          targetAgentId = "repair-scheduling";
        } else if (messageContent.includes("4") || messageContent.includes("メイン") || messageContent.includes("main")) {
          targetAgentId = "customer-identification";
        }
      }
    }
    
    console.log(`🎯 [ORCHESTRATOR] Routing to agent: ${targetAgentId}`);
    
    const agent = await getAgentById(targetAgentId);
    
    if (!agent) {
      return res.status(500).json({ error: `Agent '${targetAgentId}' not found` });
    }

    console.log(`🔍 Processing UI request with ${messages.length} messages`);
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));
    
    // Store sessionId in agent memory for proper memory sharing
    const orchestratorAgent = await agent;
    if (orchestratorAgent.memory) {
      orchestratorAgent.memory.set("sessionId", sessionId);
    }
    
    // Create proper memory identifiers for agent calls as per Mastra documentation
    // Create proper memory identifiers for agent calls - use unique thread per session
    const memoryIds = {
      resource: sessionId,
      thread: `customer-conversation-${sessionId}`
    };
    
    console.log(`🔍 [ORCHESTRATOR] Using memory identifiers:`, memoryIds);
    
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
    
    // Extract user input for tracing
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Execute the agent using Mastra's stream method
    console.log("🔍 Orchestrator agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)));
    console.log("🔍 Orchestrator agent type:", typeof orchestratorAgent);
    console.log("🔍 Orchestrator agent stream method:", typeof orchestratorAgent.stream);
    
    // Try different methods based on Mastra documentation
    let stream;
    if (typeof orchestratorAgent.stream === 'function') {
      stream = await orchestratorAgent.stream(normalizedMessages, { memory: memoryIds });
    } else if (typeof orchestratorAgent.execute === 'function') {
      const result = await orchestratorAgent.execute(normalizedMessages);
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
    } else if (typeof orchestratorAgent.run === 'function') {
      const result = await orchestratorAgent.run(normalizedMessages);
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
      throw new Error(`Agent does not have stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorAgent)).join(', ')}`);
    }
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ UI Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// OPTIONS handlers for CORS preflight
app.options("/api/agents/customer-identification/stream", cors());
app.options("/api/agents/repair-workflow-orchestrator/stream", cors());
app.options("/api/agents/repair-agent/stream", cors());
app.options("/api/agents/repair-history-ticket/stream", cors());
app.options("/api/agents/repair-scheduling/stream", cors());
app.options("/api/agents/orchestrator/stream", cors());

// Legacy endpoint for UI compatibility - redirects to customer-identification
app.post("/api/agents/orchestrator/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const agent = await getAgentById("customer-identification");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }

    console.log(`🔍 Processing orchestrator request with ${messages.length} messages`);
    
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
    
    // Extract user input for tracing
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    const targetAgentId = "customer-identification";
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Execute the agent using Mastra's stream method
    const orchestratorAgent = await agent;
    const stream = await orchestratorAgent.stream(normalizedMessages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Orchestrator Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Individual agent endpoints for direct access
app.post("/api/agents/repair-agent/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const agent = await getAgentById("repair-agent");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair agent not found" });
    }

    // Extract user input for tracing
    const userInput = messages[messages.length - 1]?.content || "";
    const targetAgentId = "repair-agent";

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const orchestratorAgent = await agent; // Resolve the agent promise first
    const stream = await orchestratorAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-agent/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-history-ticket/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const agent = await getAgentById("repair-history-ticket");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair history agent not found" });
    }

    // Extract user input for tracing
    const userInput = messages[messages.length - 1]?.content || "";
    const targetAgentId = "repair-history-ticket";

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const orchestratorAgent = await agent; // Resolve the agent promise first
    const stream = await orchestratorAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-history-ticket/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-scheduling/stream", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    const agent = await getAgentById("repair-scheduling");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair scheduling agent not found" });
    }

    // Extract user input for tracing
    const userInput = messages[messages.length - 1]?.content || "";
    const targetAgentId = "repair-scheduling";

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Create a context object with session data for tools
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };

    // Execute the agent using Mastra's stream method
    const orchestratorAgent = await agent; // Resolve the agent promise first
    const stream = await orchestratorAgent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res, {
      sessionId,
      agentId: targetAgentId,
      userInput,
      startTime,
    });
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-scheduling/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
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
