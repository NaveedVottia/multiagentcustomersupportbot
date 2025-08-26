import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra/index";

// Load environment variables explicitly from server.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../..", "server.env") });

// Ensure Zapier MCP URL variable is present
if (!process.env.ZAPIER_MCP_URL && process.env.ZAPIER_MCP) {
  try { process.env.ZAPIER_MCP_URL = process.env.ZAPIER_MCP; } catch {}
}

const app = express();

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));

// JSON parsing
app.use(express.json());

// Message content normalization middleware (for array-form content)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST" && req.path.includes("/stream") && (req as any).body && (req as any).body.messages) {
    try {
      (req as any).body.messages = (req as any).body.messages.map((message: any) => {
        if (message?.content && Array.isArray(message.content)) {
          const textContent = message.content
            .filter((item: any) => item.type === "text" && item.text)
            .map((item: any) => item.text)
            .join(" ");
          message.content = textContent || "";
        }
        return message;
      });
      console.log(`🔧 [Content Normalizer] Normalized ${(req as any).body.messages.length} messages`);
    } catch (error) {
      console.error("❌ [Content Normalizer] Error normalizing messages:", error);
    }
  }
  next();
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: "mastra-server", time: new Date().toISOString() });
});

// Helper to get agent by id safely
function getAgentById(agentId: string): any | null {
  try {
    if ((mastra as any)?.getAgentById) return (mastra as any).getAgentById(agentId);
    if ((mastra as any)?.agents) return (mastra as any).agents[agentId] || null;
  } catch {}
  return null;
}

// Primary endpoint expected by UI (direct-agent)
app.post("/api/agents/direct-agent/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray((req as any).body?.messages) ? (req as any).body.messages : [];
    const agent = getAgentById("direct-agent");
    if (!agent) return res.status(500).json({ error: "Agent 'direct-agent' not found" });

    const result = await agent.stream(messages);
    if (typeof result?.text === "string") {
      return res.status(200).json({ text: result.text, type: result.type || "text" });
    }
    return res.status(200).json(result || { text: "" });
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /direct-agent/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Compatibility endpoint (some builds referenced 'repair-workflow-orchestrator')
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray((req as any).body?.messages) ? (req as any).body.messages : [];
    // Try sanden-repair-orchestrator first, fallback to direct-agent
    const agent = getAgentById("sanden-repair-orchestrator") || getAgentById("direct-agent");
    if (!agent) return res.status(500).json({ error: "Orchestrator agent not found" });

    const result = await agent.stream(messages);
    if (typeof result?.text === "string") {
      return res.status(200).json({ text: result.text, type: result.type || "text" });
    }
    return res.status(200).json(result || { text: "" });
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Start the server on port 80 explicitly
const desiredPort = 80;
const server = app.listen(desiredPort, () => {
  console.log("🚀 Mastra server started successfully!");
  console.log(`🌐 Server running on port ${desiredPort}`);
  console.log(`🔗 Main endpoint: POST /api/agents/direct-agent/stream`);
  console.log(`🔗 Health check: GET /health`);
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
