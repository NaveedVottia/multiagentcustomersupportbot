import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Simple test step
const testStep = createStep({
  id: "test-step",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      result: `Processed: ${inputData.message}`,
    };
  },
});

// Create the test workflow
export const testOrchestratorWorkflow = createWorkflow({
  id: "testOrchestratorWorkflow",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
})
  .then(testStep)
  .commit();
