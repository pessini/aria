import { memo } from 'react';
import { Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/llm';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

const ChatMessage = memo(({ message, isStreaming }: ChatMessageProps) => {
  const isAssistant = message.role === 'assistant';

  const renderContent = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
               className="text-primary underline hover:opacity-80">
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-sm">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="font-mono text-foreground">{children}</code>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className={cn(
      "flex py-2",
      isAssistant ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "max-w-[85%] space-y-1",
        isAssistant 
          ? "text-foreground" 
          : "bg-primary/10 rounded-2xl px-3 py-2"
      )}>
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1.5",
            isAssistant ? "justify-start" : "justify-end"
          )}>
            {message.attachments.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground">{file.name}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className={cn(
          "text-sm leading-relaxed",
          isAssistant ? "text-foreground" : "text-foreground"
        )}>
          {renderContent(message.content)}
          {isStreaming && (
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary" />
          )}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
