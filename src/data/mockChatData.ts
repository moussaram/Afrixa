import { mockUsers, currentUser } from './mockData';
import { Conversation, Message } from '@/types/chat';

export const mockMessages: Message[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    senderId: mockUsers[0].id,
    content: 'Salut ! Tu as vu la nouvelle vidéo ? 🔥',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2',
    conversationId: 'c1',
    senderId: currentUser.id,
    content: 'Oui c\'est incroyable ! 😍',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3',
    conversationId: 'c1',
    senderId: mockUsers[0].id,
    content: 'On devrait faire une collab !',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'm4',
    conversationId: 'c2',
    senderId: mockUsers[1].id,
    content: 'Tu viens à l\'événement demain ?',
    type: 'text',
    status: 'delivered',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'm5',
    conversationId: 'c3',
    senderId: mockUsers[2].id,
    content: 'Mdr t\'as vu ce meme 😂',
    type: 'text',
    status: 'delivered',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm6',
    conversationId: 'c4',
    senderId: currentUser.id,
    content: 'Super tuto merci !',
    type: 'text',
    status: 'read',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm7',
    conversationId: 'c5',
    senderId: mockUsers[4].id,
    content: '📷 Photo',
    type: 'image',
    status: 'delivered',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockConversations: Conversation[] = [
  {
    id: 'c1',
    participants: [currentUser, mockUsers[0]],
    lastMessage: mockMessages.find(m => m.id === 'm3'),
    unreadCount: 2,
    isPinned: true,
    isMuted: false,
    isArchived: false,
    isTyping: true,
    lastTypingUser: mockUsers[0],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'c2',
    participants: [currentUser, mockUsers[1]],
    lastMessage: mockMessages.find(m => m.id === 'm4'),
    unreadCount: 1,
    isPinned: false,
    isMuted: false,
    isArchived: false,
    createdAt: '2024-01-08T14:00:00Z',
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'c3',
    participants: [currentUser, mockUsers[2]],
    lastMessage: mockMessages.find(m => m.id === 'm5'),
    unreadCount: 0,
    isPinned: false,
    isMuted: true,
    isArchived: false,
    createdAt: '2024-01-05T09:00:00Z',
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'c4',
    participants: [currentUser, mockUsers[3]],
    lastMessage: mockMessages.find(m => m.id === 'm6'),
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    isArchived: false,
    createdAt: '2024-01-01T12:00:00Z',
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'c5',
    participants: [currentUser, mockUsers[4]],
    lastMessage: mockMessages.find(m => m.id === 'm7'),
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    isArchived: false,
    createdAt: '2023-12-20T16:00:00Z',
    updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

export const getMessagesForConversation = (conversationId: string): Message[] => {
  return mockMessages.filter(m => m.conversationId === conversationId);
};

export const getOtherParticipant = (conversation: Conversation, currentUserId: string) => {
  return conversation.participants.find(p => p.id !== currentUserId);
};
