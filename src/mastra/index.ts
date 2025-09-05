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
import { repairAgentProductSelection } from "./agents/sanden/product-selection";
import { repairQaAgentIssueAnalysis } from "./agents/sanden/issue-analysis";
import { repairVisitConfirmationAgent } from "./agents/sanden/visit-confirmation";
import { setMastraInstance } from "./tools/sanden/orchestrator-tools";

// Create agents asynchronously
async function createMastraInstance() {
  const mastra = new Mastra({
    // No workflows needed - just agents
    agents: {
      // Main customer identification agent - entry point
      "customer-identification": routingAgentCustomerIdentification,
      
      // Sub-agents (accessed via delegateTo tool)
      "repair-agent": repairAgentProductSelection,
      "repair-history-ticket": repairQaAgentIssueAnalysis,
      "repair-scheduling": repairVisitConfirmationAgent,
    },
    
    storage: new LibSQLStore({
      url: process.env.DATABASE_URL || ":memory:",
    }),
    
    logger: new PinoLogger({
      name: "Sanden Repair System",
      level: "info",
    }),
  });

  console.log("✅ Mastra instance created with 4 agents");
  console.log("✅ Main endpoint: POST /api/agents/customer-identification/stream");
  console.log("✅ Customer identification agent ready");

  // Set the mastra instance for orchestrator tools
  setMastraInstance(mastra);

  // Debug: Check what agents are actually available
  console.log("🔍 Debug: Available agents in Mastra instance:");
  console.log("mastra.agents keys:", Object.keys(mastra.agents || {}));
  console.log("mastra.getAgentById available:", typeof mastra.getAgentById === 'function');
  console.log("Agent count:", Object.keys(mastra.agents || {}).length);
  
  // Test getting agents by ID
  const knownAgents = ["customer-identification", "repair-agent", "repair-history-ticket", "repair-scheduling"];
  console.log("🔍 Testing agent access by ID:");
  for (const id of knownAgents) {
    const agent = mastra.getAgentById(id);
    if (agent) {
      console.log(`✅ Agent '${id}' found via getAgentById`);
    } else {
      console.log(`❌ Agent '${id}' NOT found via getAgentById`);
    }
  }

  return mastra;
}

// Export the promise that resolves to the mastra instance
export const mastraPromise = createMastraInstance();

// For backward compatibility, export a getter that waits for the promise
export const mastra = new Proxy({} as any, {
  get(target, prop) {
    return mastraPromise.then((instance) => instance[prop as keyof typeof instance]);
  }
});

// Start the Mastra server on port 80 (production port)
const port = 80;
console.log(`🚀 Mastra server configured for port ${port}`);
console.log(`🔗 Main endpoint: POST /api/agents/customer-identification/stream`);
console.log(`🔗 Health check: GET /health`);
console.log(`🌐 Server will be accessible on port ${port} (configured in Lightsail firewall)`);