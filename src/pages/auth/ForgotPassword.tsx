import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!value.trim()) { toast.error('Remplissez le champ'); return; }
    setLoading(true);
    try {
      if (method === 'phone') {
        const phone = value.startsWith('+') ? value : `+${value.replace(/\D/g, '')}`;
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) { toast.error('Erreur d\'envoi'); return; }
        navigate('/auth/verify-otp', { state: { phone, mode: 'forgot' } });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(value, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) { toast.error('Erreur d\'envoi email'); return; }
        toast.success('Email de récupération envoyé !');
        navigate('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col px-6 pt-8 gap-8">
        <div>
          <h2 className="text-2xl font-black text-foreground">Mot de passe oublié</h2>
          <p className="text-muted-foreground mt-1 text-sm">Choisissez une méthode de récupération</p>
        </div>

        {/* Method selector */}
        <div className="flex gap-3">
          {(['phone', 'email'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMethod(m); setValue(''); }}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all',
                method === m ? 'border-primary bg-primary/10' : 'border-border/30 bg-muted/20'
              )}
            >
              {m === 'phone' ? <Phone className={cn('w-6 h-6', method === m ? 'text-primary' : 'text-muted-foreground')} />
                : <Mail className={cn('w-6 h-6', method === m ? 'text-primary' : 'text-muted-foreground')} />}
              <span className={cn('text-sm font-semibold', method === m ? 'text-primary' : 'text-muted-foreground')}>
                {m === 'phone' ? 'Par SMS' : 'Par Email'}
              </span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            {method === 'phone' ? 'Numéro mobile' : 'Adresse email'}
          </label>
          <Input
            type={method === 'email' ? 'email' : 'tel'}
            placeholder={method === 'phone' ? '+225 07 00 00 00 00' : 'vous@exemple.com'}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-13 rounded-2xl bg-muted/30 border-border/30 text-base"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {method === 'phone'
              ? 'Un code OTP sera envoyé par SMS pour réinitialiser votre mot de passe'
              : 'Un lien de réinitialisation sera envoyé à votre adresse email'}
          </p>
        </div>

        <Button
          variant="gradient"
          className="w-full h-14 text-base font-bold rounded-2xl"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? 'Envoi...' : `Envoyer ${method === 'phone' ? 'le code SMS' : "l'email"}`}
        </Button>

        <Link to="/auth/login" className="text-center text-sm text-primary underline">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
