import { langfuse } from './src/integrations/langfuse.ts';
import dotenv from 'dotenv';
dotenv.config({ path: './server.env' });

async function fetchCustomerIdentificationPrompt() {
  try {
    console.log('Fetching customer-identification prompt from Langfuse...');
    console.log('LANGFUSE_HOST:', process.env.LANGFUSE_HOST);
    console.log('LANGFUSE_PUBLIC_KEY:', process.env.LANGFUSE_PUBLIC_KEY ? 'Set' : 'Missing');
    console.log('LANGFUSE_SECRET_KEY:', process.env.LANGFUSE_SECRET_KEY ? 'Set' : 'Missing');
    
    const prompt = await langfuse.getPromptText('customer-identification', 'production');
    console.log('\n=== CUSTOMER IDENTIFICATION PROMPT ===');
    console.log(prompt);
    console.log('\n=== END PROMPT ===');
    
  } catch (error) {
    console.error('Error fetching prompt:', error);
  }
}

fetchCustomerIdentificationPrompt();
