// Test script for shared memory functionality
import { Memory } from "@mastra/memory";

console.log('🔍 Testing shared memory implementation...');

// Test the Memory constructor
try {
  const memory = new Memory();
  console.log('✅ Memory constructor works with no arguments');

  // Test basic operations
  memory.set('test', 'value');
  const value = memory.get('test');
  console.log('✅ Basic memory operations work:', value === 'value');

} catch (error) {
  console.error('❌ Memory constructor error:', error.message);
  console.error('Error details:', error);
}

console.log('🎉 Memory tests completed');
