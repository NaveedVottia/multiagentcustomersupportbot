import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

// Import all agents
import { routingAgentCustomerIdentification } from "./agents/sanden/customer-identification";
import { repairQaAgentIssueAnalysis } from "./agents/sanden/issue-analysis";
import { repairAgentProductSelection } from "./agents/sanden/product-selection";
import { repairVisitConfirmationAgent } from "./agents/sanden/visit-confirmation";
import { repairWorkflowOrchestratorAgent } from "./agents/sanden/workflow-orchestrator";

// Import the setter for Mastra instance
import { setMastraInstance } from "./tools/sanden/orchestrator-tools";

export const mastra = new Mastra({
  // No workflows needed - just agents
  agents: {
    // Main orchestrator - this is exposed to UI at /api/agents/repair-workflow-orchestrator/stream
    "repair-workflow-orchestrator": repairWorkflowOrchestratorAgent,
    
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
console.log("✅ The orchestrator will delegate to other agents using the delegateTo tool");

// Test the connection using the correct v0.13.2 API
if (mastra.getAgentById("repair-workflow-orchestrator")) {
  console.log("✅ Orchestrator agent verified");
}