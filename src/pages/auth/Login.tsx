import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Phone, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import splashScreen from '@/assets/splash-screen.jpg';

const Login = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPhone = /^[+\d]/.test(identifier) && identifier.replace(/\D/g, '').length >= 8;
  const isEmail = identifier.includes('@');

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      toast.error('Remplissez tous les champs');
      return;
    }
    setLoading(true);
    try {
      let error;
      if (isPhone) {
        // Normaliser le numéro
        const phone = identifier.startsWith('+') ? identifier : `+${identifier.replace(/\D/g, '')}`;
        const res = await supabase.auth.signInWithPassword({ phone, password });
        error = res.error;
      } else {
        const res = await supabase.auth.signInWithPassword({ email: identifier, password });
        error = res.error;
      }
      if (error) {
        toast.error('Identifiants incorrects');
      } else {
        toast.success('Connexion réussie !');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) toast.error('Erreur Google Sign-In');
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-end pb-0 overflow-hidden">
      <img loading="lazy" src={splashScreen} alt="Afrixa" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />

      <div className="relative z-10 w-full max-w-sm px-6 pb-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-foreground tracking-tight">Afrixa</h1>
          <p className="text-muted-foreground text-sm mt-1">African Social Network</p>
        </div>

        <div className="space-y-4">
          {/* Identifier */}
          <div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {isPhone ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              </div>
              <Input
                placeholder="Numéro mobile ou email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="h-13 pl-10 rounded-2xl bg-muted/30 border-border/40 text-base"
                autoComplete="username"
              />
            </div>
            {identifier && (
              <p className="text-xs text-muted-foreground mt-1 ml-1">
                {isPhone ? '📱 Connexion par numéro mobile' : isEmail ? '📧 Connexion par email' : ''}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-13 rounded-2xl bg-muted/30 border-border/40 text-base pr-12"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <Link to="/auth/forgot-password" className="text-sm text-primary underline">
              Mot de passe oublié ?
            </Link>
          </div>

          {/* Login button */}
          <Button
            variant="gradient"
            className="w-full h-13 text-base font-bold rounded-2xl"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Google */}
          <Button
            variant="outline"
            className="w-full h-13 rounded-2xl font-semibold border-border/40 bg-muted/20 gap-3"
            onClick={handleGoogle}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </Button>

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link to="/auth/register" className="text-primary font-semibold underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
