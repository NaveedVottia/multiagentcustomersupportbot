import { Langfuse } from 'langfuse'

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
  baseUrl: process.env.LANGFUSE_HOST ?? '',
})

type GetLangfusePromptType = {
  promptName: string
  defaultPrompt: string
}

export async function getLangfusePrompt({ promptName, defaultPrompt }: GetLangfusePromptType): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Langfuse] Using default prompt for ${promptName} in development mode`);
    return defaultPrompt
  }
  
  try {
    const prompt = await langfuse.getPrompt(promptName, undefined, {
      cacheTtlSeconds: 0,
    })
    
    console.log(`[Langfuse] ✅ Loaded ${promptName} prompt via SDK (v${prompt.version})`);
    return prompt.prompt
  } catch (error) {
    console.warn(`[Langfuse] ⚠️ Failed to load ${promptName} prompt, using default:`, error);
    return defaultPrompt
  }
}
