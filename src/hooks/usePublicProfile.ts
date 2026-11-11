/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfileStats, type ProfileStats } from '@/hooks/useProfileStats';

const client = supabase as any;

export interface PublicProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  deuxieme_prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
  nationalite: string | null;
  nationalite_flag: string | null;
  profession: string | null;
  is_private: boolean | null;
  is_vendor: boolean | null;
}

export const usePublicProfile = (userId?: string) => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { stats, reload: reloadStats } = useProfileStats(userId);

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: profileError } = await client
      .from('profiles')
      .select(
        'user_id,username,prenom,deuxieme_prenom,nom,avatar_url,bio,nationalite,nationalite_flag,profession,is_private,is_vendor',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Unable to load profile', profileError);
      setError(profileError.message);
      setProfile(null);
      setNotFound(false);
    } else if (!data) {
      setProfile(null);
      setNotFound(true);
      setError(null);
    } else {
      setProfile(data as PublicProfile);
      setNotFound(false);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await Promise.all([load(), reloadStats()]);
  }, [load, reloadStats]);

  return { profile, stats: stats as ProfileStats, loading, error, notFound, reload };
};
