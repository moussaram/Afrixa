
-- Table profiles enrichie pour Afrixa
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT,
  prenom TEXT,
  deuxieme_prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  profession TEXT,
  numero_mobile TEXT,
  mobile_verifie BOOLEAN NOT NULL DEFAULT false,
  email_verifie BOOLEAN NOT NULL DEFAULT false,
  google_id TEXT,
  avatar_url TEXT,
  bio TEXT,
  username TEXT UNIQUE,
  nationalite TEXT,
  nationalite_flag TEXT,
  inscription_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_numero_mobile ON public.profiles(numero_mobile);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profils publics accessibles a tous" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Utilisateur peut creer son profil" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut modifier son profil" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email_verifie)
  VALUES (
    NEW.id,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
