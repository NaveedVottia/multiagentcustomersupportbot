import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const testStep = createStep({
  id: "test-step",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { result: `Processed: ${inputData.message}` };
  },
});

export const simpleTestWorkflow = createWorkflow({
  id: "simpleTestWorkflow",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
})
  .then(testStep)
  .commit();
