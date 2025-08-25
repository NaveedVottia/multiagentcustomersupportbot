import { readFileSync } from "fs";
import { createServer, request as httpRequest } from "http";

const port = process.env.PORT || 80;

// Lightweight env loader to ensure server.env is applied in PM2/runtime
try {
  if (!process.env.ZAPIER_MCP_URL) {
    const envText = readFileSync(new URL("./server.env", import.meta.url)).toString();
    for (const line of envText.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
} catch {}

// Upstream Mastra Node server (Hono) runs separately; proxy to it after sanitization
const UPSTREAM_HOST = process.env.MASTRA_UPSTREAM_HOST || "127.0.0.1";
const UPSTREAM_PORT = Number(process.env.MASTRA_UPSTREAM_PORT || 4111);

function proxyToUpstream(req, res, bodyStr) {
  const headers = { ...req.headers };
  headers.host = `${UPSTREAM_HOST}:${UPSTREAM_PORT}`;
  if (bodyStr !== undefined) {
    headers["content-length"] = Buffer.byteLength(bodyStr).toString();
  } else {
    delete headers["content-length"]; // allow chunked
  }
  const options = {
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: req.url,
    method: req.method,
    headers,
  };
  const upstreamReq = httpRequest(options, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 500, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstreamReq.on("error", err => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway");
  });
  if (bodyStr !== undefined) {
    upstreamReq.end(bodyStr);
  } else {
    req.pipe(upstreamReq);
  }
}

const server = createServer(async (req, res) => {
  try {

    // Handle Mastra API requests
    if (req.url?.startsWith("/api/")) {
      // Normalize to orchestrator stream only
      // 2) Allow /api/agents/repair-workflow-orchestrator (no /stream) -> append /stream
      if (
        req.url === "/api/agents/repair-workflow-orchestrator" ||
        req.url === "/api/agents/repair-workflow-orchestrator/"
      ) {
        req.url = "/api/agents/repair-workflow-orchestrator/stream";
      }
      // 3) If client uses GET on a stream endpoint, return 405 with guidance (avoid confusing 404s)
      if (
        req.method === "GET" &&
        (req.url?.startsWith("/api/agents/repair-workflow-orchestrator/stream") ||
          req.url?.startsWith("/api/workflows/repair-intake/stream"))
      ) {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Method Not Allowed",
            message:
              "Use POST with Content-Type: application/json and Accept: text/event-stream. Body: {\"messages\":[{\"role\":\"user\",\"content\":\"...\"}]}",
          })
        );
        return;
      }
      
      // Strip any assistant-injected messages from incoming body to prevent prompt injection from UI
      if (req.method === "POST" && req.headers["content-type"]?.includes("application/json")) {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const raw = Buffer.concat(chunks).toString("utf-8");
          const data = JSON.parse(raw);
          if (Array.isArray(data?.messages)) {
            data.messages = data.messages.filter((m) => m && m.role !== "assistant");
          }
          const sanitized = JSON.stringify(data ?? {});
          proxyToUpstream(req, res, sanitized);
          return;
        } catch {}
      }
      // Fallback: forward original request as-is
      proxyToUpstream(req, res);
      return;
    }
    
    // Default response
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Sanden Repair System is running on port " + port);
  } catch (error) {
    try {
      console.error("[Server] Request error:", error && (error.stack || error.message || error));
    } catch {}
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
