import { User } from './index';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'link' | 'location';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: Message;
  reactions?: MessageReaction[];
  isForwarded?: boolean;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  isTyping?: boolean;
  lastTypingUser?: User;
  createdAt: string;
  updatedAt: string;
}
