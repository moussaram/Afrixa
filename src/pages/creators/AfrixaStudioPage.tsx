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
  const [revenue, setRevenue] = useState<Array<{ type: string; status: string; total: number; entries: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        // Recalcule les compteurs du jour à partir des vraies videos et abonnes.
        const refresh = await (supabase as any).rpc('refresh_my_creator_analytics');
        if (refresh.error) {
          console.warn('Unable to refresh creator analytics', refresh.error);
        }
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const toDate = (date: Date) => date.toISOString().slice(0, 10);
        const [profileResult, videoResult, revenueResult] = await Promise.all([
          (supabase as any).from('profile_analytics').select('*').eq('user_id', user.id).order('recorded_date', { ascending: false }).limit(90),
          (supabase as any).from('video_analytics').select('*').eq('user_id', user.id).order('recorded_date', { ascending: false }).limit(50),
          (supabase as any).rpc('get_my_revenue', { p_from: toDate(monthStart), p_to: toDate(now) }),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (videoResult.error) throw videoResult.error;
        if (revenueResult.error) throw revenueResult.error;
        setProfileAnalytics(profileResult.data || []);
        setVideoAnalytics(videoResult.data || []);
        setRevenue((revenueResult.data || []).map((row: any) => ({
          type: row.type,
          status: row.status,
          total: Number(row.total) || 0,
          entries: Number(row.entries) || 0,
        })));
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger Afrixa Studio.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const latest = profileAnalytics[0] || {};
  // Revenus du mois en cours uniquement, tels que calcules par le serveur.
  const monthlyRevenue = revenue
    .filter((row) => row.status === 'confirmed')
    .reduce((sum, row) => sum + row.total, 0);
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
      revenue
        .filter((row) => row.status === 'confirmed')
        .reduce((acc, row) => ({ ...acc, [row.type]: (acc[row.type] || 0) + row.total }), {} as Record<string, number>)
    ).map(([type, amount]) => ({ type: labels[type] || type, amount: Number(amount) }));
  }, [revenue]);
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
          <StatsCards totalViews={latest.total_views || 0} followers={latest.followers_count || 0} totalLikes={latest.total_likes || 0} monthlyRevenue={monthlyRevenue} />
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
