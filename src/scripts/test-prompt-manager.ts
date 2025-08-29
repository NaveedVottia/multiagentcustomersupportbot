#!/usr/bin/env tsx

import { getPrompt, getAllPromptNames, getPromptStats } from '../mastra/prompts/prompt-manager.js';

async function testPromptManager() {
  console.log('🧪 Testing Prompt Manager...\n');

  // Test 1: Get all prompt names
  console.log('📋 Available prompt names:');
  const promptNames = getAllPromptNames();
  promptNames.forEach(name => console.log(`   - ${name}`));
  console.log('');

  // Test 2: Test loading a specific prompt
  console.log('📤 Testing prompt loading...');
  try {
    const promptInfo = await getPrompt('customer-identification');
    console.log(`✅ Successfully loaded prompt: ${promptInfo.name}`);
    console.log(`   Source: ${promptInfo.source}`);
    console.log(`   Content length: ${promptInfo.content.length} characters`);
    console.log(`   Last updated: ${promptInfo.lastUpdated}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Failed to load prompt:`, error);
  }

  // Test 3: Get statistics
  console.log('📊 Prompt Manager Statistics:');
  const stats = getPromptStats();
  console.log(`   Total prompts: ${stats.totalPrompts}`);
  console.log(`   Cached prompts: ${stats.cachedPrompts}`);
  console.log(`   Langfuse prompts: ${stats.langfusePrompts}`);
  console.log(`   Local prompts: ${stats.localPrompts}`);
  console.log(`   Missing prompts: ${stats.missingPrompts}`);
  console.log('');

  // Test 4: Test loading all prompts
  console.log('🔄 Testing all prompts...');
  for (const name of promptNames) {
    try {
      const promptInfo = await getPrompt(name);
      console.log(`   ✅ ${name}: ${promptInfo.source} (${promptInfo.content.length} chars)`);
    } catch (error) {
      console.log(`   ❌ ${name}: Failed to load`);
    }
  }

  console.log('\n🎉 Prompt Manager test completed!');
}

// Run the test
testPromptManager().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
