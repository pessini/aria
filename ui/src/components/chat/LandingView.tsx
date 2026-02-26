import ChatInput from './ChatInput';
import ThemeToggle from '@/components/ThemeToggle';
import type { FileAttachment } from '@/lib/llm';
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder';
import ariaLogo from '@/assets/aria-logo.svg';
interface LandingViewProps {
  onSendMessage: (message: string, attachments?: FileAttachment[]) => void;
  isLoading: boolean;
  theme: string;
  onThemeChange: (isDark: boolean) => void;
}
export default function LandingView({
  onSendMessage,
  isLoading,
  theme,
  onThemeChange
}: LandingViewProps) {
  const placeholder = useRotatingPlaceholder();
  return (
    <div className="relative h-full flex-col px-4 pt-16 flex items-center justify-center">
      {/* Theme Toggle - Top Right */}
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </div>

      <div className="w-full max-w-2xl space-y-16">
        {/* ARIA Branding - Top Section */}
        <div className="text-center space-y-4 flex flex-col items-center">
          <img src={ariaLogo} alt="ARIA logo" className="h-20 w-20" />
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold text-foreground tracking-tight">
              ARIA
            </h1>
            <p className="text-lg text-muted-foreground">
              Automation & Reasoning Intelligent Agent
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-4 my-[200px]">


          <ChatInput onSend={onSendMessage} isLoading={isLoading} placeholder={placeholder} variant="landing" />
        </div>
      </div>
    </div>
  );
}