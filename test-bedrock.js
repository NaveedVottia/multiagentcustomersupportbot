import { bedrock } from '@ai-sdk/amazon-bedrock';

async function testBedrock() {
  try {
    console.log('🧪 Testing Bedrock connection...');
    
    const model = bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0');
    console.log('✅ Model created:', model);
    
    const result = await model.generate('Hello, this is a test message.');
    console.log('✅ Generation successful:', result.text);
    
  } catch (error) {
    console.error('❌ Bedrock test failed:', error);
  }
}

testBedrock();
