import { useState, useRef, useCallback } from 'react';
import { X, Heart, Send, Trash2, Reply } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { mockUsers, currentUser } from '@/data/mockData';
import { Comment } from '@/types';

/* ─────────────────── mock data ─────────────────── */
const INITIAL_COMMENTS: Comment[] = [
  {
    id: '1',
    user: mockUsers[0],
    text: 'Cette vidéo est incroyable ! 🔥🔥',
    likes: 234,
    isLiked: false,
    createdAt: '2024-01-15T10:00:00Z',
    replies: [
      {
        id: '1-1',
        user: mockUsers[1],
        text: "Totalement d'accord ! 💯",
        likes: 45,
        isLiked: true,
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
  },
  {
    id: '2',
    user: mockUsers[1],
    text: "J'adore vraiment ce contenu, continue comme ça! 💪",
    likes: 567,
    isLiked: true,
    createdAt: '2024-01-15T09:00:00Z',
  },
  {
    id: '3',
    user: mockUsers[2],
    text: 'Trop drôle 😂😂😂 tu m\'as tué',
    likes: 1234,
    isLiked: false,
    createdAt: '2024-01-14T22:00:00Z',
  },
  {
    id: '4',
    user: mockUsers[3],
    text: 'Comment tu fais ça ? Peux-tu faire un tuto ?',
    likes: 89,
    isLiked: false,
    createdAt: '2024-01-14T20:00:00Z',
  },
  {
    id: '5',
    user: mockUsers[4],
    text: 'On veut plus de ce genre de vidéos ! 🙏',
    likes: 456,
    isLiked: false,
    createdAt: '2024-01-14T18:00:00Z',
  },
];

/* ─────────────────── sub-components ─────────────────── */

interface CommentRowProps {
  comment: Comment;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (comment: Comment) => void;
  isReply?: boolean;
}

const CommentRow = ({ comment, onLike, onDelete, onReply, isReply }: CommentRowProps) => {
  const isOwn = comment.user.id === currentUser.id;

  return (
    <div className={cn('flex gap-3', isReply && 'ml-10 border-l-2 border-border/30 pl-3')}>
      <Avatar className={cn('flex-shrink-0', isReply ? 'w-7 h-7' : 'w-9 h-9')}>
        <AvatarImage src={comment.user.avatar} alt={comment.user.username} />
        <AvatarFallback>{comment.user.username[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <span className={cn('font-semibold text-foreground mr-2', isReply ? 'text-xs' : 'text-sm')}>
              @{comment.user.username}
            </span>
            <span className={cn('text-foreground', isReply ? 'text-xs' : 'text-sm')}>{comment.text}</span>
          </div>
          {/* Like button */}
          <button
            onClick={() => onLike(comment.id)}
            className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-2"
            aria-label={comment.isLiked ? 'Retirer le like' : 'Liker ce commentaire'}
          >
            <Heart
              className={cn(
                'transition-colors',
                isReply ? 'w-3.5 h-3.5' : 'w-4 h-4',
                comment.isLiked ? 'text-destructive' : 'text-muted-foreground'
              )}
              fill={comment.isLiked ? 'currentColor' : 'none'}
            />
            <span className="text-[10px] text-muted-foreground">{comment.likes}</span>
          </button>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.createdAt)}</span>
          {!isReply && (
            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              <Reply className="w-3 h-3" />
              Répondre
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── main panel ─────────────────── */

interface CommentsPanelProps {
  videoId: string;
  commentCount: number;
  onClose: () => void;
}

export const CommentsPanel = ({ videoId: _videoId, commentCount, onClose }: CommentsPanelProps) => {
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── like a comment or a reply ── */
  const handleLikeComment = useCallback((commentId: string) => {
    setComments(prev =>
      prev.map(c => {
        if (c.id === commentId) {
          return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
        }
        // check replies
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r =>
              r.id === commentId
                ? { ...r, isLiked: !r.isLiked, likes: r.isLiked ? r.likes - 1 : r.likes + 1 }
                : r
            ),
          };
        }
        return c;
      })
    );
  }, []);

  /* ── delete own comment or reply ── */
  const handleDelete = useCallback((commentId: string) => {
    setComments(prev =>
      prev
        .filter(c => c.id !== commentId)
        .map(c => ({
          ...c,
          replies: c.replies?.filter(r => r.id !== commentId),
        }))
    );
  }, []);

  /* ── reply setup ── */
  const handleReply = useCallback((comment: Comment) => {
    setReplyTo(comment);
    setNewComment(`@${comment.user.username} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  /* ── send comment / reply (optimistic) ── */
  const handleSend = useCallback(() => {
    const text = newComment.trim();
    if (!text || isSending) return;

    setIsSending(true);

    if (replyTo) {
      // Optimistic: add reply to parent
      const reply: Comment = {
        id: `reply-${Date.now()}`,
        user: currentUser,
        text,
        likes: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
      };
      setComments(prev =>
        prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies ?? []), reply] }
            : c
        )
      );
    } else {
      // Optimistic: prepend new top-level comment
      const comment: Comment = {
        id: `new-${Date.now()}`,
        user: currentUser,
        text,
        likes: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
      };
      setComments(prev => [comment, ...prev]);
    }

    setNewComment('');
    setReplyTo(null);

    // Simulate API latency — in production replace with real fetch
    setTimeout(() => setIsSending(false), 400);
  }, [newComment, replyTo, isSending]);

  const totalComments = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ?? 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-card rounded-t-3xl flex flex-col max-h-[75vh] z-10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="font-semibold text-foreground">
            {totalComments.toLocaleString()} commentaire{totalComments !== 1 ? 's' : ''}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="px-4 space-y-3">
              <CommentRow
                comment={comment}
                onLike={handleLikeComment}
                onDelete={handleDelete}
                onReply={handleReply}
              />
              {/* Threaded replies */}
              {comment.replies?.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  onLike={handleLikeComment}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isReply
                />
              ))}
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t border-border/30 p-3 pb-safe">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-muted-foreground">
                Réponse à{' '}
                <span className="text-primary font-medium">@{replyTo.user.username}</span>
              </span>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setNewComment('');
                }}
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={currentUser.avatar} alt={currentUser.username} />
              <AvatarFallback>{currentUser.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
              <input
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? `Répondre à @${replyTo.user.username}…` : 'Ajouter un commentaire…'}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                maxLength={300}
              />
              {newComment.trim() && (
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className={cn(
                    'transition-opacity',
                    isSending && 'opacity-50'
                  )}
                >
                  <Send className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
