import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { LLMProvider, LLMProviderConfig } from '@/lib/llm';
import { createProvider, getDefaultConfig, DEFAULT_LANGGRAPH_URL } from '@/lib/llm';
import { getSettings, saveSettings } from '@/lib/db';

interface LLMContextType {
  provider: LLMProvider;
  config: LLMProviderConfig;
  isConnected: boolean;
  isLoading: boolean;
  langgraphUrl: string;
  updateLanggraphUrl: (url: string) => void;
  checkConnection: () => Promise<boolean>;
}

const LLMContext = createContext<LLMContextType | null>(null);

export function LLMContextProvider({ children }: { children: ReactNode }) {
  const [langgraphUrl, setLanggraphUrl] = useState(DEFAULT_LANGGRAPH_URL);
  const [config, setConfig] = useState<LLMProviderConfig>(getDefaultConfig());
  const [provider, setProvider] = useState<LLMProvider>(() => createProvider(config));
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettingsFromDB = async () => {
      try {
        const settings = await getSettings();
        if (settings) {
          const url = settings.langgraphUrl || DEFAULT_LANGGRAPH_URL;
          const newConfig: LLMProviderConfig = { type: 'langgraph', baseUrl: url };

          setLanggraphUrl(url);
          setConfig(newConfig);
          setProvider(createProvider(newConfig));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsFromDB();
  }, []);

  const updateLanggraphUrl = useCallback(async (url: string) => {
    setLanggraphUrl(url);
    const newConfig: LLMProviderConfig = { type: 'langgraph', baseUrl: url };
    setConfig(newConfig);
    setProvider(createProvider(newConfig));
    setIsConnected(false);
    await saveSettings({ langgraphUrl: url });
  }, []);

  const checkConnection = useCallback(async () => {
    const available = await provider.isAvailable();
    setIsConnected(available);
    return available;
  }, [provider]);

  return (
    <LLMContext.Provider
      value={{
        provider,
        config,
        isConnected,
        isLoading,
        langgraphUrl,
        updateLanggraphUrl,
        checkConnection,
      }}
    >
      {children}
    </LLMContext.Provider>
  );
}

export function useLLM() {
  const context = useContext(LLMContext);
  if (!context) {
    throw new Error('useLLM must be used within an LLMContextProvider');
  }
  return context;
}
