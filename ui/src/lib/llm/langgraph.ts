// LangGraph Agent Provider
import type { ChatRequest, ChatResponse, LLMProvider, StreamChunk } from './types';

const DEFAULT_URL = import.meta.env.VITE_AEGRA_URL || 'http://localhost:4242';
const DEFAULT_ASSISTANT_ID = import.meta.env.VITE_AEGRA_ASSISTANT_ID || 'aria';

export class LangGraphProvider implements LLMProvider {
  readonly type = 'langgraph' as const;
  name = 'LangGraph';

  private readonly baseUrl: string;
  private readonly configuredAssistantId: string;
  private activeAssistantId: string;
  private threadId?: string;

  constructor(
    baseUrl: string = DEFAULT_URL,
    assistantId: string = DEFAULT_ASSISTANT_ID
  ) {
    this.baseUrl = baseUrl;
    this.configuredAssistantId = assistantId;
    this.activeAssistantId = assistantId;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async ensureThread(): Promise<string> {
    if (this.threadId) {
      return this.threadId;
    }

    const response = await fetch(`${this.baseUrl}/threads`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.statusText}`);
    }

    const data = await response.json();
    this.threadId = data.thread_id;
    return this.threadId!;
  }

  private async discoverAssistantId(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/assistants/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ limit: 100 }),
      });

      if (!response.ok) {
        return this.activeAssistantId;
      }

      const assistants = await response.json();
      const graphIds = assistants
        .map((assistant: { graph_id?: string }) => assistant.graph_id)
        .filter(Boolean);

      return graphIds[0] || this.activeAssistantId;
    } catch {
      return this.activeAssistantId;
    }
  }

  private async createRunResponse(
    threadId: string,
    request: ChatRequest,
    endpoint: '/wait' | '/stream',
    streamMode?: string[]
  ): Promise<Response> {
    const lastMessage = request.messages[request.messages.length - 1];

    const sendRequest = async (assistantId: string): Promise<Response> => {
      return fetch(`${this.baseUrl}/threads/${threadId}/runs${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          assistant_id: assistantId,
          input: {
            messages: [
              {
                role: lastMessage.role,
                content: lastMessage.content,
              },
            ],
          },
          ...(streamMode ? { stream_mode: streamMode } : {}),
        }),
      });
    };

    let response = await sendRequest(this.activeAssistantId);
    if (response.status === 404) {
      const fallbackAssistant = await this.discoverAssistantId();
      if (fallbackAssistant !== this.activeAssistantId) {
        this.activeAssistantId = fallbackAssistant;
        response = await sendRequest(this.activeAssistantId);
      }
    }

    return response;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const threadId = await this.ensureThread();
    const response = await this.createRunResponse(threadId, request, '/wait');

    if (!response.ok) {
      throw new Error(`LangGraph error: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.values?.messages || data.messages || [];
    const lastAssistantMessage = messages
      .filter((message: { type?: string; role?: string }) => {
        return message.type === 'ai' || message.role === 'assistant';
      })
      .pop();

    return {
      message: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: lastAssistantMessage?.content || '',
        timestamp: new Date(),
      },
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const threadId = await this.ensureThread();

    const response = await this.createRunResponse(
      threadId,
      request,
      '/stream',
      ['messages']
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LangGraph error: ${response.statusText} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';
    let lastContentLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
          continue;
        }

        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onChunk({ content: '', done: true });
            return;
          }

          if (currentEventType === 'messages/partial') {
            try {
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed) && parsed.length >= 1) {
                const message = parsed[0];
                if (message.type === 'ai' && message.content) {
                  const fullContent = message.content;
                  if (fullContent.length > lastContentLength) {
                    const delta = fullContent.slice(lastContentLength);
                    lastContentLength = fullContent.length;
                    onChunk({ content: delta, done: false });
                  }
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }

    onChunk({ content: '', done: true });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/assistants/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ limit: 100 }),
      });

      if (!response.ok) {
        return [this.activeAssistantId];
      }

      const data = await response.json();
      const graphIds = data
        .map((assistant: { graph_id?: string }) => assistant.graph_id)
        .filter(Boolean);
      return graphIds.length > 0 ? graphIds : [this.activeAssistantId];
    } catch {
      return [this.activeAssistantId];
    }
  }

  resetThread(): void {
    this.threadId = undefined;
    this.activeAssistantId = this.configuredAssistantId;
  }
}

export const createLangGraphProvider = (
  baseUrl?: string,
  assistantId?: string
): LLMProvider => {
  return new LangGraphProvider(baseUrl, assistantId);
};
