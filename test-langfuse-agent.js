#!/usr/bin/env node

import { loadLangfusePrompt } from './src/mastra/prompts/langfuse.ts';

// Test Langfuse prompt loading
async function testLangfusePrompts() {
  console.log('🧪 Testing Langfuse prompt loading...\n');

  const promptsToTest = [
    'customer-identification',
    'repair-scheduling',
    'repair-agent',
    'repair-history-ticket',
    'error-messages'
  ];

  for (const promptName of promptsToTest) {
    try {
      console.log(`📥 Testing ${promptName}...`);
      const prompt = await loadLangfusePrompt(promptName, { cacheTtlMs: 0, label: "production" });

      if (prompt) {
        console.log(`✅ ${promptName}: Loaded (${prompt.length} chars)`);
        // Show first 100 characters as preview
        console.log(`   Preview: "${prompt.substring(0, 100)}..."`);
      } else {
        console.log(`❌ ${promptName}: Empty prompt returned`);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${promptName}: Error - ${error.message}`);
      console.log('');
    }
  }

  console.log('🎉 Langfuse prompt testing complete!');
}

// Run the test
testLangfusePrompts().catch(console.error);
