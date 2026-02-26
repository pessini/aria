import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ThemeToggle from '@/components/ThemeToggle';
import type { Message, FileAttachment } from '@/lib/llm';

interface ChatViewProps {
  messages: Message[];
  streamingContent: string;
  onSendMessage: (message: string, attachments?: FileAttachment[]) => void;
  isLoading: boolean;
  theme: string;
  onThemeChange: (isDark: boolean) => void;
}

export default function ChatView({
  messages,
  streamingContent,
  onSendMessage,
  isLoading,
  theme,
  onThemeChange,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Theme Toggle - Top Right */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {/* Streaming Message */}
          {streamingContent && (
            <ChatMessage
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                timestamp: new Date(),
              }}
              isStreaming
            />
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Chat Input - Fixed at Bottom */}
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSend={onSendMessage}
            isLoading={isLoading}
            variant="chat"
          />
        </div>
      </div>
    </div>
  );
}
