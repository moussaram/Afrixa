import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, type Profile } from './auth';
import { removeWebPushTokenRecord } from '@/lib/firebase/messaging';

const PROFILE_COLUMNS = 'id,user_id,nom,prenom,deuxieme_prenom,date_naissance,lieu_naissance,profession,numero_mobile,mobile_verifie,email_verifie,avatar_url,bio,username,nationalite,nationalite_flag,inscription_complete';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authUser: User): Promise<void> => {
    let { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (error) throw error;

    // Auth signup normally creates this row through a database trigger. Recover
    // safely when a trigger was missed, while keeping the profile incomplete.
    if (!data) {
      const created = await supabase.from('profiles')
        .insert({ user_id: authUser.id })
        .select(PROFILE_COLUMNS)
        .single();
      if (created.error?.code === '23505') {
        const retry = await supabase.from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('user_id', authUser.id)
          .single();
        if (retry.error) throw retry.error;
        data = retry.data;
      } else {
        if (created.error) throw created.error;
        data = created.data;
      }
    }

    setProfile({
      ...(data as Profile),
      mobile_verifie: Boolean(authUser.phone_confirmed_at),
      email_verifie: Boolean(authUser.email_confirmed_at),
    });
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    try {
      await fetchProfile(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger le profil';
      setProfileError(message);
      console.error('Unable to refresh the authenticated profile', error);
      throw error;
    }
  }, [fetchProfile, user]);

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(true);

      if (!nextSession?.user) {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      try {
        await fetchProfile(nextSession.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de charger le profil';
        setProfile(null);
        setProfileError(message);
        console.error('Unable to load the authenticated profile', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer database calls until Supabase releases the auth callback lock.
      queueMicrotask(() => { void applySession(nextSession); });
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return applySession(data.session);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Session indisponible';
        console.error('Unable to restore the authentication session', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileError(message);
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    if (user) {
      try {
        await removeWebPushTokenRecord(user.id);
      } catch (error) {
        console.error('Unable to remove the web push token before sign-out', error);
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, profileError, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
