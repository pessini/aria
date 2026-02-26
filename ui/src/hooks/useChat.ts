import { useState, useCallback, useEffect } from 'react';
import type { Message, Conversation, FileAttachment } from '@/lib/llm';
import { useLLM } from '@/context/LLMContext';
import {
  db,
  getAllConversations,
  saveConversation,
  deleteConversation as dbDeleteConversation,
  getMessagesByConversation,
  saveMessage,
  type DBConversation,
} from '@/lib/db';

export function useChat() {
  const { provider } = useLLM();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  // Load conversations from database on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const dbConversations = await getAllConversations();
        
        // Load messages for each conversation
        const fullConversations: Conversation[] = await Promise.all(
          dbConversations.map(async (dbConv) => {
            const messages = await getMessagesByConversation(dbConv.id);
            return {
              id: dbConv.id,
              title: dbConv.title,
              messages,
              createdAt: dbConv.createdAt,
              updatedAt: dbConv.updatedAt,
              provider: dbConv.provider,
            };
          })
        );
        
        setConversations(fullConversations);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadConversations();
  }, []);

  const createConversation = useCallback(async (firstMessage?: Message) => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: firstMessage?.content.slice(0, 50) || 'New Chat',
      messages: firstMessage ? [firstMessage] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: 'langgraph',
    };
    
    // Save to database
    const dbConv: DBConversation = {
      id: newConversation.id,
      title: newConversation.title,
      createdAt: newConversation.createdAt,
      updatedAt: newConversation.updatedAt,
      provider: newConversation.provider,
    };
    await saveConversation(dbConv);
    
    if (firstMessage) {
      await saveMessage(newConversation.id, firstMessage);
    }
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    return newConversation;
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    attachments?: FileAttachment[]
  ) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments,
    };

    let conversation = currentConversation;
    
    if (!conversation) {
      conversation = await createConversation(userMessage);
    } else {
      // Save user message to database
      await saveMessage(conversation.id, userMessage);
      
      setConversations(prev =>
        prev.map(c =>
          c.id === conversation!.id
            ? { ...c, messages: [...c.messages, userMessage], updatedAt: new Date() }
            : c
        )
      );
      
      // Update conversation in database
      await saveConversation({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: new Date(),
        provider: conversation.provider,
      });
    }

    setIsLoading(true);
    setStreamingContent('');

    try {
      const messages = [...(conversation.messages || []), userMessage];
      
      let fullContent = '';
      
      await provider.streamChat(
        { messages },
        (chunk) => {
          if (!chunk.done) {
            fullContent += chunk.content;
            setStreamingContent(fullContent);
          }
        }
      );

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };

      // Save assistant message to database
      await saveMessage(conversation.id, assistantMessage);

      const updatedTitle = conversation.messages.length <= 1 
        ? userMessage.content.slice(0, 50) 
        : conversation.title;

      setConversations(prev =>
        prev.map(c =>
          c.id === conversation!.id
            ? { 
                ...c, 
                messages: [...c.messages, assistantMessage],
                updatedAt: new Date(),
                title: updatedTitle,
              }
            : c
        )
      );

      // Update conversation title in database
      await saveConversation({
        id: conversation.id,
        title: updatedTitle,
        createdAt: conversation.createdAt,
        updatedAt: new Date(),
        provider: conversation.provider,
      });

      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection settings and try again.',
        timestamp: new Date(),
      };

      await saveMessage(conversation.id, errorMessage);

      setConversations(prev =>
        prev.map(c =>
          c.id === conversation!.id
            ? { ...c, messages: [...c.messages, errorMessage], updatedAt: new Date() }
            : c
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [currentConversation, createConversation, provider]);

  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    // Delete from database
    await dbDeleteConversation(id);
    
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  }, [currentConversationId]);

  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    setStreamingContent('');
  }, []);

  return {
    conversations,
    currentConversation,
    isLoading,
    streamingContent,
    isInitialized,
    sendMessage,
    selectConversation,
    deleteConversation,
    startNewChat,
    createConversation,
  };
}
