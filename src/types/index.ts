export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  followers: number;
  following: number;
  likes: number;
  isFollowing?: boolean;
  isVerified?: boolean;
}

export interface Video {
  id: string;
  user: User;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  hashtags: string[];
  music: {
    title: string;
    artist: string;
    coverUrl: string;
  };
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  likes: number;
  isLiked?: boolean;
  replies?: Comment[];
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  user: User;
  video?: Video;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
