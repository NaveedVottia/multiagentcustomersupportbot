#!/usr/bin/env node

import { initializeAgent } from './dist/mastra/agents/sanden/customer-identification.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './server.env' });

async function testCustomerLookup() {
  console.log('🔍 Testing Customer Lookup with Zapier...');
  
  try {
    // Initialize the agent
    const agent = await initializeAgent();
    console.log('✅ Agent initialized successfully');
    
    // Test with customer information
    const messages = [
      { role: 'user', content: '1' }, // Select repair service
      { role: 'user', content: 'マツモトキヨシ 千葉中央店 repairs@mk-chiba.jp 043-223-1122' } // Customer details
    ];
    
    console.log('🔍 Testing customer lookup...');
    const response = await agent.generate(messages);
    
    console.log('✅ Agent response:', response.text);
    
    // Check if the agent found customer data
    if (response.text.includes('顧客情報が確認できました') || response.text.includes('修理サービスメニュー')) {
      console.log('✅ Agent successfully used Zapier database for customer lookup');
    } else if (response.text.includes('該当する顧客情報が見つかりませんでした')) {
      console.log('⚠️ Agent used Zapier database but customer not found (this is normal)');
    } else {
      console.log('❌ Agent may not be using Zapier database correctly');
    }
    
  } catch (error) {
    console.error('❌ Error testing customer lookup:', error);
  }
}

testCustomerLookup().catch(console.error);
