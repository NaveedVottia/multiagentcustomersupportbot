import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Step 1: Customer Identification
const customerIdentificationStep = createStep({
  id: "customerIdentification",
  inputSchema: z.object({
    customerDetails: z.object({
      email: z.string(),
      phone: z.string(),
      company: z.string(),
    }),
  }),
  outputSchema: z.object({
    customerId: z.string(),
    customerData: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      company: z.string(),
    }),
  }),
  execute: async ({ inputData, context }) => {
    // This will be handled by the customer identification agent
    // The workflow will call the agent and get the result
    return {
      customerId: "CUST003", // Example
      customerData: {
        id: "CUST003",
        name: "ウエルシア 川崎駅前店",
        email: inputData.customerDetails.email,
        phone: inputData.customerDetails.phone,
        company: inputData.customerDetails.company,
      },
    };
  },
});

// Step 2: Repair Assessment
const repairAssessmentStep = createStep({
  id: "repairAssessment",
  inputSchema: z.object({
    customerId: z.string(),
    customerData: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      company: z.string(),
    }),
  }),
  outputSchema: z.object({
    repairAssessment: z.object({
      needsRepair: z.boolean(),
      repairType: z.string(),
      urgency: z.string(),
      estimatedDuration: z.string(),
    }),
  }),
  execute: async ({ inputData, context }) => {
    // This will be handled by the repair agent
    return {
      repairAssessment: {
        needsRepair: true,
        repairType: "Preventive Maintenance",
        urgency: "Medium",
        estimatedDuration: "2-3 hours",
      },
    };
  },
});

// Step 3: Repair History Review
const repairHistoryStep = createStep({
  id: "repairHistory",
  inputSchema: z.object({
    customerId: z.string(),
    repairAssessment: z.object({
      needsRepair: z.boolean(),
      repairType: z.string(),
      urgency: z.string(),
      estimatedDuration: z.string(),
    }),
  }),
  outputSchema: z.object({
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
    })),
    recommendations: z.array(z.string()),
  }),
  execute: async ({ inputData, context }) => {
    // This will be handled by the repair history agent
    return {
      repairHistory: [
        {
          id: "REP001",
          date: "2024-12-15",
          type: "Preventive Maintenance",
          status: "Completed",
          notes: "Regular maintenance performed",
        },
      ],
      recommendations: [
        "Schedule next maintenance in 6 months",
        "Check compressor efficiency",
        "Monitor temperature sensors",
      ],
    };
  },
});

// Step 4: Repair Scheduling
const repairSchedulingStep = createStep({
  id: "repairScheduling",
  inputSchema: z.object({
    customerId: z.string(),
    repairAssessment: z.object({
      needsRepair: z.boolean(),
      repairType: z.string(),
      urgency: z.string(),
      estimatedDuration: z.string(),
    }),
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
    })),
    recommendations: z.array(z.string()),
  }),
  outputSchema: z.object({
    scheduledRepair: z.object({
      appointmentId: z.string(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      technician: z.string(),
      estimatedDuration: z.string(),
      confirmationMessage: z.string(),
    }),
  }),
  execute: async ({ inputData, context }) => {
    // This will be handled by the scheduling agent
    return {
      scheduledRepair: {
        appointmentId: "APT001",
        scheduledDate: "2025-01-15",
        scheduledTime: "10:00 AM",
        technician: "田中 太郎",
        estimatedDuration: "2-3 hours",
        confirmationMessage: "修理予約が完了しました。1月15日 10:00 AMに田中太郎が訪問いたします。",
      },
    };
  },
});

// Create the complete repair workflow
export const repairWorkflow = createWorkflow({
  id: "repair-workflow",
  inputSchema: z.object({
    customerDetails: z.object({
      email: z.string(),
      phone: z.string(),
      company: z.string(),
    }),
  }),
  outputSchema: z.object({
    customerId: z.string(),
    customerData: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      company: z.string(),
    }),
    repairAssessment: z.object({
      needsRepair: z.boolean(),
      repairType: z.string(),
      urgency: z.string(),
      estimatedDuration: z.string(),
    }),
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
    })),
    recommendations: z.array(z.string()),
    scheduledRepair: z.object({
      appointmentId: z.string(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      technician: z.string(),
      estimatedDuration: z.string(),
      confirmationMessage: z.string(),
    }),
  }),
})
  .then(customerIdentificationStep)
  .then(repairAssessmentStep)
  .then(repairHistoryStep)
  .then(repairSchedulingStep)
  .commit();
