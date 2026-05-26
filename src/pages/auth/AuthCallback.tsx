import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        toast.error('Erreur d\'authentification');
        navigate('/auth/login');
        return;
      }

      // Google users go directly to home — they can complete profile in Settings
      navigate('/');
    };

    handleCallback();
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
