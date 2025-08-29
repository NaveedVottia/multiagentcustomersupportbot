// Comprehensive Prompt Management System
// Primary: Langfuse prompts via SDK
// Fallback: Local hardcoded prompts
// Backup: Empty string (for debugging)

import { loadLangfusePrompt } from './langfuse.js';
import { LANGFUSE_PROMPTS } from './langfuse-prompts.js';

export interface PromptInfo {
  name: string;
  description: string;
  content: string;
  source: 'langfuse' | 'local' | 'none';
  lastUpdated?: Date;
}

class PromptManager {
  private promptCache: Map<string, PromptInfo> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a prompt by name, trying Langfuse first, then local fallback
   */
  async getPrompt(name: string, options: { 
    forceRefresh?: boolean; 
    useLocalOnly?: boolean;
    label?: string;
  } = {}): Promise<PromptInfo> {
    const { forceRefresh = false, useLocalOnly = false, label = 'production' } = options;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && this.promptCache.has(name)) {
      const cached = this.promptCache.get(name)!;
      if (Date.now() - (cached.lastUpdated?.getTime() || 0) < this.CACHE_TTL_MS) {
        return cached;
      }
    }

    let promptInfo: PromptInfo;

    if (useLocalOnly) {
      // Use local prompts only
      promptInfo = this.getLocalPrompt(name);
    } else {
      // Try Langfuse first, then fallback to local
      promptInfo = await this.getPromptWithFallback(name, label);
    }

    // Cache the result
    this.promptCache.set(name, promptInfo);
    
    return promptInfo;
  }

  /**
   * Try to get prompt from Langfuse, fallback to local
   */
  private async getPromptWithFallback(name: string, label: string): Promise<PromptInfo> {
    try {
      // Try Langfuse first
      const langfuseContent = await loadLangfusePrompt(name, { label });
      
      if (langfuseContent && langfuseContent.trim()) {
        console.log(`✅ [PromptManager] Loaded prompt from Langfuse: ${name}`);
        return {
          name,
          description: `Prompt loaded from Langfuse: ${name}`,
          content: langfuseContent,
          source: 'langfuse',
          lastUpdated: new Date()
        };
      }
    } catch (error) {
      console.warn(`⚠️ [PromptManager] Failed to load from Langfuse: ${name}`, error);
    }

    // Fallback to local prompt
    const localPrompt = this.getLocalPrompt(name);
    if (localPrompt.source === 'local') {
      console.log(`📁 [PromptManager] Using local fallback for: ${name}`);
      return localPrompt;
    }

    // No prompt available
    console.error(`❌ [PromptManager] No prompt available for: ${name}`);
    return {
      name,
      description: `No prompt available: ${name}`,
      content: '',
      source: 'none',
      lastUpdated: new Date()
    };
  }

  /**
   * Get local prompt from hardcoded prompts
   */
  private getLocalPrompt(name: string): PromptInfo {
    const localPrompt = LANGFUSE_PROMPTS[name as keyof typeof LANGFUSE_PROMPTS];
    
    if (localPrompt) {
      return {
        name: localPrompt.name,
        description: localPrompt.description,
        content: localPrompt.content,
        source: 'local',
        lastUpdated: new Date()
      };
    }

    // No local prompt found
    return {
      name,
      description: `Local prompt not found: ${name}`,
      content: '',
      source: 'none',
      lastUpdated: new Date()
    };
  }

  /**
   * Get all available prompt names
   */
  getAllPromptNames(): string[] {
    return Object.keys(LANGFUSE_PROMPTS);
  }

  /**
   * Get prompt content directly (synchronous, local only)
   */
  getPromptContentSync(name: string): string {
    const localPrompt = LANGFUSE_PROMPTS[name as keyof typeof LANGFUSE_PROMPTS];
    return localPrompt ? localPrompt.content : '';
  }

  /**
   * Check if a prompt exists (either in Langfuse or local)
   */
  async promptExists(name: string): Promise<boolean> {
    const prompt = await this.getPrompt(name);
    return prompt.source !== 'none';
  }

  /**
   * Get prompt statistics
   */
  getStats(): {
    totalPrompts: number;
    cachedPrompts: number;
    langfusePrompts: number;
    localPrompts: number;
    missingPrompts: number;
  } {
    const totalPrompts = this.getAllPromptNames().length;
    const cachedPrompts = this.promptCache.size;
    
    let langfusePrompts = 0;
    let localPrompts = 0;
    let missingPrompts = 0;

    for (const prompt of this.promptCache.values()) {
      switch (prompt.source) {
        case 'langfuse':
          langfusePrompts++;
          break;
        case 'local':
          localPrompts++;
          break;
        case 'none':
          missingPrompts++;
          break;
      }
    }

    return {
      totalPrompts,
      cachedPrompts,
      langfusePrompts,
      localPrompts,
      missingPrompts
    };
  }

  /**
   * Clear the prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
    console.log('🧹 [PromptManager] Cache cleared');
  }

  /**
   * Refresh all prompts (force reload from Langfuse)
   */
  async refreshAllPrompts(): Promise<void> {
    console.log('🔄 [PromptManager] Refreshing all prompts...');
    this.clearCache();
    
    const promptNames = this.getAllPromptNames();
    for (const name of promptNames) {
      await this.getPrompt(name, { forceRefresh: true });
    }
    
    console.log('✅ [PromptManager] All prompts refreshed');
  }
}

// Export singleton instance
export const promptManager = new PromptManager();

// Export convenience functions
export const getPrompt = (name: string, options?: Parameters<typeof promptManager.getPrompt>[1]) => 
  promptManager.getPrompt(name, options);

export const getPromptContentSync = (name: string) => 
  promptManager.getPromptContentSync(name);

export const getAllPromptNames = () => 
  promptManager.getAllPromptNames();

export const promptExists = (name: string) => 
  promptManager.promptExists(name);

export const getPromptStats = () => 
  promptManager.getStats();

export const clearPromptCache = () => 
  promptManager.clearCache();

export const refreshAllPrompts = () => 
  promptManager.refreshAllPrompts();
