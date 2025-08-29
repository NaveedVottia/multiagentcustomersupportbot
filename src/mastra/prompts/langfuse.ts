// Langfuse prompt loader via official SDK with robust fallback to local prompts.
// Langfuse is the PRIMARY source, hardcoded prompts are PLAN B when Langfuse fails.
// 
// 🚫 TEMPORARILY DISABLED: Local fallbacks are disabled to force Langfuse-only mode.
// 🔧 To re-enable fallbacks, restore the fallback logic in the loadLangfusePrompt function.

import { Langfuse } from "langfuse";
import { readFileSync } from 'fs';
import { join } from 'path';

// Cache for prompts to avoid repeated API calls
const promptCache: Record<string, { content: string; fetchedAt: number; source: 'langfuse' | 'fallback' }> = {};

// Get Langfuse client from environment variables
function getClient(): Langfuse | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_HOST;

  if (!publicKey || !secretKey || !baseUrl) {
    console.warn("[Langfuse] Missing environment variables for Langfuse client");
    return null;
  }

  try {
    const langfuseClient = new Langfuse({ publicKey, secretKey, baseUrl });
    return langfuseClient;
  } catch (error) {
    console.error("[Langfuse] Failed to create Langfuse client:", error);
    return null;
  }
}

// Fallback to local prompts when Langfuse fails
function getLocalPromptFallback(name: string): string {
  try {
    // Map Langfuse prompt names to local file names
    const promptFileMap: Record<string, string> = {
      "customer-identification": "customer-identification-prompt.txt",
      "repair-agent": "repair-agent-prompt.txt", 
      "repair-history-ticket": "repair-history-ticket-prompt.txt",
      "repair-scheduling": "repair-scheduling-prompt.txt",
      "orchestrator": "orchestrator-prompt.txt"
    };

    const fileName = promptFileMap[name];
    if (!fileName) {
      console.warn(`[Langfuse] No local fallback file mapped for prompt: ${name}`);
      return "";
    }

    const promptPath = join(process.cwd(), 'src/mastra/prompts', fileName);
    const content = readFileSync(promptPath, 'utf8').trim();
    
    if (content) {
      console.log(`[Langfuse] 🔄 FALLBACK: Loaded local prompt for ${name} (length: ${content.length})`);
      return content;
    } else {
      console.warn(`[Langfuse] ⚠️ Local fallback file is empty: ${fileName}`);
      return "";
    }
  } catch (error) {
    console.error(`[Langfuse] ❌ Failed to load local fallback for ${name}:`, error);
    return "";
  }
}

