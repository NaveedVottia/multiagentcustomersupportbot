import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra/index";
import { langfuse, type SessionData, type EvaluationScore } from "./integrations/langfuse";

// Load environment variables from server.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../..", "server.env") });

// Log environment variable status for debugging
console.log("🔍 Environment Variables Status:");
console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");
console.log("ZAPIER_MCP_URL:", process.env.ZAPIER_MCP_URL ? "✅ Set" : "❌ Missing");
console.log("ZAPIER_MCP:", process.env.ZAPIER_MCP ? "✅ Set" : "❌ Missing");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'https://demo.dev-maestra.vottia.me',
    'https://mastra.demo.dev-maestra.vottia.me',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-ID', 'X-User-ID', 'Authorization'],
  exposedHeaders: ["Content-Type", "Cache-Control", "Connection", "X-Accel-Buffering", "X-Session-ID", "X-User-ID"]
};

app.use(cors(corsOptions));

// Global OPTIONS handler for all routes
app.options('*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID, X-User-ID, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.sendStatus(204);
});

// JSON parsing
app.use(express.json());

// Session management middleware
app.use((req: Request, res: Response, next) => {
  // Extract session info from headers or body
  const sessionId = req.headers['x-session-id'] as string || req.body?.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const userId = req.headers['x-user-id'] as string || req.body?.userId;
  
  // Start or continue session
  if (sessionId) {
    langfuse.startSession(sessionId, userId, {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    });
    
    // Add session info to response headers
    res.setHeader('X-Session-ID', sessionId);
    if (userId) {
      res.setHeader('X-User-ID', userId);
    }
  }
  
  next();
});

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Get the resolved mastra instance
    const mastraInstance = await mastra;
    
    // Try different ways to access agents
    let agents: string[] = [];
    try {
      console.log("🔍 Health check: Checking Mastra instance...");
      console.log("mastra type:", typeof mastraInstance);
      console.log("mastra.getAgentById:", typeof mastraInstance.getAgentById);
      
      if (mastraInstance.getAgentById) {
        // Try to get agents by known IDs
        const knownAgents = ["repair-workflow-orchestrator", "routing-agent-customer-identification", "repair-agent-product-selection", "repair-qa-agent-issue-analysis", "repair-visit-confirmation-agent"];
        console.log("Trying known agent IDs:", knownAgents);
        
        for (const id of knownAgents) {
          const agent = mastraInstance.getAgentById(id);
          if (agent) {
            agents.push(id);
            console.log(`✅ Found agent: ${id}`);
          } else {
            console.log(`❌ Agent not found: ${id}`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error checking agents:", error);
    }

    const langfuseEnabled = Boolean(process.env.LANGFUSE_HOST && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
    const currentSession = langfuse.getCurrentSession();

    res.json({
      ok: true,
      service: "mastra-server",
      time: new Date().toISOString(),
      agents: agents,
      mastraType: typeof mastraInstance,
      hasAgents: agents.length > 0,
      hasGetAgentById: !!mastraInstance.getAgentById,
      zapierMcpUrl: process.env.ZAPIER_MCP_URL ? "✅ Set" : "❌ Missing",
      zapierMcp: process.env.ZAPIER_MCP ? "✅ Set" : "❌ Missing",
      langfuse: {
        enabled: langfuseEnabled ? "✅ Enabled" : "❌ Disabled",
        host: process.env.LANGFUSE_HOST || null,
        currentSession: currentSession ? {
          sessionId: currentSession.sessionId,
          userId: currentSession.userId,
          hasMetadata: !!currentSession.metadata
        } : null
      }
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to initialize Mastra instance",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Langfuse connectivity probe
app.get("/health/langfuse", async (req: Request, res: Response) => {
  try {
    const connected = await langfuse.testConnection();
    return res.status(200).json({ ok: connected, connected });
  } catch (e) {
    return res.status(200).json({ ok: false, connected: false, error: (e as Error).message });
  }
});

// Debug endpoint to test prompt loading
app.get("/debug/prompts/:promptName", async (req: Request, res: Response) => {
  try {
    const promptName = req.params.promptName;
    console.log(`🔍 Debug: Testing prompt loading for: ${promptName}`);
    
    const promptText = await langfuse.getPromptText(promptName, "production");
    
    res.status(200).json({
      success: true,
      promptName,
      promptText: promptText.substring(0, 500) + (promptText.length > 500 ? "..." : ""),
      promptLength: promptText.length,
      hasContent: promptText.length > 0
    });
  } catch (error) {
    console.error(`❌ Debug prompt error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      promptName: req.params.promptName
    });
  }
});

// Session management endpoints
app.post("/api/session/start", (req: Request, res: Response) => {
  try {
    const { sessionId, userId, metadata } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    
    langfuse.startSession(sessionId, userId, metadata);
    const currentSession = langfuse.getCurrentSession();
    
    res.status(200).json({
      success: true,
      session: currentSession,
      message: "Session started successfully"
    });
  } catch (error) {
    console.error("❌ Session start error:", error);
    res.status(500).json({ error: "Failed to start session" });
  }
});

app.post("/api/session/end", (req: Request, res: Response) => {
  try {
    langfuse.endSession();
    res.status(200).json({
      success: true,
      message: "Session ended successfully"
    });
  } catch (error) {
    console.error("❌ Session end error:", error);
    res.status(500).json({ error: "Failed to end session" });
  }
});

app.get("/api/session/current", (req: Request, res: Response) => {
  try {
    const currentSession = langfuse.getCurrentSession();
    res.status(200).json({
      success: true,
      session: currentSession
    });
  } catch (error) {
    console.error("❌ Session get error:", error);
    res.status(500).json({ error: "Failed to get current session" });
  }
});

app.post("/api/user/set", (req: Request, res: Response) => {
  try {
    const { userId, metadata } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    langfuse.setUser(userId, metadata);
    const currentSession = langfuse.getCurrentSession();
    
    res.status(200).json({
      success: true,
      session: currentSession,
      message: "User set successfully"
    });
  } catch (error) {
    console.error("❌ User set error:", error);
    res.status(500).json({ error: "Failed to set user" });
  }
});

// Evaluation endpoints
app.post("/api/evaluate/response", async (req: Request, res: Response) => {
  try {
    const { responseText, score, comment, criteria, metadata } = req.body;
    
    if (typeof responseText !== 'string' || typeof score !== 'number') {
      return res.status(400).json({ error: "responseText (string) and score (number) are required" });
    }
    
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }
    
    const evaluationScore: EvaluationScore = {
      score,
      comment,
      criteria,
      metadata
    };
    
    await langfuse.scoreResponse(responseText, evaluationScore);
    
    res.status(200).json({
      success: true,
      message: "Response evaluated successfully",
      evaluation: evaluationScore
    });
  } catch (error) {
    console.error("❌ Response evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate response" });
  }
});

app.post("/api/evaluate/trace", async (req: Request, res: Response) => {
  try {
    const { traceId, score, comment, criteria, metadata } = req.body;
    
    if (!traceId || typeof score !== 'number') {
      return res.status(400).json({ error: "traceId and score (number) are required" });
    }
    
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }
    
    const evaluationScore: EvaluationScore = {
      score,
      comment,
      criteria,
      metadata
    };
    
    await langfuse.scoreTrace(traceId, evaluationScore);
    
    res.status(200).json({
      success: true,
      message: "Trace evaluated successfully",
      evaluation: evaluationScore
    });
  } catch (error) {
    console.error("❌ Trace evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate trace" });
  }
});

app.post("/api/evaluate/batch", async (req: Request, res: Response) => {
  try {
    const { responses } = req.body;
    
    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: "responses array is required" });
    }
    
    const validResponses = responses.filter(r => 
      typeof r.text === 'string' && 
      typeof r.score === 'number' && 
      r.score >= 0 && r.score <= 10
    );
    
    if (validResponses.length === 0) {
      return res.status(400).json({ error: "No valid responses found" });
    }
    
    await langfuse.scoreMultipleResponses(validResponses);
    
    res.status(200).json({
      success: true,
      message: "Batch evaluation completed successfully",
      evaluated: validResponses.length,
      total: responses.length
    });
  } catch (error) {
    console.error("❌ Batch evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate batch" });
  }
});

// Utility evaluation endpoints
app.post("/api/evaluate/customer-service", async (req: Request, res: Response) => {
  try {
    const { responseText, score, comment } = req.body;
    
    if (typeof responseText !== 'string' || typeof score !== 'number') {
      return res.status(400).json({ error: "responseText (string) and score (number) are required" });
    }
    
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }
    
    await langfuse.scoreCustomerServiceResponse(responseText, score, comment);
    
    res.status(200).json({
      success: true,
      message: "Customer service response evaluated successfully",
      score,
      comment
    });
  } catch (error) {
    console.error("❌ Customer service evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate customer service response" });
  }
});

app.post("/api/evaluate/technical", async (req: Request, res: Response) => {
  try {
    const { responseText, score, comment } = req.body;
    
    if (typeof responseText !== 'string' || typeof score !== 'number') {
      return res.status(400).json({ error: "responseText (string) and score (number) are required" });
    }
    
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }
    
    await langfuse.scoreTechnicalAccuracy(responseText, score, comment);
    
    res.status(200).json({
      success: true,
      message: "Technical response evaluated successfully",
      score,
      comment
    });
  } catch (error) {
    console.error("❌ Technical evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate technical response" });
  }
});

app.post("/api/evaluate/ux", async (req: Request, res: Response) => {
  try {
    const { responseText, score, comment } = req.body;
    
    if (typeof responseText !== 'string' || typeof score !== 'number') {
      return res.status(400).json({ error: "responseText (string) and score (number) are required" });
    }
    
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }
    
    await langfuse.scoreUserExperience(responseText, score, comment);
    
    res.status(200).json({
      success: true,
      message: "User experience evaluated successfully",
      score,
      comment
    });
  } catch (error) {
    console.error("❌ UX evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate user experience" });
  }
});

// Helper function to get agent by ID
async function getAgentById(agentId: string) {
  try {
    const mastraInstance = await mastra;
    if (mastraInstance.getAgentById) {
      return mastraInstance.getAgentById(agentId);
    }
    return null;
  } catch (error) {
    console.error("❌ Error getting agent:", error);
    return null;
  }
}

// Helper function to stream response in Mastra format
async function streamMastraResponse(stream: any, res: Response): Promise<number> {
  const encodeChunk = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/\"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");

  let totalLength = 0;
  let fullResponse = "";

  try {
    // Collect the full response first
    for await (const chunk of stream.textStream) {
      if (typeof chunk === "string") {
        fullResponse += chunk;
      }
    }
    
    // Robust JSON parsing with preamble handling
    let textToStream = "Sorry, an error occurred.";
    let menuItems: any[] = [];

    try {
      // 1) try full parse
      let parsed: any;
      try { 
        parsed = JSON.parse(fullResponse); 
      } catch {
        // 2) extract first {...} and parse that
        const jsonSlice = extractFirstJsonObject(fullResponse);
        if (jsonSlice) parsed = JSON.parse(jsonSlice);
      }

      if (parsed?.ui?.text) {
        textToStream = parsed.ui.text;
        // Remove any processing indicators from the agent response
        textToStream = textToStream.replace(/^\(処理中\.\.\.\)/, "").replace(/^\(processing\.\.\.\)/, "");
        textToStream = textToStream.trim();
        
        // Add processing indicator at the beginning if needed
        if (parsed.ui.show_processing || textToStream.length > 0) {
          textToStream = "(処理中...)" + textToStream;
        }
        menuItems = Array.isArray(parsed.ui.menu) ? parsed.ui.menu : [];
        console.log("✅ Parsed ui from JSON (with extractor)");
        console.log("📝 Extracted text:", textToStream.substring(0, 100) + "...");
      } else {
        console.log("⚠️ No ui.text in parsed JSON");
        textToStream = "Sorry, unable to process the response.";
      }
    } catch {
      // 3) last resort: raw trimmed (but never the JSON blob)
      console.log("📝 Falling back to raw response (no valid JSON found)");
      const withoutBraces = fullResponse.replace(/\{[\s\S]*\}/g, "").trim();
      textToStream = withoutBraces || "Sorry, unable to process the response.";
    }
    
    // Stream the natural text (not JSON)
    totalLength = textToStream.length;
    for (const ch of textToStream) {
      res.write(`0:"${encodeChunk(ch)}"\n`);
    }
    
    // Log menu items for debugging (UI can extract these separately)
    if (menuItems.length > 0) {
      console.log("📋 Menu items available:", menuItems);
    }
    
  } catch (streamError) {
    console.error("❌ Stream error:", streamError);
    if (stream.response && typeof stream.response === "string") {
      const fallback = stream.response;
      totalLength = fallback.length;
      for (const ch of fallback) {
        res.write(`0:"${encodeChunk(ch)}"\n`);
      }
    }
  }

  // If nothing was streamed, emit an empty line to satisfy protocol
  if (totalLength === 0) {
    const msg = "";
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

// Helper function to write processing indicator
function writeProcessingIndicator(res: Response, lang: "ja"|"en" = "ja") {
  const indicator = lang === "ja" ? "(処理中...)" : "(processing...)";
  for (const ch of indicator) res.write(`0:"${ch}"\n`);
}

// Extract first balanced JSON object from text (handles preambles)
function extractFirstJsonObject(input: string): string | null {
  let start = -1, depth = 0, inStr = false, esc = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (start === -1) {
      if (c === '{') { start = i; depth = 1; inStr = false; esc = false; }
      continue;
    }
    if (inStr) {
      if (esc) { esc = false; }
      else if (c === '\\') { esc = true; }
      else if (c === '"') { inStr = false; }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

// Extract contact fields from user input to help with customer identification
function extractContactFields(s: string) {
  const email = (s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
  const phone = (s.match(/(\+?\d[\d\-()\s]{7,}\d)/) || [])[0] || "";
  // crude: company = leftover words around non-email/phone
  let company = s.replace(email, "").replace(phone, "").trim();
  company = company.replace(/[|,、\s]{2,}/g, " ").trim();
  return { company, email, phone };
}

// Write finish metadata (e:/d:) and flush
function writeFinish(res: Response, fullTextLength: number, promptTokens: number = 0): void {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":${promptTokens},"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":${promptTokens},"completionTokens":${fullTextLength}}}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Main endpoint for the repair workflow orchestrator
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-workflow-orchestrator");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent 'repair-workflow-orchestrator' not found" });
    }

    console.log(`🔍 Processing request with ${messages.length} messages`);
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));
    
    // Get current session info for logging
    const currentSession = langfuse.getCurrentSession();
    console.log(`🔍 Current session:`, currentSession);
    
    // Start a trace for this request
    const traceId = await langfuse.startTrace("repair-workflow-orchestrator", {
      endpoint: "/api/agents/repair-workflow-orchestrator/stream",
      messageCount: messages.length,
      sessionId: currentSession?.sessionId,
      userId: currentSession?.userId
    });
    
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
    
    // Extract contact fields from user input to help with customer identification
    const lastUser = normalizedMessages.slice().reverse().find((m: any) => m.role === "user")?.content || "";
    const extracted = extractContactFields(lastUser);
    const contextMsg = {
      role: "system",
      content: `parsed_contact_hint:${JSON.stringify(extracted)}`
    };
    // Prepend context so the model can use it safely
    const msgForAgent = [contextMsg, ...normalizedMessages];
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(msgForAgent);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Calculate prompt tokens (approximate - each message roughly 10-20 tokens)
    const promptTokens = Math.max(1, msgForAgent.length * 15);
    
    // Send finish metadata
    writeFinish(res, fullTextLength, promptTokens);
    
    // Log tool execution and end trace
    await langfuse.logToolExecution(traceId, "repair-workflow-orchestrator", {
      messages: msgForAgent,
      extracted: extracted
    }, {
      responseLength: fullTextLength,
      promptTokens,
      messageId
    });
    
    await langfuse.endTrace(traceId, {
      responseLength: fullTextLength,
      promptTokens,
      messageId,
      success: true
    });
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters, trace: ${traceId}`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    
    // Log error in trace if we have one
    const currentSession = langfuse.getCurrentSession();
    if (currentSession) {
      await langfuse.logToolExecution(null, "repair-workflow-orchestrator-error", {
        error: message,
        sessionId: currentSession.sessionId
      }, {
        error: true,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(500).json({ error: message });
  }
});

// Alternative endpoint for direct agent access
app.post("/api/agents/direct-agent/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-workflow-orchestrator");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Send processing indicator immediately
    writeProcessingIndicator(res, "ja");
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /direct-agent/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Individual agent endpoints for direct access
app.post("/api/agents/customerIdentification/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("routing-agent-customer-identification");
    
    if (!agent) {
      return res.status(500).json({ error: "Customer identification agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Send processing indicator immediately
    writeProcessingIndicator(res, "ja");
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /customerIdentification/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/productSelection/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-agent-product-selection");
    
    if (!agent) {
      return res.status(500).json({ error: "Product selection agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Send processing indicator immediately
    writeProcessingIndicator(res, "ja");
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /productSelection/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/issueAnalysis/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-qa-agent-issue-analysis");
    
    if (!agent) {
      return res.status(500).json({ error: "Issue analysis agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Send processing indicator immediately
    writeProcessingIndicator(res, "ja");
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /issueAnalysis/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/visitConfirmation/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-visit-confirmation-agent");
    
    if (!agent) {
      return res.status(500).json({ error: "Visit confirmation agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Send processing indicator immediately
    writeProcessingIndicator(res, "ja");
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength, 0); // No prompt tokens for visit confirmation
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /visitConfirmation/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Debug endpoint to check agent status
app.get("/debug/agents/:agentId", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const mastraInstance = await mastra;
    
    if (mastraInstance.getAgentById) {
      const agent = mastraInstance.getAgentById(agentId);
      if (agent) {
        return res.json({
          agentId,
          name: agent.name,
          description: agent.getDescription ? agent.getDescription() : "No description",
          available: true,
          tools: agent.tools ? Object.keys(agent.tools) : [],
          memory: "Available" // Memory is configured by default in Mastra
        });
      } else {
        console.log(`🔍 Available agents: Using getAgentById method`);
        return res.status(404).json({
          error: "Agent not found",
          agentId,
          availableAgents: ["repair-workflow-orchestrator", "routing-agent-customer-identification", "repair-agent-product-selection", "repair-qa-agent-issue-analysis", "repair-visit-confirmation-agent"],
          hasGetAgentById: !!mastraInstance.getAgentById
        });
      }
    } else {
      return res.status(500).json({
        error: "Mastra instance not properly initialized",
        agentId,
        availableAgents: ["repair-workflow-orchestrator", "routing-agent-customer-identification", "repair-agent-product-selection", "repair-qa-agent-issue-analysis", "repair-visit-confirmation-agent"],
        hasGetAgentById: !!mastraInstance.getAgentById
      });
    }
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Debug endpoint to check agent instructions
app.get("/debug/agents/:agentId/instructions", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    console.log(`🔍 Debug: Checking agent instructions for: ${agentId}`);
    
    const agent = await getAgentById(agentId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentId} not found`
      });
    }
    
    // Try to get instructions using different methods
    let instructions = "";
    let methodUsed = "none";
    
    try {
      if (typeof agent.getInstructions === "function") {
        instructions = await agent.getInstructions();
        methodUsed = "getInstructions";
      } else if (agent.instructions) {
        instructions = agent.instructions;
        methodUsed = "agent.instructions";
      } else if (typeof agent.getInstructions === "function") {
        instructions = await agent.getInstructions();
        methodUsed = "getInstructions";
      }
    } catch (error) {
      console.error(`❌ Error getting instructions:`, error);
    }
    
    res.status(200).json({
      success: true,
      agentId,
      methodUsed,
      instructions: instructions.substring(0, 500) + (instructions.length > 500 ? "..." : ""),
      instructionsLength: instructions.length,
      hasInstructions: instructions.length > 0
    });
  } catch (error) {
    console.error(`❌ Debug agent instructions error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      agentId: req.params.agentId
    });
  }
});


// Start the server on port 3000 for development (port 80 for production)
const port = process.env.NODE_ENV === 'production' ? 80 : 3000;
const server = app.listen(port, () => {
  console.log("🚀 Mastra server started successfully!");
  console.log(`🌐 Server running on port ${port} (configured in Lightsail firewall)`);
  console.log(`🔗 Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream`);
  console.log(`🔗 Alternative endpoint: POST /api/agents/direct-agent/stream`);
  console.log(`🔗 Individual agent endpoints:`);
  console.log(`   - POST /api/agents/customerIdentification/stream`);
  console.log(`   - POST /api/agents/productSelection/stream`);
  console.log(`   - POST /api/agents/issueAnalysis/stream`);
  console.log(`   - POST /api/agents/visitConfirmation/stream`);
  console.log(`🔗 Health check: GET /health`);
  // Note: mastra is now a Promise, so we can't access agents directly here
  console.log(`✅ Mastra instance configured for port ${port}`);

  // Verify Langfuse tracing connectivity
  try {
    langfuse.testConnection()
      .then((ok) => {
        console.log(`[Langfuse] Tracing connectivity: ${ok ? "✅ Connected" : "❌ Disabled/Fallback"}`);
      })
      .catch((err) => {
        console.error(`[Langfuse] Tracing connectivity check failed:`, err);
      });
  } catch (e) {
    console.error(`[Langfuse] Tracing connectivity check error:`, e);
  }
});

server.on("error", (err: unknown) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
const shutdown = () => {
  console.log("🛑 Shutting down server...");
  server.close((error?: Error) => {
    if (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    } else {
      console.log("✅ Server stopped gracefully");
      process.exit(0);
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
