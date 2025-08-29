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
console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");
console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");

// Import agent factories
import { createCustomerIdentificationAgent } from "./agents/sanden/customer-identification.js";
import { createRepairAgent } from "./agents/sanden/repair-agent.js";
import { createRepairHistoryTicketAgent } from "./agents/sanden/repair-history-ticket-agent.js";
import { createRepairSchedulingAgent } from "./agents/sanden/repair-scheduling-agent.js";

// Import the setter for Mastra instance
import { setMastraInstance } from "./tools/sanden/orchestrator-tools.js";

// Agent initialization function
async function initializeAgents() {
  console.log("🚀 Initializing Mastra agents...");
  
  try {
    // Create the customer identification agent as the main entry point
    const customerIdentificationAgent = await createCustomerIdentificationAgent();
    console.log("✅ Customer Identification Agent initialized");
    
    const repairAgent = await createRepairAgent();
    console.log("✅ Repair Agent initialized");
    
    const repairHistoryTicketAgent = await createRepairHistoryTicketAgent();
    console.log("✅ Repair History & Ticket Agent initialized");
    
        const repairSchedulingAgent = await createRepairSchedulingAgent();
    console.log("✅ Repair Scheduling Agent initialized");
    
    // Create Mastra instance with all agents
    const mastraInstance = new Mastra({
      agents: {
        // Customer identification agent as the main entry point
        "repair-workflow-orchestrator": customerIdentificationAgent,
        
        // Sub-agents for specific functionality
        "routing-agent-customer-identification": customerIdentificationAgent,
        "repair-agent": repairAgent,
        "repair-history-ticket-agent": repairHistoryTicketAgent,
        "repair-scheduling-agent": repairSchedulingAgent,
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
    setMastraInstance(mastraInstance);

    console.log("✅ Mastra instance created with 4 agents");
    console.log("✅ Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream");
    console.log("✅ Customer identification agent ready (unified entry point)");

    // Test the connection using the correct v0.13.2 API
    if (mastraInstance.getAgentById("repair-workflow-orchestrator")) {
      console.log("✅ Customer identification agent (main entry point) verified");
    }
    if (mastraInstance.getAgentById("routing-agent-customer-identification")) {
      console.log("✅ Customer identification agent (routing) verified");
    }
    if (mastraInstance.getAgentById("repair-history-ticket-agent")) {
      console.log("✅ Repair history & ticket agent verified");
    }
    if (mastraInstance.getAgentById("repair-scheduling-agent")) {
      console.log("✅ Repair scheduling agent verified");
    }

    // Debug: Check what agents are actually available
    console.log("🔍 Debug: Available agents in Mastra instance:");
    console.log("mastra.getAgentById available:", typeof mastraInstance.getAgentById === 'function');
    console.log("Agent count: 4 (1 main customer identification + 3 workflow agents)");

    return mastraInstance;
  } catch (error) {
    console.error("❌ Failed to initialize agents:", error);
    throw error;
  }
}

// Initialize agents and export the instance
export const mastra = initializeAgents();

// Start the Mastra server on port 80 (production port)
const port = 80;
console.log(`🚀 Mastra server configured for port ${port}`);
console.log(`🔗 Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream`);
console.log(`🔗 Health check: GET /health`);
console.log(`🌐 Server will be accessible on port ${port} (configured in Lightsail firewall)`);
console.log(`🔒 CORS will be handled by the built-in Mastra server`);