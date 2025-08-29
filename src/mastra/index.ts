import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { customerIdentificationAgent } from "./agents/sanden/customer-identification.js";
import { createRepairAgent } from "./agents/sanden/repair-agent.js";
import { createRepairHistoryTicketAgent } from "./agents/sanden/repair-history-ticket-agent.js";
import { createRepairSchedulingAgent } from "./agents/sanden/repair-scheduling-agent.js";
import { createRepairWorkflowOrchestrator } from "./agents/sanden/repair-workflow-orchestrator.js";
import { repairIntakeOrchestratedWorkflow } from "./workflows/sanden/repair-intake-orchestrated.js";

// Create storage instance
const storage = new LibSQLStore({
  url: "file:./mastra.db",
}) as any;

// Create Mastra instance with persistent storage
export const mastra = new Mastra({
  storage: storage,
});

// Memory storage configuration will be added back once we resolve the proper configuration method

// Initialize all agents asynchronously with Langfuse prompts
export async function initializeMastra() {
  console.log("🚀 Initializing Mastra with Langfuse-driven agents...");
  
  try {
    // Create all agents with Langfuse prompts
    const repairAgent = await createRepairAgent();
    const repairHistoryTicketAgent = await createRepairHistoryTicketAgent();
    const repairSchedulingAgent = await createRepairSchedulingAgent();
    const orchestratorAgent = await createRepairWorkflowOrchestrator();
    
    // Store agents in the mastra instance for getAgentById to work
    // This maintains compatibility with the existing working system
    (mastra as any).agents = {
      "customer-identification": customerIdentificationAgent,
      "repair-agent": repairAgent,
      "repair-history-ticket-agent": repairHistoryTicketAgent,
      "repair-scheduling-agent": repairSchedulingAgent,
      "orchestrator": orchestratorAgent,
    };
    
    // Also store workflows
    (mastra as any).workflows = {
      "repair-intake-orchestrated": repairIntakeOrchestratedWorkflow,
    };
    
    // Ensure the agents are properly accessible via getAgentById
    // Override the getAgentById method to use our stored agents
    const originalGetAgentById = mastra.getAgentById;
    (mastra as any).getAgentById = async (agentId: string) => {
      const storedAgent = (mastra as any).agents[agentId];
      if (storedAgent) {
        return storedAgent;
      }
      // Fallback to original method if not found
      if (originalGetAgentById) {
        return originalGetAgentById.call(mastra, agentId);
      }
      return null;
    };
    
    console.log("✅ All agents and workflows registered successfully with Langfuse prompts");
    console.log("✅ Agents available for getAgentById:");
    console.log("   - customer-identification");
    console.log("   - repair-agent");
    console.log("   - repair-history-ticket-agent");
    console.log("   - repair-scheduling-agent");
    console.log("   - orchestrator");
    return mastra;
  } catch (error) {
    console.error("❌ Failed to initialize Mastra:", error);
    throw error;
  }
}

// Export the initialized instance
export default initializeMastra();