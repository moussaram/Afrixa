import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StoryViewer } from './StoryViewer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';

type StoryRow = {
  id: string;
  user_id: string | null;
  type: string;
  media_url: string | null;
  text_content: string | null;
  background_color: string | null;
  duration: number | null;
  created_at: string | null;
};
type StoryProfile = { user_id: string; username: string | null; avatar_url: string | null; prenom: string | null; nom: string | null };
type StoryGroup = { userId: string; username: string; avatar: string | null; stories: StoryRow[] };

const colors = ['#7C3AED', '#0F766E', '#B45309', '#BE123C', '#1D4ED8'];

export const StoriesRail = () => {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyColor, setStoryColor] = useState(colors[0]);
  const [storyDuration, setStoryDuration] = useState('5');
  const [creating, setCreating] = useState(false);

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const { data: storyRows, error: storyError } = await supabase
        .from('stories')
        .select('id,user_id,type,media_url,text_content,background_color,duration,created_at')
        .eq('moderation_status', 'approved')
        .eq('is_archived', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (storyError) throw storyError;
      const rows = ((storyRows || []) as StoryRow[]).filter(row => row.user_id);
      const ids = Array.from(new Set(rows.map(row => row.user_id as string)));
      const { data: profileRows, error: profileError } = ids.length
        ? await supabase.from('profiles').select('user_id,username,avatar_url,prenom,nom').in('user_id', ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profileMap = new Map(((profileRows || []) as StoryProfile[]).map(item => [item.user_id, item]));
      const grouped = new Map<string, StoryGroup>();
      for (const row of rows) {
        const id = row.user_id as string;
        const owner = profileMap.get(id);
        if (!grouped.has(id)) {
          grouped.set(id, {
            userId: id,
            username: owner?.username || [owner?.prenom, owner?.nom].filter(Boolean).join(' ') || 'Utilisateur',
            avatar: owner?.avatar_url || null,
            stories: [],
          });
        }
        grouped.get(id)!.stories.push(row);
      }
      setGroups(Array.from(grouped.values()));
    } catch (error) {
      console.error('Stories load failed', error);
      toast.error('Impossible de charger les stories.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStories(); }, [loadStories]);

  const currentUserGroup = useMemo(() => groups.find(group => group.userId === userId), [groups, userId]);
  const otherGroups = useMemo(() => groups.filter(group => group.userId !== userId), [groups, userId]);
  const viewerStories = useMemo(() => groups.find(group => group.userId === viewerUserId)?.stories.map(story => ({
    id: story.id,
    media_url: story.media_url || undefined,
    text_content: story.text_content || undefined,
    background_color: story.background_color || undefined,
    duration: story.duration || undefined,
  })) || [], [groups, viewerUserId]);

  const recordStoryView = useCallback(async (storyId: string) => {
    if (!userId) return;
    const { error } = await supabase.from('story_views').insert({ story_id: storyId, viewer_id: userId });
    if (error && error.code !== '23505') console.warn('Story view could not be recorded', error);
  }, [userId]);

  const createTextStory = async () => {
    if (!userId || storyText.trim().length < 1 || storyText.trim().length > 400) {
      toast.error('Votre story doit contenir entre 1 et 400 caractères.');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('stories').insert({
        user_id: userId,
        type: 'text',
        text_content: storyText.trim(),
        background_color: storyColor,
        duration: Number(storyDuration),
      });
      if (error) throw error;
      toast.success('Story envoyée en modération. Elle sera visible après validation.');
      setStoryText('');
      setComposerOpen(false);
      await loadStories();
    } catch (error) {
      console.error('Story creation failed', error);
      toast.error('Impossible de créer cette story.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed left-0 right-0 top-14 z-40 flex gap-3 overflow-x-auto border-b border-border/20 bg-background/80 px-4 py-3 backdrop-blur">
        <button onClick={() => setComposerOpen(true)} disabled={!userId} className="flex w-16 shrink-0 flex-col items-center gap-1 disabled:opacity-50">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-primary bg-primary/10">
            {profile?.avatar_url ? <Avatar className="h-12 w-12"><AvatarImage src={profile.avatar_url} /><AvatarFallback>+</AvatarFallback></Avatar> : <Plus className="h-5 w-5 text-primary" />}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-3 w-3" /></span>
          </span>
          <span className="w-full truncate text-[10px]">Ma story</span>
        </button>
        {currentUserGroup && <button onClick={() => setViewerUserId(currentUserGroup.userId)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5"><Avatar className="h-14 w-14 border-2 border-background"><AvatarImage src={currentUserGroup.avatar || undefined} /><AvatarFallback>{currentUserGroup.username[0]?.toUpperCase()}</AvatarFallback></Avatar></span>
          <span className="w-full truncate text-[10px]">Votre story</span>
        </button>}
        {otherGroups.map(group => <button key={group.userId} onClick={() => setViewerUserId(group.userId)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5"><Avatar className="h-14 w-14 border-2 border-background"><AvatarImage src={group.avatar || undefined} /><AvatarFallback>{group.username[0]?.toUpperCase()}</AvatarFallback></Avatar></span>
          <span className="w-full truncate text-[10px]">{group.username}</span>
        </button>)}
        {loading && <div className="flex w-16 shrink-0 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!loading && groups.length === 0 && <p className="self-center text-xs text-muted-foreground">Aucune story récente.</p>}
      </div>

      {viewerUserId && viewerStories.length > 0 && (
        <StoryViewer stories={viewerStories} onClose={() => setViewerUserId(null)} onView={recordStoryView} />
      )}

      {composerOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setComposerOpen(false)}>
          <div className="w-full max-w-lg rounded-t-3xl border-t border-border/30 bg-background p-5 space-y-4" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">Créer une story texte</h2><button onClick={() => setComposerOpen(false)} className="text-sm text-muted-foreground">Fermer</button></div>
            <textarea value={storyText} onChange={event => setStoryText(event.target.value)} maxLength={400} rows={4} placeholder="Que souhaitez-vous partager ?" className="w-full rounded-2xl border border-border/30 bg-card/40 p-3 text-sm text-foreground" />
            <div className="flex items-center gap-3">
              {colors.map(color => <button key={color} onClick={() => setStoryColor(color)} aria-label={`Fond ${color}`} className={`h-8 w-8 rounded-full border-2 ${storyColor === color ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: color }} />)}
              <select value={storyDuration} onChange={event => setStoryDuration(event.target.value)} className="ml-auto rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs text-foreground">
                <option value="5">5 secondes</option><option value="10">10 secondes</option><option value="15">15 secondes</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Les stories expirent après 24 heures et sont publiées après validation de la modération.</p>
            <button onClick={() => void createTextStory()} disabled={creating || !storyText.trim()} className="w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{creating ? 'Envoi…' : 'Soumettre la story'}</button>
          </div>
        </div>
      )}
    </>
  );
};
