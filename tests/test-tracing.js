import dotenv from "dotenv";
import { tracing } from "./src/integrations/tracing.js";

// Load environment variables
dotenv.config({ path: "./server.env" });

async function testTracing() {
  console.log("🔍 Environment variables:");
  console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST);
  console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "Set" : "Missing");
  
  console.log("🧪 Testing tracing integration...");
  
  // Test if tracing is enabled
  console.log("Tracing enabled:", tracing.isEnabled());
  
  if (!tracing.isEnabled()) {
    console.log("❌ Tracing is not enabled. Check your Langfuse configuration.");
    return;
  }
  
  // Test creating a conversation span
  const sessionId = `test-session-${Date.now()}`;
  const conversationSpan = tracing.createConversationSpan(sessionId, "test_conversation");
  
  if (conversationSpan) {
    console.log("✅ Conversation span created successfully");
    
    // Add conversation details
    tracing.addConversationDetails(conversationSpan, {
      currentAgent: "test-agent",
      conversationStep: "test_step",
      userMessage: "This is a test message",
      metadata: {
        "test.key": "test.value",
      }
    });
    
    // End the span
    tracing.endSpan(conversationSpan);
    console.log("✅ Conversation span ended successfully");
  } else {
    console.log("❌ Failed to create conversation span");
  }
  
  // Test creating an agent span
  const agentSpan = tracing.createAgentSpan("test-agent", "test_operation", sessionId);
  
  if (agentSpan) {
    console.log("✅ Agent span created successfully");
    tracing.endSpan(agentSpan);
    console.log("✅ Agent span ended successfully");
  } else {
    console.log("❌ Failed to create agent span");
  }
  
  // Test creating a tool span
  const toolSpan = tracing.createToolSpan("test-tool", sessionId, { param: "value" });
  
  if (toolSpan) {
    console.log("✅ Tool span created successfully");
    tracing.endSpan(toolSpan);
    console.log("✅ Tool span ended successfully");
  } else {
    console.log("❌ Failed to create tool span");
  }
  
  console.log("🧪 Tracing test completed!");
  
  // Wait a bit for traces to be sent
  console.log("⏳ Waiting 5 seconds for traces to be sent...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Shutdown tracing
  await tracing.shutdown();
  console.log("✅ Tracing shutdown complete");
}

// Run the test
testTracing().catch(console.error);
