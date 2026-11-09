import { useState, useRef, useCallback, useMemo } from 'react';
import { X, Heart, Send, Trash2, Reply } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { Comment, User as AppUser } from '@/types';
import { useAuth } from '@/contexts/useAuth';
import { useRealtimeComments } from '@/hooks/useRealtimeComments';
import { toast } from 'sonner';

interface CommentRowProps {
  comment: Comment;
  currentUserId: string;
  canInteract: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (comment: Comment) => void;
  isReply?: boolean;
}

const CommentRow = ({ comment, currentUserId, canInteract, onLike, onDelete, onReply, isReply }: CommentRowProps) => {
  const isOwn = comment.user.id === currentUserId;

  return (
    <div className={cn('flex gap-3', isReply && 'ml-10 border-l-2 border-border/30 pl-3')}>
      <Avatar className={cn('flex-shrink-0', isReply ? 'w-7 h-7' : 'w-9 h-9')}>
        <AvatarImage src={comment.user.avatar || undefined} alt={comment.user.username} />
        <AvatarFallback>{comment.user.username[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <span className={cn('font-semibold text-foreground mr-2', isReply ? 'text-xs' : 'text-sm')}>
              @{comment.user.username}
            </span>
            <span className={cn('text-foreground', isReply ? 'text-xs' : 'text-sm')}>{comment.text}</span>
          </div>
          <button
            onClick={() => onLike(comment.id)}
            disabled={!canInteract}
            className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-2 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.createdAt)}</span>
          {!isReply && (
            <button
              onClick={() => onReply(comment)}
              disabled={!canInteract}
              className="flex items-center gap-1 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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

interface CommentsPanelProps {
  videoId: string;
  commentCount: number;
  onClose: () => void;
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const CommentsPanel = ({ videoId, commentCount, onClose }: CommentsPanelProps) => {
  const { user, profile } = useAuth();
  const validVideoId = isUuid(videoId);
  const { comments: rows, loading, error, addComment, toggleLike, deleteComment } =
    useRealtimeComments(videoId, user?.id);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserId = user?.id ?? '';
  const canInteract = Boolean(user?.id && validVideoId);

  const activeUser: AppUser = {
    id: currentUserId,
    username: profile?.username || user?.email?.split('@')[0] || 'utilisateur',
    displayName: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.username || 'Utilisateur',
    avatar: profile?.avatar_url || '',
    followers: 0,
    following: 0,
    likes: 0,
  };

  const comments = useMemo(() => {
    const toComment = (row: typeof rows[number]): Comment => ({
      id: row.id,
      user: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatar: row.avatar_url || '',
        followers: 0,
        following: 0,
        likes: 0,
      },
      text: row.content,
      likes: row.likes_count,
      isLiked: row.is_liked,
      createdAt: row.created_at,
      replies: rows.filter(reply => reply.parent_id === row.id).map(toComment),
    });

    return rows.filter(row => !row.parent_id).map(toComment);
  }, [rows]);

  const handleLikeComment = useCallback((commentId: string) => {
    void toggleLike(commentId).catch((likeError) => {
      console.error('Unable to update comment like', likeError);
      toast.error('Impossible de modifier ce j’aime.');
    });
  }, [toggleLike]);

  const handleDelete = useCallback((commentId: string) => {
    void deleteComment(commentId).catch((deleteError) => {
      console.error('Unable to delete comment', deleteError);
      toast.error('Impossible de supprimer ce commentaire.');
    });
  }, [deleteComment]);

  const handleReply = useCallback((comment: Comment) => {
    setReplyTo(comment);
    setNewComment(`@${comment.user.username} `);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSend = useCallback(async () => {
    const text = newComment.trim();
    if (!text || isSending) return;

    if (!user?.id) {
      toast.error('Connecte-toi pour commenter.');
      return;
    }
    if (!validVideoId) {
      toast.error('Cette vidéo ne possède pas encore un identifiant valide pour les commentaires.');
      return;
    }

    setIsSending(true);
    try {
      await addComment(text, replyTo?.id);
      setNewComment('');
      setReplyTo(null);
    } catch (sendError) {
      console.error('Unable to send comment', sendError);
      toast.error('Impossible d’envoyer le commentaire.');
    } finally {
      setIsSending(false);
    }
  }, [addComment, isSending, newComment, replyTo, user?.id, validVideoId]);

  const totalComments = comments.reduce((total, comment) => total + 1 + (comment.replies?.length ?? 0), 0);
  const displayedCount = totalComments || commentCount;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-card rounded-t-3xl flex flex-col max-h-[75vh] z-10">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="font-semibold text-foreground">
            {displayedCount.toLocaleString()} commentaire{displayedCount !== 1 ? 's' : ''}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {loading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Chargement des commentaires…</p>}
          {error && <p className="px-4 py-8 text-center text-sm text-destructive">Impossible de charger les commentaires.</p>}
          {!loading && !error && comments.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="px-4 space-y-3">
              <CommentRow
                comment={comment}
                currentUserId={currentUserId}
                canInteract={canInteract}
                onLike={handleLikeComment}
                onDelete={handleDelete}
                onReply={handleReply}
              />
              {comment.replies?.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  canInteract={canInteract}
                  onLike={handleLikeComment}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isReply
                />
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 p-3 pb-safe">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-muted-foreground">
                Réponse à <span className="text-primary font-medium">@{replyTo.user.username}</span>
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
              <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.username} />
              <AvatarFallback>{activeUser.username[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
              <input
                ref={inputRef}
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                disabled={!canInteract || Boolean(error)}
                placeholder={!user ? 'Connecte-toi pour commenter…' : !validVideoId ? 'Commentaires indisponibles pour cette vidéo…' : replyTo ? `Répondre à @${replyTo.user.username}…` : 'Ajouter un commentaire…'}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                onKeyDown={(event) => event.key === 'Enter' && void handleSend()}
                maxLength={300}
              />
              {newComment.trim() && (
                <button
                  onClick={() => void handleSend()}
                  disabled={isSending || !canInteract}
                  className={cn('transition-opacity', isSending && 'opacity-50')}
                  aria-label="Envoyer le commentaire"
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
