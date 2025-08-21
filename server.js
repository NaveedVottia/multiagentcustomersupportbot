import { n as mastra } from "./.mastra/output/mastra.mjs";
import { createServer } from "http";

const port = process.env.PORT || 80;

const server = createServer(async (req, res) => {
  try {
    // Handle Mastra API requests
    if (req.url?.startsWith("/api/")) {
      // Redirect workflow endpoint to agent endpoint for frontend compatibility
      if (req.url?.startsWith("/api/workflows/repair-intake/stream")) {
        req.url = "/api/agents/repair-workflow-orchestrator/stream";
      }
      
      // Forward to Mastra
      const result = await mastra.handleRequest(req, res);
      return;
    }
    
    // Default response
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Sanden Repair System is running on port " + port);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
