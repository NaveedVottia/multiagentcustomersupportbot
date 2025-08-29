#!/usr/bin/env tsx

import { LANGFUSE_PROMPTS } from '../mastra/prompts/langfuse-prompts.js';

// Langfuse API configuration
const LANGFUSE_HOST = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;

if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
  console.error('❌ Missing Langfuse credentials. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY');
  process.exit(1);
}

interface LangfusePrompt {
  name: string;
  description: string;
  content: string;
  tags?: string[];
}

async function uploadPromptToLangfuse(prompt: LangfusePrompt): Promise<boolean> {
  try {
    // Try different API endpoints for different Langfuse versions
    const endpoints = [
      `${LANGFUSE_HOST}/api/public/prompts`,
      `${LANGFUSE_HOST}/api/prompts`,
      `${LANGFUSE_HOST}/api/v1/prompts`
    ];

    let success = false;
    let lastError = '';

    for (const url of endpoints) {
      try {
        console.log(`📤 Trying endpoint: ${url}`);
        
        const payload = {
          name: prompt.name,
          description: prompt.description,
          prompt: prompt.content,
          tags: prompt.tags || ['sanden-repair-system', 'production'],
          isActive: true
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LANGFUSE_SECRET_KEY}`,
            'X-Langfuse-Public-Key': LANGFUSE_PUBLIC_KEY || ''
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Successfully uploaded: ${prompt.name} (ID: ${result.id})`);
          success = true;
          break;
        } else {
          const errorText = await response.text();
          lastError = `${response.status} ${response.statusText}: ${errorText}`;
          console.log(`⚠️ Endpoint ${url} failed: ${lastError}`);
        }
      } catch (endpointError) {
        console.log(`⚠️ Endpoint ${url} error:`, endpointError);
        lastError = endpointError instanceof Error ? endpointError.message : 'Unknown error';
      }
    }

    if (!success) {
      console.error(`❌ Failed to upload ${prompt.name} on all endpoints. Last error: ${lastError}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${prompt.name}:`, error);
    return false;
  }
}

async function uploadAllPrompts(): Promise<void> {
  console.log('🚀 Starting Langfuse prompt upload...');
  console.log(`📡 Langfuse Host: ${LANGFUSE_HOST}`);
  console.log(`🔑 Public Key: ${LANGFUSE_PUBLIC_KEY?.substring(0, 8)}...`);
  console.log(`🔐 Secret Key: ${LANGFUSE_SECRET_KEY?.substring(0, 8)}...`);
  console.log('');

  const prompts = Object.values(LANGFUSE_PROMPTS);
  console.log(`📋 Found ${prompts.length} prompts to upload:`);
  prompts.forEach(p => console.log(`   - ${p.name}: ${p.description}`));
  console.log('');

  let successCount = 0;
  let failureCount = 0;

  for (const prompt of prompts) {
    const success = await uploadPromptToLangfuse(prompt);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Add a small delay between uploads to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('');
  console.log('📊 Upload Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📊 Total: ${prompts.length}`);

  if (failureCount === 0) {
    console.log('🎉 All prompts uploaded successfully!');
  } else {
    console.log('⚠️ Some prompts failed to upload. Check the logs above.');
    process.exit(1);
  }
}

// Run the upload
uploadAllPrompts().catch(error => {
  console.error('💥 Fatal error during upload:', error);
  process.exit(1);
});
