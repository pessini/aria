import { forwardRef, useState, useRef, KeyboardEvent } from 'react';
import { Paperclip, Send, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FileAttachment } from '@/lib/llm';

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  variant?: 'landing' | 'chat';
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ onSend, isLoading, placeholder = "Ask ARIA anything about N8N workflows...", className, variant = 'chat' }, ref) => {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const handleSend = () => {
      if (message.trim() || attachments.length > 0) {
        onSend(message.trim(), attachments.length > 0 ? attachments : undefined);
        setMessage('');
        setAttachments([]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const newAttachment: FileAttachment = {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            content: reader.result as string,
          };
          setAttachments(prev => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const isLanding = variant === 'landing';

    return (
      <div className={cn(
        "relative rounded-2xl border border-border bg-card transition-all duration-200",
        isLanding ? "shadow-lg" : "shadow-sm",
        "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50",
        className
      )}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-32 truncate text-foreground">{file.name}</span>
                <button
                  onClick={() => removeAttachment(file.id)}
                  className="rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".json,.yaml,.yml,.txt,.md,.js,.ts,.py,.n8n"
        />

        {isLanding ? (
          <div className="flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-2 leading-normal text-base min-h-[40px] max-h-[200px]"
              style={{
                height: 'auto',
                overflowY: message.split('\n').length > 5 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            
            <Button
              type="button"
              onClick={handleSend}
              disabled={isLoading || (!message.trim() && attachments.length === 0)}
              size="icon"
              className="h-7 w-7 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center [&_svg]:size-3.5"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ) : (
        <div className="flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-2.5 leading-normal min-h-[40px] max-h-[200px] text-sm"
              style={{
                height: 'auto',
                overflowY: message.split('\n').length > 5 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            
            <Button
              type="button"
              onClick={handleSend}
              disabled={isLoading || (!message.trim() && attachments.length === 0)}
              size="icon"
              className="h-7 w-7 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
