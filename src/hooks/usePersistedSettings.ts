import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

export type BooleanSettings = Record<string, boolean>;

const toBooleanSettings = (value: Json | null): BooleanSettings | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, entry]) => typeof entry !== 'boolean')) return null;
  return Object.fromEntries(entries) as BooleanSettings;
};

export const usePersistedSettings = (
  userId: string | undefined,
  settings: BooleanSettings,
  applySettings: (next: BooleanSettings) => void,
) => {
  const [hydrated, setHydrated] = useState(!userId);
  const savedSettingsRef = useRef<BooleanSettings | null>(null);
  const applySettingsRef = useRef(applySettings);
  const latestSettingsRef = useRef(settings);
  latestSettingsRef.current = settings;
  const revisionRef = useRef(0);
  const writeQueueRef = useRef(Promise.resolve());
  const serialized = JSON.stringify(settings);

  useEffect(() => {
    applySettingsRef.current = applySettings;
  }, [applySettings]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      savedSettingsRef.current = null;
      setHydrated(true);
      return () => { active = false; };
    }

    setHydrated(false);
    void supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Could not load user settings', error);
          savedSettingsRef.current = latestSettingsRef.current;
        } else if (data) {
          const stored = toBooleanSettings(data.settings);
          if (stored) {
            savedSettingsRef.current = stored;
            applySettingsRef.current(stored);
          }
        } else {
          savedSettingsRef.current = latestSettingsRef.current;
        }
        setHydrated(true);
      }).catch((error: unknown) => {
        if (!active) return;
        console.error('Could not load user settings', error);
        savedSettingsRef.current = latestSettingsRef.current;
        setHydrated(true);
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('afrixa:user-settings:v1', serialized);
    if (!userId || !hydrated) return;

    const revision = ++revisionRef.current;
    const timeout = window.setTimeout(() => {
      writeQueueRef.current = writeQueueRef.current.catch(() => undefined).then(async () => {
        const { error } = await supabase.from('user_settings').upsert({
          user_id: userId,
          settings: settings as Json,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Could not save user settings', error);
          toast.error('Paramètres non sauvegardés. Les valeurs précédentes sont restaurées.');
          if (revision === revisionRef.current && savedSettingsRef.current) {
            applySettingsRef.current(savedSettingsRef.current);
          }
          return;
        }
        savedSettingsRef.current = settings;
        toast.success('Paramètres sauvegardés');
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [hydrated, serialized, userId]);
};
