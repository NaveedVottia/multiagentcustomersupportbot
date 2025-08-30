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
import { customerIdentificationAgent } from "./agents/sanden/customer-identification.js";
import { createRepairWorkflowOrchestrator } from "./agents/sanden/repair-workflow-orchestrator.js";
import { createRepairAgent } from "./agents/sanden/repair-agent.js";
import { createRepairHistoryTicketAgent } from "./agents/sanden/repair-history-ticket-agent.js";
import { createRepairSchedulingAgent } from "./agents/sanden/repair-scheduling-agent.js";

// Import workflows
import { repairIntakeOrchestratedWorkflow } from "./workflows/sanden/repair-intake-orchestrated.js";

// Import the setter for Mastra instance
import { setMastraInstance } from "./tools/sanden/orchestrator-tools.js";

// Agent initialization function
async function initializeAgents() {
  console.log("🚀 Initializing Mastra agents...");
  
  try {
    // Create the orchestrator agent
    const repairWorkflowOrchestrator = await createRepairWorkflowOrchestrator();
    console.log("✅ Repair Workflow Orchestrator Agent initialized");
    
    // Use the pre-created customer identification agent
    console.log("✅ Customer Identification Agent initialized");
    
    const repairAgent = await createRepairAgent();
    console.log("✅ Repair Agent initialized");
    
    const repairHistoryTicketAgent = await createRepairHistoryTicketAgent();
    console.log("✅ Repair History & Ticket Agent initialized");
    
    const repairSchedulingAgent = await createRepairSchedulingAgent();
    console.log("✅ Repair Scheduling Agent initialized");
    
    // Create Mastra instance with all agents and workflows
    const mastraInstance = new Mastra({
      agents: {
        // Orchestrator agent as the main entry point
        "repair-workflow-orchestrator": repairWorkflowOrchestrator,
        
        // Sub-agents for specific functionality
        "routing-agent-customer-identification": customerIdentificationAgent,
        "repair-agent": repairAgent,
        "repair-history-ticket-agent": repairHistoryTicketAgent,
        "repair-scheduling-agent": repairSchedulingAgent,
      },
      workflows: {
        repairIntakeOrchestratedWorkflow,
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

    console.log("✅ Mastra instance created with 5 agents and 1 workflow");
    console.log("✅ Main endpoint: POST /api/agents/repair-workflow-orchestrator/stream");
    console.log("✅ Orchestrator agent ready (main entry point)");
    console.log("✅ Repair workflow ready for agent-to-agent flow");

    // Test the connection using the correct v0.13.2 API
    if (mastraInstance.getAgentById("repair-workflow-orchestrator")) {
      console.log("✅ Orchestrator agent (main entry point) verified");
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

    // Debug: Check what agents and workflows are available
    console.log("🔍 Debug: Available agents and workflows in Mastra instance:");
    console.log("mastra.getAgentById available:", typeof mastraInstance.getAgentById === 'function');
    console.log("Agent count: 5 (1 orchestrator + 1 customer identification + 3 workflow agents)");
    console.log("Workflow count: 1 (repair-intake-orchestrated with 6 steps)");

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