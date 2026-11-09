import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error || !session?.user) {
          console.error('OAuth callback did not produce a valid session', error);
          toast.error('La connexion Google n’a pas abouti. Réessayez.');
          navigate('/auth/login', { replace: true });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('inscription_complete')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!active) return;
        if (profileError) {
          console.error('Unable to check Google account profile completion', profileError);
          toast.error('Connexion réussie, mais impossible de vérifier votre profil.');
          navigate('/auth/complete-profile', { replace: true });
          return;
        }

        if (!profile?.inscription_complete) {
          navigate('/auth/complete-profile', { replace: true });
          return;
        }

        toast.success('Connexion Google réussie !');
        navigate('/', { replace: true });
      } catch (error) {
        console.error('OAuth callback failed', error);
        if (active) {
          toast.error('Impossible de finaliser la connexion Google.');
          navigate('/auth/login', { replace: true });
        }
      }
    };

    void handleCallback();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full gradient-primary mx-auto animate-pulse" />
        <p className="text-muted-foreground">Connexion en cours...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
