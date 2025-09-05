/**
 * 専門エージェント呼び出しツール
 * 顧客識別エージェント専用
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { repairAgentProductSelection } from '../../agents/sanden/product-selection';
import { repairQaAgentIssueAnalysis } from '../../agents/sanden/issue-analysis';
import { repairVisitConfirmationAgent } from '../../agents/sanden/visit-confirmation';

/**
 * 修理エージェントを呼び出すツール
 */
export const callRepairAgent = createTool({
  id: 'callRepairAgent',
  description: '顧客の登録製品確認と新規修理受付を行う',
  inputSchema: z.object({
    message: z.string().describe('ユーザーからの問い合わせ内容や現在の会話コンテキスト'),
    customerId: z.string().optional().describe('顧客ID'),
    companyName: z.string().optional().describe('会社名'),
    email: z.string().optional().describe('メールアドレス'),
    phone: z.string().optional().describe('電話番号'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    text: z.string().optional(),
    toolResults: z.array(z.any()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const messageWithContext = `${context.message}

【Customer Information】
- Customer ID: ${context.customerId || 'Not provided'}
- Company Name: ${context.companyName || 'Not provided'}
- Email: ${context.email || 'Not provided'}
- Phone: ${context.phone || 'Not provided'}
- Context: Product selection inquiry`

      // Call the repair-agent directly
      if (!repairAgentProductSelection?.stream) {
        throw new Error('Repair agent not available');
      }
      const stream = await repairAgentProductSelection!.stream([
        {
          role: 'user',
          content: messageWithContext,
        },
      ])

      let fullResponse = "";
      for await (const chunk of stream.textStream) {
        fullResponse += chunk;
      }

      return {
        success: true,
        text: fullResponse,
        toolResults: [],
      }
    } catch (error) {
      console.error('Error communicating with Repair Agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  },
})

/**
 * 修理履歴エージェントを呼び出すツール
 */
export const callRepairHistoryAgent = createTool({
  id: 'callRepairHistoryAgent',
  description: '顧客の修理履歴を確認する',
  inputSchema: z.object({
    message: z.string().describe('ユーザーからの問い合わせ内容や現在の会話コンテキスト'),
    customerId: z.string().optional().describe('顧客ID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    text: z.string().optional(),
    toolResults: z.array(z.any()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const messageWithContext = `${context.message}

【Customer Information】
- Customer ID: ${context.customerId || 'Not provided'}
- Context: Repair history inquiry`

      // Call the repair-history-ticket agent directly
      if (!repairQaAgentIssueAnalysis?.stream) {
        throw new Error('Repair history agent not available');
      }
      const stream = await repairQaAgentIssueAnalysis!.stream([
        {
          role: 'user',
          content: messageWithContext,
        },
      ])

      let fullResponse = "";
      for await (const chunk of stream.textStream) {
        fullResponse += chunk;
      }

      return {
        success: true,
        text: fullResponse,
        toolResults: [],
      }
    } catch (error) {
      console.error('Error communicating with Repair History Agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  },
})

/**
 * 修理予約エージェントを呼び出すツール
 */
export const callRepairSchedulingAgent = createTool({
  id: 'callRepairSchedulingAgent',
  description: '修理予約の受付とスケジュール管理を行う',
  inputSchema: z.object({
    message: z.string().describe('ユーザーからの問い合わせ内容や現在の会話コンテキスト'),
    customerId: z.string().optional().describe('顧客ID'),
    companyName: z.string().optional().describe('会社名'),
    email: z.string().optional().describe('メールアドレス'),
    phone: z.string().optional().describe('電話番号'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    text: z.string().optional(),
    toolResults: z.array(z.any()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const messageWithContext = `${context.message}

【Customer Information】
- Customer ID: ${context.customerId || 'Not provided'}
- Company Name: ${context.companyName || 'Not provided'}
- Email: ${context.email || 'Not provided'}
- Phone: ${context.phone || 'Not provided'}
- Context: Repair scheduling inquiry`

      // Call the repair-scheduling agent directly
      if (!repairVisitConfirmationAgent?.stream) {
        throw new Error('Repair scheduling agent not available');
      }
      const stream = await repairVisitConfirmationAgent!.stream([
        {
          role: 'user',
          content: messageWithContext,
        },
      ])

      let fullResponse = "";
      for await (const chunk of stream.textStream) {
        fullResponse += chunk;
      }

      return {
        success: true,
        text: fullResponse,
        toolResults: [],
      }
    } catch (error) {
      console.error('Error communicating with Repair Scheduling Agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  },
})

export const specialistAgentTools = {
  callRepairAgent,
  callRepairHistoryAgent,
  callRepairSchedulingAgent,
}