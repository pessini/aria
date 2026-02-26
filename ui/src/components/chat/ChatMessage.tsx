import { memo } from 'react';
import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/llm';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

const ChatMessage = memo(({ message, isStreaming }: ChatMessageProps) => {
  const isAssistant = message.role === 'assistant';

  // Simple markdown-like rendering for code blocks
  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3);
        const firstNewline = codeContent.indexOf('\n');
        const language = firstNewline > 0 ? codeContent.slice(0, firstNewline).trim() : '';
        const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;
        
        return (
          <pre
            key={index}
            className="my-2 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-sm"
          >
            {language && (
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {language}
              </div>
            )}
            <code className="font-mono text-foreground">{code}</code>
          </pre>
        );
      }
      
      // Handle inline formatting
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part.split(/(\*\*[^*]+\*\*)/g).map((segment, i) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return (
                <strong key={i} className="font-semibold">
                  {segment.slice(2, -2)}
                </strong>
              );
            }
            return segment;
          })}
        </span>
      );
    });
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
