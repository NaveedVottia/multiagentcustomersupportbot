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
    // This step will be handled by the customer identification agent
    // The agent will use hybridLookupCustomerByDetails tool
    // For now, return the expected structure that the agent will provide
    return {
      customerId: "CUST003", // Will be populated by agent
      customerData: {
        id: "CUST003",
        name: inputData.customerDetails.company,
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
      description: z.string(),
    }),
  }),
  execute: async ({ inputData, context }) => {
    // This step will be handled by the repair agent
    // The agent will assess the repair needs and provide recommendations
    return {
      repairAssessment: {
        needsRepair: true,
        repairType: "Preventive Maintenance",
        urgency: "Medium",
        estimatedDuration: "2-3 hours",
        description: "Regular maintenance check and potential component replacement",
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
      description: z.string(),
    }),
  }),
  outputSchema: z.object({
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
      cost: z.string(),
    })),
    recommendations: z.array(z.string()),
    totalRepairs: z.number(),
  }),
  execute: async ({ inputData, context }) => {
    // This step will be handled by the repair history agent
    // The agent will use hybridGetRepairsByCustomerId tool
    return {
      repairHistory: [
        {
          id: "REP001",
          date: "2024-12-15",
          type: "Preventive Maintenance",
          status: "Completed",
          notes: "Regular maintenance performed, all systems operational",
          cost: "¥15,000",
        },
        {
          id: "REP002",
          date: "2024-06-20",
          type: "Component Replacement",
          status: "Completed",
          notes: "Replaced temperature sensor, system now functioning normally",
          cost: "¥25,000",
        },
      ],
      recommendations: [
        "Schedule next maintenance in 6 months",
        "Check compressor efficiency",
        "Monitor temperature sensors",
        "Consider upgrading to newer model within 2 years",
      ],
      totalRepairs: 2,
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
      description: z.string(),
    }),
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
      cost: z.string(),
    })),
    recommendations: z.array(z.string()),
    totalRepairs: z.number(),
  }),
  outputSchema: z.object({
    scheduledRepair: z.object({
      appointmentId: z.string(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      technician: z.string(),
      estimatedDuration: z.string(),
      estimatedCost: z.string(),
      confirmationMessage: z.string(),
      nextSteps: z.array(z.string()),
    }),
  }),
  execute: async ({ inputData, context }) => {
    // This step will be handled by the scheduling agent
    // The agent will handle the actual scheduling logic
    return {
      scheduledRepair: {
        appointmentId: "APT001",
        scheduledDate: "2025-01-15",
        scheduledTime: "10:00 AM",
        technician: "田中 太郎",
        estimatedDuration: "2-3 hours",
        estimatedCost: "¥20,000 - ¥30,000",
        confirmationMessage: "修理予約が完了しました。1月15日 10:00 AMに田中太郎が訪問いたします。",
        nextSteps: [
          "予約日の前日に確認の電話をいたします",
          "当日は技術者が身分証明書を提示いたします",
          "作業完了後、詳細なレポートをお渡しします",
          "次回のメンテナンス予定日をお知らせします",
        ],
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
      description: z.string(),
    }),
    repairHistory: z.array(z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      status: z.string(),
      notes: z.string(),
      cost: z.string(),
    })),
    recommendations: z.array(z.string()),
    totalRepairs: z.number(),
    scheduledRepair: z.object({
      appointmentId: z.string(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      technician: z.string(),
      estimatedDuration: z.string(),
      estimatedCost: z.string(),
      confirmationMessage: z.string(),
      nextSteps: z.array(z.string()),
    }),
  }),
})
  .then(customerIdentificationStep)
  .then(repairAssessmentStep)
  .then(repairHistoryStep)
  .then(repairSchedulingStep)
  .commit();
