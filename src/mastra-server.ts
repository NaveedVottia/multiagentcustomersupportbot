import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra/index";
import { langfuse } from "./integrations/langfuse";

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

// CORS
app.use(cors({
  origin: "*",
  credentials: true,
  exposedHeaders: ["Content-Type", "Cache-Control", "Connection", "X-Accel-Buffering"]
}));

// Preflight for all streaming endpoints
app.options(["/api/agents/repair-workflow-orchestrator/stream",
             "/api/agents/direct-agent/stream",
             "/api/agents/customerIdentification/stream",
             "/api/agents/productSelection/stream",
             "/api/agents/issueAnalysis/stream",
             "/api/agents/visitConfirmation/stream"], (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.sendStatus(204);
});

// JSON parsing
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  // Try different ways to access agents
  let agents: string[] = [];
  try {
    console.log("🔍 Health check: Checking Mastra instance...");
    console.log("mastra type:", typeof mastra);
    console.log("mastra.agents:", mastra.agents);
    console.log("mastra.getAgentById:", typeof mastra.getAgentById);
    
    if (mastra.agents) {
      agents = Object.keys(mastra.agents);
      console.log("Found agents in mastra.agents:", agents);
    } else if (mastra.getAgentById) {
      // Try to get agents by known IDs
      const knownAgents = ["repair-workflow-orchestrator", "routing-agent-customer-identification", "repair-agent-product-selection", "repair-qa-agent-issue-analysis", "repair-visit-confirmation-agent"];
      console.log("Trying known agent IDs:", knownAgents);
      
      for (const id of knownAgents) {
        const agent = mastra.getAgentById(id);
        if (agent) {
          agents.push(id);
          console.log(`✅ Found agent: ${id}`);
        } else {
          console.log(`❌ Agent not found: ${id}`);
        }
      }
    }
  } catch (error) {
    console.error("Error getting agents for health check:", error);
  }
  
  const langfuseEnabled = Boolean(process.env.LANGFUSE_HOST && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  res.status(200).json({ 
    ok: true, 
    service: "mastra-server", 
    time: new Date().toISOString(),
    agents: agents,
    mastraType: typeof mastra,
    hasAgents: !!mastra.agents,
    hasGetAgentById: !!mastra.getAgentById,
    zapierMcpUrl: process.env.ZAPIER_MCP_URL ? "✅ Set" : "❌ Missing",
    zapierMcp: process.env.ZAPIER_MCP ? "✅ Set" : "❌ Missing",
    langfuse: {
      enabled: langfuseEnabled ? "✅ Enabled" : "❌ Disabled",
      host: process.env.LANGFUSE_HOST || null
    }
  });
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

// Helper to get agent by id safely
function getAgentById(agentId: string): any | null {
  try {
    // First try the Mastra getAgentById method
    if (mastra.getAgentById) {
      const agent = mastra.getAgentById(agentId);
      if (agent) return agent;
    }
    
    // Fallback to direct access to agents object
    if (mastra.agents && mastra.agents[agentId]) {
      return mastra.agents[agentId];
    }
    
    // Log available agents for debugging
    console.log(`🔍 Available agents: ${Object.keys(mastra.agents || {}).join(", ")}`);
    console.log(`🔍 Looking for agent: ${agentId}`);
    
    return null;
  } catch (error) {
    console.error(`❌ Error getting agent ${agentId}:`, error);
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

  try {
    for await (const chunk of stream.textStream) {
      if (typeof chunk === "string") {
        totalLength += chunk.length;
        for (const ch of chunk) {
          res.write(`0:"${encodeChunk(ch)}"\n`);
        }
      }
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

// Write finish metadata (e:/d:) and flush
function writeFinish(res: Response, fullTextLength: number): void {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Main endpoint for the repair workflow orchestrator
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = getAgentById("repair-workflow-orchestrator");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent 'repair-workflow-orchestrator' not found" });
    }

    console.log(`🔍 Processing request with ${messages.length} messages`);
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
    
    // Execute the agent using Mastra's stream method
    const stream = await agent.stream(normalizedMessages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Alternative endpoint for direct agent access
app.post("/api/agents/direct-agent/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = getAgentById("repair-workflow-orchestrator");
    
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
    const agent = getAgentById("routing-agent-customer-identification");
    
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
    const agent = getAgentById("repair-agent-product-selection");
    
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
    const agent = getAgentById("repair-qa-agent-issue-analysis");
    
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
    const agent = getAgentById("repair-visit-confirmation-agent");
    
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
    res.write(`f:{"messageId":"${messageId}"}\n`);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
    res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /visitConfirmation/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Start the server on port 80 (production port)
const port = 80;
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
  console.log(`✅ Available agents: ${Object.keys(mastra.agents || {}).join(", ")}`);

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
