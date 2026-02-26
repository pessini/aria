// LLM Provider Factory
import type { LLMProvider, LLMProviderConfig } from './types';
import { createLangGraphProvider } from './langgraph';

export * from './types';
export { createLangGraphProvider } from './langgraph';

export const DEFAULT_LANGGRAPH_URL =
  import.meta.env.VITE_AEGRA_URL || 'http://localhost:4242';
export const DEFAULT_ASSISTANT_ID =
  import.meta.env.VITE_AEGRA_ASSISTANT_ID || 'aria';

export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'langgraph':
      return createLangGraphProvider(config.baseUrl, config.assistantId);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function getDefaultConfig(): LLMProviderConfig {
  return {
    type: 'langgraph',
    baseUrl: DEFAULT_LANGGRAPH_URL,
    assistantId: DEFAULT_ASSISTANT_ID,
  };
}
