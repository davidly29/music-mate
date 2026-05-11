export interface User {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl: string;
  addedBy: string;
  addedById: string;
  addedAt: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  text: string;
  userName?: string;
  userId?: string;
  userColor?: string;
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  hostId: string;
  users: User[];
  queue: QueueItem[];
  chat: ChatMessage[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  createdAt: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentIndex: number;
  currentItem: QueueItem | null;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface YouTubeOEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export type SidebarTab = 'queue' | 'chat' | 'members';
