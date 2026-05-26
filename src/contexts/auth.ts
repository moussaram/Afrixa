import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export interface Profile {
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

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});
