import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EXPIRY = 300; // 5 minutes

interface RegisterOtpFormData {
  nom?: string;
  prenom?: string;
  deuxieme_prenom?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  profession?: string;
  nationalite?: {
    name?: string;
    flag?: string;
  } | null;
}

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    phone: string;
    formData?: RegisterOtpFormData;
    mode: 'register' | 'login' | 'forgot';
  };

  const phone = state?.phone || '';
  const formData = state?.formData;
  const mode = state?.mode || 'login';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(EXPIRY);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) navigate('/auth/login');
  }, [phone, navigate]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '') && value) {
      verifyCode(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    text.split('').forEach((d, i) => { if (i < 6) newOtp[i] = d; });
    setOtp(newOtp);
    if (newOtp.every(d => d !== '')) verifyCode(newOtp.join(''));
    else inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const verifyCode = async (code: string) => {
    if (timer === 0) { toast.error('Le code a expiré, renvoyez-en un nouveau'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        toast.error('Code incorrect ou expiré');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Si inscription : mettre à jour le profil
      if (mode === 'register' && formData && data.user) {
        const username = `${formData.prenom?.toLowerCase().replace(/\s/g, '_')}_${Math.floor(Math.random() * 9999)}`;
        await supabase.from('profiles').update({
          nom: formData.nom,
          prenom: formData.prenom,
          deuxieme_prenom: formData.deuxieme_prenom || null,
          date_naissance: formData.date_naissance || null,
          lieu_naissance: formData.lieu_naissance || null,
          profession: formData.profession || null,
          numero_mobile: phone,
          mobile_verifie: true,
          nationalite: formData.nationalite?.name || null,
          nationalite_flag: formData.nationalite?.flag || null,
          username,
          inscription_complete: true,
        }).eq('user_id', data.user.id);

        toast.success(`Bienvenue sur Afrixa, ${formData.prenom} ! 🎉`);
      } else if (mode === 'forgot') {
        navigate('/auth/reset-password', { state: { phone } });
        return;
      } else {
        toast.success('Connexion réussie !');
      }

      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length < 6) { toast.error('Entrez le code à 6 chiffres'); return; }
    verifyCode(code);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) { toast.error('Erreur de renvoi'); return; }
      setTimer(EXPIRY);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('Nouveau code envoyé !');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 pt-8 gap-8">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-lg">
          <Phone className="w-9 h-9 text-primary-foreground" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">Vérification SMS</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Code à 6 chiffres envoyé au<br />
            <span className="text-foreground font-semibold">{phone}</span>
          </p>
        </div>

        {/* OTP Inputs */}
        <div className="flex gap-3" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={cn(
                'w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-muted/30 outline-none transition-all',
                digit ? 'border-primary text-foreground' : 'border-border/40 text-muted-foreground',
                'focus:border-primary focus:bg-primary/5'
              )}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="text-center">
          {timer > 0 ? (
            <p className="text-sm text-muted-foreground">
              Code valide pendant{' '}
              <span className={cn('font-bold', timer < 60 ? 'text-destructive' : 'text-primary')}>
                {formatTime(timer)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-destructive font-medium">Code expiré</p>
          )}
        </div>

        {/* Verify button */}
        <Button
          variant="gradient"
          className="w-full h-14 text-base font-bold rounded-2xl"
          onClick={handleVerify}
          disabled={loading || otp.some(d => !d)}
        >
          {loading ? 'Vérification...' : 'Confirmer le code'}
        </Button>

        {/* Resend */}
        <button
          onClick={handleResend}
          disabled={timer > 0 || resending}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-all',
            timer === 0 ? 'text-primary' : 'text-muted-foreground cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', resending && 'animate-spin')} />
          {resending ? 'Envoi...' : 'Renvoyer le code'}
        </button>
      </div>
    </div>
  );
};

export default VerifyOTP;
