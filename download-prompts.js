#!/usr/bin/env node

import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server.env
dotenv.config({ path: path.resolve(__dirname, './server.env') });

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

async function downloadPrompts() {
  console.log('🔄 Downloading prompts from Langfuse...');

  // List of prompt names to download
  const promptNames = [
    'customer-identification',
    'repair-scheduling',
    'repair-agent',
    'repair-history-ticket',
    'error-messages'
  ];

  const results = {};

  for (const promptName of promptNames) {
    try {
      console.log(`📥 Downloading prompt: ${promptName}`);
      const prompt = await langfuse.getPrompt(promptName, undefined, {
        cacheTtlSeconds: 0,
      });

      if (prompt && prompt.prompt) {
        results[promptName] = {
          content: prompt.prompt,
          version: prompt.version,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
          downloadedAt: new Date().toISOString()
        };
        console.log(`✅ Successfully downloaded ${promptName} (v${prompt.version})`);
      } else {
        console.log(`⚠️  No content found for ${promptName}`);
        results[promptName] = {
          error: 'No content found',
          downloadedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`❌ Failed to download ${promptName}:`, error.message);
      results[promptName] = {
        error: error.message,
        downloadedAt: new Date().toISOString()
      };
    }
  }

  // Save results to file
  const outputFile = path.resolve(__dirname, './langfuse-prompts.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📄 Prompts saved to: ${outputFile}`);

  // Display summary
  console.log('\n📊 Download Summary:');
  Object.entries(results).forEach(([name, data]) => {
    if (data.error) {
      console.log(`❌ ${name}: ${data.error}`);
    } else {
      console.log(`✅ ${name}: Downloaded v${data.version} (${data.content.length} chars)`);
    }
  });
}

async function testConnection() {
  console.log('🔍 Testing Langfuse connection...');

  try {
    // Test connection by trying to create a trace
    await langfuse.trace({
      name: 'connection-test',
      input: 'test',
      output: 'test'
    });
    console.log('✅ Langfuse connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Langfuse connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Langfuse Prompt Downloader');
  console.log('==============================\n');

  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.log('💡 Make sure LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST are set in server.env');
    process.exit(1);
  }

  console.log('');
  await downloadPrompts();
  console.log('\n🎉 Download complete!');
}

// Run the script
main().catch(console.error).finally(() => {
  langfuse.shutdown();
  process.exit(0);
});
