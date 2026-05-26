import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  nom: string | null;
  prenom: string | null;
  deuxieme_prenom: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  profession: string | null;
  numero_mobile: string | null;
  mobile_verifie: boolean;
  email_verifie: boolean;
  avatar_url: string | null;
  bio: string | null;
  username: string | null;
  nationalite: string | null;
  nationalite_flag: string | null;
  inscription_complete: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const DEV_MODE = import.meta.env.DEV;

const mockUser = {
  id: 'mock-dev-user-001',
  email: 'moncompte@afrixa.dev',
  app_metadata: {},
  user_metadata: { full_name: 'Mon Compte' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;

const mockSession = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  user: mockUser,
  expires_in: 999999,
  token_type: 'bearer',
} as unknown as Session;

const mockProfile: Profile = {
  id: 'mock-profile-001',
  user_id: 'mock-dev-user-001',
  nom: 'Compte',
  prenom: 'Mon',
  deuxieme_prenom: null,
  date_naissance: '1995-06-15',
  lieu_naissance: 'Abidjan',
  profession: 'Créateur de contenu',
  numero_mobile: '+225 07 00 00 00',
  mobile_verifie: true,
  email_verifie: true,
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  bio: '✨ Bienvenue sur mon profil | Créateur de contenu',
  username: '@moncompte',
  nationalite: 'Ivoirienne',
  nationalite_flag: '🇨🇮',
  inscription_complete: true,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(DEV_MODE ? mockUser : null);
  const [session, setSession] = useState<Session | null>(DEV_MODE ? mockSession : null);
  const [profile, setProfile] = useState<Profile | null>(DEV_MODE ? mockProfile : null);
  const [loading, setLoading] = useState(DEV_MODE ? false : true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setProfile(data as Profile | null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (DEV_MODE) return; // Skip auth listeners in dev mode

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
