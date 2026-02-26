import { useState } from 'react';
import { Loader2, PanelLeft } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useLLM } from '@/context/LLMContext';
import { useTheme } from '@/context/ThemeContext';
import ChatSidebarPanel from '@/components/chat/ChatSidebarPanel';
import ChatView from '@/components/chat/ChatView';
import LandingView from '@/components/chat/LandingView';
import SettingsPanel from '@/components/chat/SettingsPanel';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export default function Index() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isLoading: isLLMLoading } = useLLM();
  const { resolvedTheme, setTheme } = useTheme();
  
  const {
    conversations,
    currentConversation,
    isLoading,
    streamingContent,
    isInitialized,
    sendMessage,
    selectConversation,
    deleteConversation,
    startNewChat,
  } = useChat();

  // Show loading state while database initializes
  if (!isInitialized || isLLMLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading ARIA...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <MainContent
        currentConversation={currentConversation}
        conversations={conversations}
        streamingContent={streamingContent}
        isLoading={isLoading}
        sendMessage={sendMessage}
        selectConversation={selectConversation}
        deleteConversation={deleteConversation}
        startNewChat={startNewChat}
        resolvedTheme={resolvedTheme}
        setTheme={setTheme}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />
    </SidebarProvider>
  );
}

// Separate component to access useSidebar hook inside SidebarProvider
function MainContent({
  currentConversation,
  conversations,
  streamingContent,
  isLoading,
  sendMessage,
  selectConversation,
  deleteConversation,
  startNewChat,
  resolvedTheme,
  setTheme,
  isSettingsOpen,
  setIsSettingsOpen,
}: {
  currentConversation: ReturnType<typeof useChat>['currentConversation'];
  conversations: ReturnType<typeof useChat>['conversations'];
  streamingContent: string;
  isLoading: boolean;
  sendMessage: ReturnType<typeof useChat>['sendMessage'];
  selectConversation: ReturnType<typeof useChat>['selectConversation'];
  deleteConversation: ReturnType<typeof useChat>['deleteConversation'];
  startNewChat: ReturnType<typeof useChat>['startNewChat'];
  resolvedTheme: string;
  setTheme: (theme: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const hasMessages = currentConversation && currentConversation.messages.length > 0;

  const handleThemeChange = (isDark: boolean) => setTheme(isDark ? 'dark' : 'light');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Chat Sidebar - History & Settings */}
      <ChatSidebarPanel
        conversations={conversations}
        currentConversationId={currentConversation?.id ?? null}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onNewChat={startNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Main Content Area */}
      <SidebarInset className="relative flex flex-col overflow-hidden">
        {/* Floating button to open sidebar when collapsed */}
        {isCollapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            className="absolute left-4 top-4 z-10 h-9 w-9 shadow-md"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        
        {hasMessages ? (
          /* Chat View when messages exist */
          <ChatView
            messages={currentConversation.messages}
            streamingContent={streamingContent}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            theme={resolvedTheme}
            onThemeChange={handleThemeChange}
          />
        ) : (
          /* Landing View when no chat */
          <LandingView
            onSendMessage={sendMessage}
            isLoading={isLoading}
            theme={resolvedTheme}
            onThemeChange={handleThemeChange}
          />
        )}
      </SidebarInset>
      
      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
