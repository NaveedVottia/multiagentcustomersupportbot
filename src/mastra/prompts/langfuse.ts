// Langfuse prompt loader via official SDK with minimal in-memory caching.
// Falls back to empty string when Langfuse is unavailable, so callers can use their own fallback.

import { Langfuse } from "langfuse";

type PromptCacheEntry = { content: string; fetchedAt: number };
const promptCache: Record<string, PromptCacheEntry> = {};

let langfuseClient: Langfuse | null = null;

function getEnv(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function getClient(): Langfuse | null {
  if (langfuseClient) return langfuseClient;
  const publicKey = getEnv("LANGFUSE_PUBLIC_KEY");
  const secretKey = getEnv("LANGFUSE_SECRET_KEY");
  const baseUrl = getEnv("LANGFUSE_HOST");

  if (!publicKey || !secretKey || !baseUrl) return null;

  langfuseClient = new Langfuse({ publicKey, secretKey, baseUrl });
  return langfuseClient;
}

export async function loadLangfusePrompt(
  name: string,
  { label = "production", cacheTtlMs = 1_000 }: { label?: string; cacheTtlMs?: number } = {} // Reduced TTL to 1 second
): Promise<string> {
  // Keep cache key shape compatible with previous implementations (label not used by SDK v2)
  const cacheKey = `${name}:${label}`;
  const cached = promptCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) return cached.content;

  const client = getClient();
  if (!client) {
    console.warn("[Langfuse] Env missing or client not initialized. Returning empty instructions.");
    promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
    return "";
  }

  try {
    // Try different possible method names for the Langfuse SDK
    let promptText = "";
    let methodUsed = "none";

    try {
      // Method 1: Try getPrompt (singular) - this is the standard method
      if (typeof (client as any).getPrompt === "function") {
        console.log(`[Langfuse] Using SDK getPrompt method for ${name}`);
        const response = await (client as any).getPrompt(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "getPrompt";
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "getPrompt.prompt";
        }
      }
      // Method 2: Try getPrompts (plural) - some versions might use this
      else if (typeof (client as any).getPrompts === "function" && !promptText) {
        console.log(`[Langfuse] Using SDK getPrompts method for ${name}`);
        const response = await (client as any).getPrompts(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "getPrompts";
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "getPrompts.prompt";
        }
      }
      // Method 3: Try to access prompts property directly
      else if ((client as any).prompts && typeof (client as any).prompts.get === "function" && !promptText) {
        console.log(`[Langfuse] Using SDK prompts.get method for ${name}`);
        const response = await (client as any).prompts.get(name);
        if (response && typeof response === "string") {
          promptText = response;
          methodUsed = "prompts.get";
        } else if (response && typeof response === "object" && response.prompt) {
          promptText = response.prompt;
          methodUsed = "prompts.get.prompt";
        }
      }
      else {
        // Log all available methods for debugging
        const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
          .filter(name => typeof (client as any)[name] === "function");
        console.log(`[Langfuse] Available methods:`, availableMethods);
        console.log(`[Langfuse] Available properties:`, Object.keys(client));
        
        throw new Error("No known prompt fetching method available in Langfuse SDK");
      }
    } catch (apiError) {
      console.log(`[Langfuse] SDK method '${methodUsed}' failed:`, apiError);
      throw new Error(`SDK method '${methodUsed}' failed: ${apiError}`);
    }

    if (promptText) {
      promptCache[cacheKey] = { content: promptText, fetchedAt: Date.now() };
      console.log(`[Langfuse] ✅ Loaded prompt via SDK: ${name} using method: ${methodUsed}`);
      console.log(`[Langfuse] Prompt length: ${promptText.length} characters`);
      return promptText;
    } else {
      console.warn(`[Langfuse] ⚠️ No prompt text extracted for ${name} using method: ${methodUsed}`);
    }
  } catch (err) {
    console.warn(`[Langfuse] Prompt fetch failed for ${name}:`, err);
  }

  // Return empty string so caller can decide fallback behavior
  console.warn(`[Langfuse] ⚠️ No prompt available for ${name}. Returning empty instructions.`);
  promptCache[cacheKey] = { content: "", fetchedAt: Date.now() };
  return "";
}

export function clearLangfusePromptCache(): void {
  for (const k of Object.keys(promptCache)) delete (promptCache as any)[k];
}

