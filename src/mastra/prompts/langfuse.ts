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
    // SDK handles internal caching; expose configurable TTL
    const ttlSeconds = Math.max(1, Math.floor(cacheTtlMs / 1000));
    const promptClient = await client.getPrompt(name);
    const text = promptClient?.prompt ?? "";
    if (text) {
      promptCache[cacheKey] = { content: text, fetchedAt: Date.now() };
      console.log(`[Langfuse] ✅ Loaded prompt via SDK: ${name} (v${promptClient.version})`);
      return text;
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

