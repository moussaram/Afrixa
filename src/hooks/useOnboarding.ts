import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

const STORAGE_KEY = 'afrixa:onboarding';

export interface OnboardingState {
  step_completed: number;
  interests: string[];
  onboarding_done: boolean;
}

const defaultState: OnboardingState = {
  step_completed: 0,
  interests: [],
  onboarding_done: false,
};

export const useOnboarding = () => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [loading, setLoading] = useState(true);

  const storageKey = useMemo(() => `${STORAGE_KEY}:${user?.id ?? 'guest'}`, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setState({ ...defaultState, ...JSON.parse(cached) });
      }

      if (!user?.id || user.id.startsWith('mock-')) {
        setLoading(false);
        return;
      }

      // New migration tables are not present in the generated Supabase types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data } = await client
        .from('user_onboarding')
        .select('step_completed,interests,onboarding_done')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mounted && data) {
        const next = {
          step_completed: data.step_completed ?? 0,
          interests: data.interests ?? [],
          onboarding_done: Boolean(data.onboarding_done),
        };
        setState(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
      }

      if (mounted) setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [storageKey, user?.id]);

  const save = useCallback(
    async (next: Partial<OnboardingState>) => {
      const merged = { ...state, ...next };
      setState(merged);
      localStorage.setItem(storageKey, JSON.stringify(merged));

      if (!user?.id || user.id.startsWith('mock-')) return merged;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      await client.from('user_onboarding').upsert(
        {
          user_id: user.id,
          step_completed: merged.step_completed,
          interests: merged.interests,
          onboarding_done: merged.onboarding_done,
        },
        { onConflict: 'user_id' }
      );

      return merged;
    },
    [state, storageKey, user?.id]
  );

  return { state, loading, save };
};
