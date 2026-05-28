/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/hooks/use-toast';
import { StatsCards } from '@/components/studio/StatsCards';
import { GrowthChart } from '@/components/studio/GrowthChart';
import { VideoTable } from '@/components/studio/VideoTable';
import { AudienceMap } from '@/components/studio/AudienceMap';
import { EarningsChart } from '@/components/studio/EarningsChart';
import { CreatorPageShell } from './CreatorPageShell';

const AfrixaStudioPage = () => {
  const { user } = useAuth();
  const [profileAnalytics, setProfileAnalytics] = useState<any[]>([]);
  const [videoAnalytics, setVideoAnalytics] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const [profileResult, videoResult, earningsResult] = await Promise.all([
          (supabase as any).from('profile_analytics').select('*').eq('user_id', user.id).order('recorded_date', { ascending: false }).limit(90),
          (supabase as any).from('video_analytics').select('*').eq('user_id', user.id).order('recorded_date', { ascending: false }).limit(50),
          (supabase as any).from('creator_earnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (videoResult.error) throw videoResult.error;
        if (earningsResult.error) throw earningsResult.error;
        setProfileAnalytics(profileResult.data || []);
        setVideoAnalytics(videoResult.data || []);
        setEarnings(earningsResult.data || []);
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger Afrixa Studio.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const latest = profileAnalytics[0] || {};
  const monthlyRevenue = earnings.reduce((sum, row) => sum + (row.amount || 0), 0);
  const growthData = [...profileAnalytics].reverse().map((row) => ({
    date: new Date(row.recorded_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    followers: row.followers_count || 0,
    views: row.total_views || 0,
  }));
  const revenueData = useMemo(() => {
    const labels: Record<string, string> = {
      views_bonus: 'Vues',
      gift_received: 'Cadeaux',
      tip_received: 'Tips',
      subscription_revenue: 'Abonnements',
    };
    return Object.entries(
      earnings.reduce((acc, row) => ({ ...acc, [row.type]: (acc[row.type] || 0) + (row.amount || 0) }), {} as Record<string, number>)
    ).map(([type, amount]) => ({ type: labels[type] || type, amount: Number(amount) }));
  }, [earnings]);
  const audienceCountries = videoAnalytics[0]?.audience_countries || {};

  return (
    <CreatorPageShell
      title="Afrixa Studio"
      subtitle="Statistiques, audience et revenus créateur"
      action={<Button asChild className="bg-[#7C3AED]"><Link to="/creators/wallet">Portefeuille</Link></Button>}
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl bg-[#2D2D4E]" />
          <Skeleton className="h-72 rounded-2xl bg-[#2D2D4E]" />
        </div>
      ) : (
        <>
          <StatsCards totalViews={latest.total_views} followers={latest.followers_count} totalLikes={latest.total_likes} monthlyRevenue={monthlyRevenue} />
          <div className="grid gap-5 lg:grid-cols-2">
            <GrowthChart data={growthData} />
            <EarningsChart data={revenueData.length ? revenueData : [{ type: 'Vues', amount: 0 }, { type: 'Cadeaux', amount: 0 }, { type: 'Tips', amount: 0 }]} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
            <VideoTable videos={videoAnalytics} />
            <AudienceMap countries={audienceCountries} />
          </div>
        </>
      )}
    </CreatorPageShell>
  );
};

export default AfrixaStudioPage;
