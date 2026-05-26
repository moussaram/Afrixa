import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Vérifier si on est en mode recovery (lien email)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
    // Écouter l'event PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (password.length < 8) { toast.error('Minimum 8 caractères'); return; }
    if (password !== confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error('Erreur de mise à jour'); return; }
      toast.success('Mot de passe mis à jour avec succès !');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-4 pt-12 pb-4">
        <button onClick={() => navigate('/auth/login')}
          className="w-10 h-10 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 pt-8 gap-8">
        <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-lg">
          <Lock className="w-9 h-9 text-primary-foreground" />
        </div>

        <div className="text-center w-full">
          <h2 className="text-2xl font-black text-foreground">Nouveau mot de passe</h2>
          <p className="text-muted-foreground mt-1 text-sm">Créez un mot de passe sécurisé</p>
        </div>

        <div className="w-full space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nouveau mot de passe</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-13 rounded-2xl bg-muted/30 border-border/30 pr-12"
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-1.5 flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-all',
                    password.length >= i * 3 ? (
                      password.length >= 12 ? 'bg-primary' :
                      password.length >= 8 ? 'bg-primary/60' : 'bg-destructive'
                    ) : 'bg-muted'
                  )} />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Confirmer le mot de passe</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="h-13 rounded-2xl bg-muted/30 border-border/30"
            />
            {confirm && (
              <p className={cn('text-xs mt-1', password === confirm ? 'text-primary' : 'text-destructive')}>
                {password === confirm ? '✓ Correspond' : '✗ Ne correspond pas'}
              </p>
            )}
          </div>

          <Button
            variant="gradient"
            className="w-full h-14 text-base font-bold rounded-2xl"
            onClick={handleReset}
            disabled={loading || !isRecovery}
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </Button>

          {!isRecovery && (
            <p className="text-center text-xs text-muted-foreground">
              Accédez à cette page via le lien de récupération envoyé par email ou SMS.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
