import type { Video } from '@/types';

export interface VideoRow {
  id: string;
  user_id: string;
  hls_url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  title: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  created_at: string;
}

export interface VideoAuthorProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

export const EMPTY_AUTHOR_PROFILE: VideoAuthorProfile = {
  user_id: '',
  username: null,
  prenom: null,
  nom: null,
  avatar_url: null,
};

/** Convertit une ligne `videos` (+ profil de l'auteur) en objet Video de l'UI. */
export const mapVideoRow = (
  row: VideoRow,
  profile: VideoAuthorProfile = EMPTY_AUTHOR_PROFILE,
  flags: { isLiked?: boolean; isSaved?: boolean } = {},
): Video => {
  const username = profile.username || 'utilisateur';
  return {
    id: row.id,
    user: {
      id: row.user_id,
      username,
      displayName: [profile.prenom, profile.nom].filter(Boolean).join(' ') || username,
      avatar: profile.avatar_url ?? '',
      followers: 0,
      following: 0,
      likes: 0,
      isFollowing: false,
      isVerified: false,
    },
    videoUrl: row.hls_url ?? '',
    thumbnailUrl: row.thumbnail_url ?? '',
    description: row.description ?? row.title ?? '',
    hashtags: [],
    music: { title: 'Son original', artist: username, coverUrl: '' },
    likes: row.likes_count,
    comments: row.comments_count,
    shares: row.shares_count,
    saves: row.saves_count,
    views: row.views_count,
    isLiked: flags.isLiked,
    isSaved: flags.isSaved,
    createdAt: row.created_at,
  };
};
