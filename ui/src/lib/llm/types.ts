// LLM Provider Types for ARIA
// Modular architecture for easy switching between providers

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string;
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  message: Message;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type LLMProviderType = 'langgraph';

export interface LLMProviderConfig {
  type: LLMProviderType;
  baseUrl: string;
  assistantId?: string;
  model?: string;
}

export interface LLMProvider {
  type: LLMProviderType;
  name: string;
  
  // Send a chat request and get a complete response
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  // Stream a chat response
  streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
  
  // Check if the provider is available/connected
  isAvailable(): Promise<boolean>;
  
  // Get available models
  getModels(): Promise<string[]>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  provider: LLMProviderType;
}
