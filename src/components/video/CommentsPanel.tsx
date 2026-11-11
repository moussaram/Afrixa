import { useCallback, useRef, useState } from 'react';
import { X, Heart, Send, Trash2, Reply, Pin, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { useAuth } from '@/contexts/useAuth';
import { useRealtimeComments, type RealtimeComment } from '@/hooks/useRealtimeComments';
import { toast } from 'sonner';

interface CommentRowProps {
  comment: RealtimeComment;
  currentUserId?: string;
  canModerate: boolean;
  canInteract: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (comment: RealtimeComment) => void;
  onPin?: (comment: RealtimeComment) => void;
  onReport?: (comment: RealtimeComment) => void;
  isReply?: boolean;
}

const CommentRow = ({
  comment,
  currentUserId,
  canModerate,
  canInteract,
  onLike,
  onDelete,
  onReply,
  onPin,
  onReport,
  isReply,
}: CommentRowProps) => {
  const isOwn = Boolean(currentUserId) && comment.user_id === currentUserId;
  const canDelete = isOwn || canModerate;

  return (
    <div className={cn('flex gap-3', isReply && 'ml-10 border-l-2 border-border/30 pl-3')}>
      <Avatar className={cn('flex-shrink-0', isReply ? 'w-7 h-7' : 'w-9 h-9')}>
        <AvatarImage src={comment.avatar_url ?? undefined} alt={comment.username} />
        <AvatarFallback>{comment.username[0]?.toUpperCase() ?? '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {comment.is_pinned && (
              <Pin className="inline w-3 h-3 mr-1 text-primary" aria-label="Épinglé" />
            )}
            <span className={cn('font-semibold text-foreground mr-2', isReply ? 'text-xs' : 'text-sm')}>
              @{comment.username}
            </span>
            <span className={cn('text-foreground', isReply ? 'text-xs' : 'text-sm')}>{comment.content}</span>
          </div>
          <button
            onClick={() => onLike(comment.id)}
            disabled={!canInteract}
            className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={comment.is_liked ? 'Retirer le like' : 'Liker ce commentaire'}
          >
            <Heart
              className={cn(
                'transition-colors',
                isReply ? 'w-3.5 h-3.5' : 'w-4 h-4',
                comment.is_liked ? 'text-destructive' : 'text-muted-foreground'
              )}
              fill={comment.is_liked ? 'currentColor' : 'none'}
            />
            <span className="text-[10px] text-muted-foreground">{comment.likes_count}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-1">
          <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.created_at)}</span>
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
          {canModerate && !isReply && onPin && (
            <button
              onClick={() => onPin(comment)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pin className="w-3 h-3" />
              {comment.is_pinned ? 'Désépingler' : 'Épingler'}
            </button>
          )}
          {!isOwn && canInteract && onReport && (
            <button
              onClick={() => onReport(comment)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Flag className="w-3 h-3" />
              Signaler
            </button>
          )}
          {canDelete && (
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
  videoOwnerId?: string;
  commentsDisabled?: boolean;
  onClose: () => void;
}

export const CommentsPanel = ({
  videoId,
  commentCount,
  videoOwnerId,
  commentsDisabled = false,
  onClose,
}: CommentsPanelProps) => {
  const { user, profile } = useAuth();
  const currentUserId = user?.id && !user.id.startsWith('mock-') ? user.id : undefined;
  const {
    comments,
    loading,
    loadingMore,
    hasMore,
    error,
    addComment,
    toggleLike,
    deleteComment,
    pinComment,
    reportComment,
    loadMore,
  } = useRealtimeComments(videoId, currentUserId);

  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<RealtimeComment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canModerate = Boolean(currentUserId) && videoOwnerId === currentUserId;
  const canInteract = Boolean(currentUserId) && !commentsDisabled;

  const handleLike = useCallback((commentId: string) => {
    void toggleLike(commentId).catch((likeError: unknown) => {
      console.error('Unable to update comment like', likeError);
      toast.error('Impossible de modifier ce j’aime.');
    });
  }, [toggleLike]);

  const handleDelete = useCallback((commentId: string) => {
    void deleteComment(commentId).catch((deleteError: unknown) => {
      console.error('Unable to delete comment', deleteError);
      toast.error('Impossible de supprimer ce commentaire.');
    });
  }, [deleteComment]);

  const handlePin = useCallback((comment: RealtimeComment) => {
    void pinComment(comment.id, !comment.is_pinned).catch((pinError: unknown) => {
      console.error('Unable to pin comment', pinError);
      toast.error('Impossible de modifier l’épinglage.');
    });
  }, [pinComment]);

  const handleReport = useCallback((comment: RealtimeComment) => {
    if (!window.confirm('Signaler ce commentaire à la modération ?')) return;
    void reportComment(comment.id).then(() => {
      toast.success('Signalement enregistré, merci.');
    }).catch((reportError: unknown) => {
      console.error('Unable to report comment', reportError);
      toast.error('Impossible d’enregistrer le signalement.');
    });
  }, [reportComment]);

  const handleReply = useCallback((comment: RealtimeComment) => {
    setReplyTo(comment);
    setNewComment(`@${comment.username} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSend = useCallback(async () => {
    const text = newComment.trim();
    if (!text || isSending) return;
    if (!currentUserId) {
      toast.error('Connecte-toi pour commenter.');
      return;
    }

    setIsSending(true);
    try {
      await addComment(text, replyTo?.id);
      setNewComment('');
      setReplyTo(null);
    } catch (sendError) {
      console.error('Unable to send comment', sendError);
      const message = sendError instanceof Error ? sendError.message : '';
      toast.error(
        message.includes('desactives')
          ? 'Les commentaires sont désactivés pour cette vidéo.'
          : message.includes('abonnes')
            ? 'Seuls les abonnés du créateur peuvent commenter.'
            : 'Impossible d’envoyer le commentaire.',
      );
    } finally {
      setIsSending(false);
    }
  }, [addComment, currentUserId, isSending, newComment, replyTo?.id]);

  const loadedCount = comments.reduce((total, comment) => total + 1 + comment.replies.length, 0);
  const displayedCount = loadedCount || commentCount;
  const activeUsername = profile?.username || user?.email?.split('@')[0] || 'utilisateur';

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
          {loading && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Chargement des commentaires…</p>
          )}
          {!loading && error && (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              Impossible de charger les commentaires.
            </p>
          )}
          {!loading && !error && comments.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {commentsDisabled ? 'Les commentaires sont désactivés.' : 'Aucun commentaire pour le moment.'}
            </p>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="px-4 space-y-3">
              <CommentRow
                comment={comment}
                currentUserId={currentUserId}
                canModerate={canModerate}
                canInteract={Boolean(currentUserId)}
                onLike={handleLike}
                onDelete={handleDelete}
                onReply={handleReply}
                onPin={handlePin}
                onReport={handleReport}
              />
              {comment.replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  canInteract={Boolean(currentUserId)}
                  onLike={handleLike}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isReply
                />
              ))}
            </div>
          ))}

          {hasMore && (
            <div className="px-4 pt-2">
              <Button
                variant="ghost"
                className="w-full text-sm text-primary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Chargement…' : 'Charger plus de commentaires'}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-border/30 p-3 pb-safe">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-muted-foreground">
                Réponse à <span className="text-primary font-medium">@{replyTo.username}</span>
              </span>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setNewComment('');
                }}
                aria-label="Annuler la réponse"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={activeUsername} />
              <AvatarFallback>{activeUsername[0]?.toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
              <input
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={!canInteract}
                placeholder={
                  commentsDisabled
                    ? 'Commentaires désactivés'
                    : !currentUserId
                      ? 'Connecte-toi pour commenter…'
                      : replyTo
                        ? `Répondre à @${replyTo.username}…`
                        : 'Ajouter un commentaire…'
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                maxLength={500}
              />
              {newComment.trim() && (
                <button
                  onClick={handleSend}
                  disabled={isSending}
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
