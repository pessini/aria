// Local Database using Dexie (IndexedDB wrapper - SQLite-like for browsers)
import Dexie, { type EntityTable } from 'dexie';
import type { Message, LLMProviderType } from '@/lib/llm';

const DEFAULT_LANGGRAPH_URL =
  import.meta.env.VITE_AEGRA_URL || 'http://localhost:4242';

// Database entity interfaces
export interface DBConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  provider: LLMProviderType;
}

export interface DBMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: string; // JSON stringified FileAttachment[]
}

export interface DBSettings {
  id: string; // Always 'app_settings' for singleton
  providerType: LLMProviderType;
  langgraphUrl: string;
  theme?: 'light' | 'dark' | 'system';
  updatedAt: Date;
}

// Define the database
class AriaDatabase extends Dexie {
  conversations!: EntityTable<DBConversation, 'id'>;
  messages!: EntityTable<DBMessage, 'id'>;
  settings!: EntityTable<DBSettings, 'id'>;

  constructor() {
    super('AriaDB');
    
    this.version(1).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    });
    
    this.version(2).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    });
    
    this.version(3).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    });
    
    this.version(4).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    });
    
    this.version(5).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    });

    // Version 6: Remove agno, simplify to langgraph-only
    this.version(6).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, timestamp',
      settings: 'id',
    }).upgrade(async tx => {
      const settingsTable = tx.table('settings');
      const allSettings = await settingsTable.toArray();
      
      for (const settings of allSettings) {
        await settingsTable.update(settings.id, {
          providerType: 'langgraph',
          langgraphUrl: settings.langgraphUrl || DEFAULT_LANGGRAPH_URL,
        });
      }
    });
  }
}

// Singleton database instance
export const db = new AriaDatabase();

// Helper functions for settings
export async function getSettings(): Promise<DBSettings | undefined> {
  return await db.settings.get('app_settings');
}

export async function saveSettings(settings: Partial<DBSettings>): Promise<void> {
  const existing = await db.settings.get('app_settings');
  
  if (existing) {
    await db.settings.update('app_settings', {
      ...settings,
      updatedAt: new Date(),
    });
  } else {
    await db.settings.add({
      id: 'app_settings',
      providerType: 'langgraph',
      langgraphUrl: DEFAULT_LANGGRAPH_URL,
      updatedAt: new Date(),
      ...settings,
    });
  }
}

// Helper functions for conversations
export async function getAllConversations(): Promise<DBConversation[]> {
  return await db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function getConversation(id: string): Promise<DBConversation | undefined> {
  return await db.conversations.get(id);
}

export async function saveConversation(conversation: DBConversation): Promise<void> {
  await db.conversations.put(conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
  });
}

// Helper functions for messages
export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
  const dbMessages = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp');
  
  return dbMessages.map(dbMsg => ({
    id: dbMsg.id,
    role: dbMsg.role,
    content: dbMsg.content,
    timestamp: dbMsg.timestamp,
    attachments: dbMsg.attachments ? JSON.parse(dbMsg.attachments) : undefined,
  }));
}

export async function saveMessage(conversationId: string, message: Message): Promise<void> {
  await db.messages.put({
    id: message.id,
    conversationId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    attachments: message.attachments ? JSON.stringify(message.attachments) : undefined,
  });
}

export async function deleteMessage(id: string): Promise<void> {
  await db.messages.delete(id);
}

// Load full conversation with messages
export async function loadConversationWithMessages(id: string): Promise<{
  conversation: DBConversation;
  messages: Message[];
} | null> {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  
  const messages = await getMessagesByConversation(id);
  return { conversation, messages };
}
