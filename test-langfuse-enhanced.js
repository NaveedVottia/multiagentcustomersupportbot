#!/usr/bin/env node

/**
 * Test script for enhanced Langfuse integration
 * Tests sessions, user tracking, and evaluations
 */

const BASE_URL = 'http://localhost:80';

async function testEndpoint(endpoint, method = 'GET', body = null, headers = {}) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`✅ ${method} ${endpoint}:`, data);
    return { success: true, data, status: response.status };
  } catch (error) {
    console.error(`❌ ${method} ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting enhanced Langfuse integration tests...\n');
  
  // Test 1: Health check
  console.log('1️⃣ Testing health check...');
  await testEndpoint('/health');
  
  // Test 2: Langfuse health
  console.log('\n2️⃣ Testing Langfuse health...');
  await testEndpoint('/health/langfuse');
  
  // Test 3: Start a session
  console.log('\n3️⃣ Testing session start...');
  const sessionResult = await testEndpoint('/api/session/start', 'POST', {
    sessionId: 'test_session_001',
    userId: 'test_user_001',
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    }
  });
  
  if (!sessionResult.success) {
    console.log('❌ Session start failed, skipping remaining tests');
    return;
  }
  
  // Test 4: Check current session
  console.log('\n4️⃣ Testing current session...');
  await testEndpoint('/api/session/current');
  
  // Test 5: Set user
  console.log('\n5️⃣ Testing user set...');
  await testEndpoint('/api/user/set', 'POST', {
    userId: 'test_user_001',
    metadata: {
      name: 'Test User',
      role: 'tester'
    }
  });
  
  // Test 6: Test agent endpoint with session
  console.log('\n6️⃣ Testing agent endpoint with session...');
  await testEndpoint('/api/agents/repair-workflow-orchestrator/stream', 'POST', {
    messages: [
      {
        role: 'user',
        content: 'こんにちは、サンデンの修理について教えてください'
      }
    ]
  }, {
    'X-Session-ID': 'test_session_001',
    'X-User-ID': 'test_user_001'
  });
  
  // Test 7: Test response evaluation
  console.log('\n7️⃣ Testing response evaluation...');
  await testEndpoint('/api/evaluate/response', 'POST', {
    responseText: 'こんにちは。サンデン・リテールシステムの修理受付です。お手伝いさせていただきます。',
    score: 8,
    comment: 'Good response, clear and helpful',
    criteria: ['clarity', 'helpfulness', 'politeness'],
    metadata: {
      category: 'customer_service',
      language: 'ja'
    }
  });
  
  // Test 8: Test customer service evaluation
  console.log('\n8️⃣ Testing customer service evaluation...');
  await testEndpoint('/api/evaluate/customer-service', 'POST', {
    responseText: 'お客様の製品について詳しく教えてください。',
    score: 9,
    comment: 'Excellent follow-up question'
  });
  
  // Test 9: Test technical evaluation
  console.log('\n9️⃣ Testing technical evaluation...');
  await testEndpoint('/api/evaluate/technical', 'POST', {
    responseText: 'このエラーは通常、電源の問題が原因です。',
    score: 7,
    comment: 'Good technical insight'
  });
  
  // Test 10: Test UX evaluation
  console.log('\n🔟 Testing UX evaluation...');
  await testEndpoint('/api/evaluate/ux', 'POST', {
    responseText: 'わかりました。次に進みましょう。',
    score: 8,
    comment: 'Clear and user-friendly'
  });
  
  // Test 11: Test batch evaluation
  console.log('\n1️⃣1️⃣ Testing batch evaluation...');
  await testEndpoint('/api/evaluate/batch', 'POST', {
    responses: [
      {
        text: 'こんにちは',
        score: 8,
        comment: 'Good greeting',
        context: 'initial_response'
      },
      {
        text: 'お手伝いします',
        score: 9,
        comment: 'Helpful response',
        context: 'follow_up'
      }
    ]
  });
  
  // Test 12: End session
  console.log('\n1️⃣2️⃣ Testing session end...');
  await testEndpoint('/api/session/end', 'POST');
  
  // Test 13: Final health check
  console.log('\n1️⃣3️⃣ Final health check...');
  await testEndpoint('/health');
  
  console.log('\n🎉 All tests completed!');
}

// Run tests
runTests().catch(console.error);