export async function loadLangfusePrompt(
  name: string,
  { label = "production", cacheTtlMs = 5_000 }: { label?: string; cacheTtlMs?: number } = {} // Increased TTL to 5 seconds
): Promise<string> {
  const cacheKey = `${name}:${label}`;
  const cached = promptCache[cacheKey];
  
  // Return cached result if still valid
  if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
    console.log(`[Langfuse] 📋 Using cached prompt for ${name} (source: ${cached.source})`);
    return cached.content;
  }

  const client = getClient();
  if (!client) {
    console.warn("[Langfuse] ❌ Environment missing or client not initialized. Using local fallback.");
    const fallbackContent = getLocalPromptFallback(name);
    if (fallbackContent) {
      promptCache[cacheKey] = { content: fallbackContent, fetchedAt: Date.now(), source: 'fallback' };
      return fallbackContent;
    } else {
      throw new Error(`[Langfuse] Failed to load prompt '${name}' - no Langfuse client and no local fallback available`);
    }
  }

  // PRIMARY: Try to load from Langfuse first
  console.log(`[Langfuse] 🚀 Attempting to load prompt '${name}' from Langfuse...`);
  
  try {
    let promptText = "";
    let methodUsed = "none";
    let langfuseSuccess = false;

    // Method 1: Try getPrompt (singular) - this is the standard method
    if (typeof (client as any).getPrompt === "function") {
      try {
        console.log(`[Langfuse] 🔍 Trying getPrompt method for ${name}`);
        const response = await (client as any).getPrompt(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "getPrompt";
          langfuseSuccess = true;
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "getPrompt.prompt";
          langfuseSuccess = true;
        }
             } catch (error) {
         console.log(`[Langfuse] ⚠️ getPrompt method failed for ${name}:`, (error as Error).message);
       }
    }

    // Method 2: Try getPrompts (plural) if first method failed
    if (!langfuseSuccess && typeof (client as any).getPrompts === "function") {
      try {
        console.log(`[Langfuse] 🔍 Trying getPrompts method for ${name}`);
        const response = await (client as any).getPrompts(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "getPrompts";
          langfuseSuccess = true;
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "getPrompts.prompt";
          langfuseSuccess = true;
        }
             } catch (error) {
         console.log(`[Langfuse] ⚠️ getPrompts method failed for ${name}:`, (error as Error).message);
       }
    }

    // Method 3: Try prompts.get if previous methods failed
    if (!langfuseSuccess && (client as any).prompts && typeof (client as any).prompts.get === "function") {
      try {
        console.log(`[Langfuse] 🔍 Trying prompts.get method for ${name}`);
        const response = await (client as any).prompts.get(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "prompts.get";
          langfuseSuccess = true;
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "prompts.get.prompt";
          langfuseSuccess = true;
        }
             } catch (error) {
         console.log(`[Langfuse] ⚠️ prompts.get method failed for ${name}:`, (error as Error).message);
       }
    }

    // SUCCESS: Langfuse prompt loaded
    if (langfuseSuccess && promptText) {
      promptCache[cacheKey] = { content: promptText, fetchedAt: Date.now(), source: 'langfuse' };
      console.log(`[Langfuse] ✅ SUCCESS: Loaded prompt via SDK: ${name} using method: ${methodUsed}`);
      console.log(`[Langfuse] 📏 Prompt length: ${promptText.length} characters`);
      return promptText;
    }

    // FAILURE: No method worked
    if (!langfuseSuccess) {
      // Log available methods for debugging
      const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
        .filter(name => typeof (client as any)[name] === "function");
      console.log(`[Langfuse] 🔍 Available methods:`, availableMethods);
      console.log(`[Langfuse] 🔍 Available properties:`, Object.keys(client));
      
      throw new Error(`[Langfuse] No known prompt fetching method available in Langfuse SDK for '${name}'`);
    }

     } catch (langfuseError) {
     console.error(`[Langfuse] ❌ Failed to load prompt '${name}' from Langfuse:`, (langfuseError as Error).message);
   }

             // PLAN B: Fallback to local prompts when Langfuse fails (TEMPORARILY DISABLED)
           console.log(`[Langfuse] 🚫 FALLBACK DISABLED: Langfuse failed for '${name}', local prompts are temporarily disabled`);
           console.log(`[Langfuse] 🔧 To re-enable fallback, modify loadLangfusePrompt function in src/mastra/prompts/langfuse.ts`);
           
           // Force Langfuse-only mode - no local fallback
           throw new Error(`[Langfuse] CRITICAL: Failed to load prompt '${name}' - Langfuse is required, local fallbacks are disabled`);
}

export function clearLangfusePromptCache(): void {
  for (const k of Object.keys(promptCache)) delete (promptCache as any)[k];
  console.log("[Langfuse] 🗑️ Prompt cache cleared");
}

// Debug function to show cache status
export function getLangfusePromptCacheStatus(): Record<string, { source: string; age: string; length: number }> {
  const now = Date.now();
  const status: Record<string, { source: string; age: string; length: number }> = {};
  
  for (const [key, value] of Object.entries(promptCache)) {
    const ageMs = now - value.fetchedAt;
    const age = ageMs < 1000 ? `${ageMs}ms` : `${Math.round(ageMs / 1000)}s`;
    status[key] = {
      source: value.source,
      age,
      length: value.content.length
    };
  }
  
  return status;
}

