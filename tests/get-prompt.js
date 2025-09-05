import dotenv from 'dotenv';
import { Langfuse } from 'langfuse';

dotenv.config({ path: './server.env' });

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

async function getPrompt() {
  try {
    const prompt = await langfuse.getPrompt('customer-identification', 'production');
    console.log('=== CUSTOMER IDENTIFICATION PROMPT ===');
    console.log(prompt.prompt);
  } catch (error) {
    console.error('Error:', error);
  }
}

getPrompt();
