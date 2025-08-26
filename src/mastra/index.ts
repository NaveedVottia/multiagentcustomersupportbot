import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server.env BEFORE creating agents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../..", "server.env") });

console.log("🔍 Loading environment variables for Mastra agents...");
console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");

// Import all agents
import { routingAgentCustomerIdentification } from "./agents/sanden/customer-identification";
import { workingOrchestratorAgent } from "./agents/sanden/working-orchestrator";
import { repairAgentProductSelection } from "./agents/sanden/product-selection";
import { repairQaAgentIssueAnalysis } from "./agents/sanden/issue-analysis";
import { repairVisitConfirmationAgent } from "./agents/sanden/visit-confirmation";

// Import the setter for Mastra instance
import { setMastraInstance } from "./tools/sanden/orchestrator-tools";

export const mastra = new Mastra({
  // No workflows needed - just agents
  agents: {
    // Main orchestrator agent - this is what the UI expects
    "repair-workflow-orchestrator": workingOrchestratorAgent,
    
    // Sub-agents (accessed internally by orchestrator via delegateTo tool)
    "routing-agent-customer-identification": routingAgentCustomerIdentification,
    "repair-agent-product-selection": repairAgentProductSelection,
    "repair-qa-agent-issue-analysis": repairQaAgentIssueAnalysis,
    "repair-visit-confirmation-agent": repairVisitConfirmationAgent,
  },
  
  storage: new LibSQLStore({
    url: process.env.DATABASE_URL || ":memory:",
  }),
  
  logger: new PinoLogger({
    name: "Sanden Repair System",
    level: "info",
  }),
});

// Set the Mastra instance for tools to use
setMastraInstance(mastra);

console.log("✅ Mastra instance created with 5 agents");
console.log("✅ Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream");
console.log("✅ Repair workflow orchestrator ready");

// Test the connection using the correct v0.13.2 API
if (mastra.getAgentById("repair-workflow-orchestrator")) {
  console.log("✅ Repair workflow orchestrator verified");
}

// Debug: Check what agents are actually available
console.log("🔍 Debug: Available agents in Mastra instance:");
console.log("mastra.agents keys:", Object.keys(mastra.agents || {}));
console.log("mastra.getAgentById available:", typeof mastra.getAgentById === 'function');
console.log("Agent count:", Object.keys(mastra.agents || {}).length);

// Start the Mastra server on port 80 (production port)
const port = 80;
console.log(`🚀 Mastra server configured for port ${port}`);
console.log(`🔗 Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream`);
console.log(`🔗 Health check: GET /health`);
console.log(`🌐 Server will be accessible on port ${port} (configured in Lightsail firewall)`);