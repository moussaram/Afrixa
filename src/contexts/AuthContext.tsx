import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, type Profile } from './auth';

const PROFILE_COLUMNS = [
  'id',
  'user_id',
  'nom',
  'prenom',
  'deuxieme_prenom',
  'date_naissance',
  'lieu_naissance',
  'profession',
  'numero_mobile',
  'mobile_verifie',
  'email_verifie',
  'avatar_url',
  'bio',
  'username',
  'nationalite',
  'nationalite_flag',
  'inscription_complete',
].join(',');

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestId = useRef(0);
  const authEventVersion = useRef(0);

  const fetchProfile = useCallback(async (authUser: User) => {
    const requestId = ++profileRequestId.current;
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (requestId !== profileRequestId.current) return;

      if (error) {
        setProfile(null);
        setProfileError('Impossible de récupérer ton profil. Vérifie ta connexion puis réessaie.');
        console.error('Profile fetch failed', { userId: authUser.id, error });
        return;
      }

      if (!data) {
        setProfile(null);
        setProfileError('Ton compte est connecté, mais ton profil Afrixa est introuvable. La finalisation du profil est nécessaire.');
        return;
      }

      setProfile({
        ...(data as unknown as Profile),
        mobile_verifie: !!authUser.phone_confirmed_at,
        email_verifie: !!authUser.email_confirmed_at,
      });
    } catch (error) {
      if (requestId !== profileRequestId.current) return;
      setProfile(null);
      setProfileError('Une erreur inattendue a empêché le chargement du profil.');
      console.error('Unexpected profile fetch failure', { userId: authUser.id, error });
    } finally {
      if (requestId === profileRequestId.current) setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    setLoading(true);
    await fetchProfile(user);
  }, [fetchProfile, user]);

  useEffect(() => {
    let active = true;

    const applySession = (nextSession: Session | null) => {
      profileRequestId.current += 1;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setProfile(null);
      setProfileError(null);

      if (nextSession?.user) {
        setLoading(true);
        void fetchProfile(nextSession.user);
      } else {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventVersion.current += 1;
      applySession(nextSession);
    });

    const initialEventVersion = authEventVersion.current;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventVersion.current !== initialEventVersion) return;

      if (error) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileError('Impossible de restaurer la session. Reconnecte-toi.');
        setLoading(false);
        console.error('Session restoration failed', error);
        return;
      }

      applySession(data.session);
    }).catch((error: unknown) => {
      if (!active || authEventVersion.current !== initialEventVersion) return;
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileError('Impossible de restaurer la session. Reconnecte-toi.');
      setLoading(false);
      console.error('Session restoration failed', error);
    });

    return () => {
      active = false;
      profileRequestId.current += 1;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (user) {
      const { error: tokenError } = await (supabase as any)
        .from('user_fcm_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'web_fid');

      if (tokenError) {
        // Token cleanup is best-effort; it must not prevent signing out.
        console.error('Failed to remove this account push installation before sign-out', tokenError);
      }
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, profileError, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
