import { useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, type Profile } from './auth';
import { removeWebPushTokenRecord } from '@/lib/firebase/messaging';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,nom,prenom,deuxieme_prenom,date_naissance,lieu_naissance,profession,numero_mobile,mobile_verifie,email_verifie,avatar_url,bio,username,nationalite,nationalite_flag,inscription_complete')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (error) {
      setProfile(null);
      console.error('Unable to load the authenticated profile', error);
      throw error;
    }
    setProfile(data ? {
      ...(data as Profile),
      mobile_verifie: !!authUser.phone_confirmed_at,
      email_verifie: !!authUser.email_confirmed_at,
    } : null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  useEffect(() => {

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        try {
          if (session?.user) await fetchProfile(session.user);
          else setProfile(null);
        } catch (error) {
          console.error('Profile loading failed after authentication change', error);
        } finally {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user).catch((error: unknown) => {
          console.error('Unable to restore the authenticated profile', error);
        }).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (user) {
      try {
        await removeWebPushTokenRecord(user.id);
      } catch (error) {
        console.error('Failed to remove this account’s push installation before sign-out', error);
      }
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
