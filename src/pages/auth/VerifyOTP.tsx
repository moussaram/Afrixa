import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const RESEND_COOLDOWN = 60;

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
  const [timer, setTimer] = useState(RESEND_COOLDOWN);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verificationInFlight = useRef(false);

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
    if (!/^\d{6}$/.test(code) || verificationInFlight.current) return;
    verificationInFlight.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        toast.error('Code incorrect ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      if (!data.user) {
        toast.error('La vérification a échoué. Veuillez réessayer.');
        return;
      }

      // Supabase conserve les métadonnées d'inscription dans auth.users.
      // Elles servent de secours si le state de navigation est absent.
      const metadata = data.user?.user_metadata ?? {};
      const registrationData: RegisterOtpFormData | null =
        formData ??
        (metadata.nom && metadata.prenom
          ? {
              nom: String(metadata.nom),
              prenom: String(metadata.prenom),
              deuxieme_prenom: metadata.deuxieme_prenom ? String(metadata.deuxieme_prenom) : undefined,
              date_naissance: metadata.date_naissance ? String(metadata.date_naissance) : undefined,
              lieu_naissance: metadata.lieu_naissance ? String(metadata.lieu_naissance) : undefined,
              profession: metadata.profession ? String(metadata.profession) : undefined,
              nationalite:
                metadata.nationalite || metadata.nationalite_flag
                  ? {
                      name: metadata.nationalite ? String(metadata.nationalite) : undefined,
                      flag: metadata.nationalite_flag ? String(metadata.nationalite_flag) : undefined,
                    }
                  : null,
            }
          : null);

      // Après validation du SMS, garantir l'existence du profil même si le trigger
      // de création de profil n'a pas inséré de ligne.
      if ((mode === 'register' || registrationData) && registrationData && data.user) {
        const username = (registrationData.prenom || 'afrixa').toLowerCase().replace(/\s/g, '_') +
          '_' + Math.floor(Math.random() * 9999);
        const profilePayload = {
          user_id: data.user.id,
          nom: registrationData.nom || null,
          prenom: registrationData.prenom || null,
          deuxieme_prenom: registrationData.deuxieme_prenom || null,
          date_naissance: registrationData.date_naissance || null,
          lieu_naissance: registrationData.lieu_naissance || null,
          profession: registrationData.profession || null,
          numero_mobile: phone,
          nationalite: registrationData.nationalite?.name || null,
          nationalite_flag: registrationData.nationalite?.flag || null,
          username,
          inscription_complete: true,
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'user_id' });

        if (profileError) {
          console.error('Profile completion after phone verification failed', profileError);
          toast.error('Numéro vérifié. Complétez votre profil dans les paramètres.');
          navigate('/settings');
          return;
        }

        toast.success('Bienvenue sur Afrixa, ' + registrationData.prenom + ' ! 🎉');
      } else if (mode === 'forgot') {
        navigate('/auth/reset-password', { state: { phoneRecovery: true, phone } });
        return;
      } else {
        toast.success('Connexion réussie !');
      }

      navigate('/');
    } catch (verificationError) {
      console.error('SMS verification failed', verificationError);
      toast.error('Impossible de vérifier le code pour le moment. Réessayez.');
    } finally {
      verificationInFlight.current = false;
      setLoading(false);
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (!/^\d{6}$/.test(code)) { toast.error('Entrez le code à 6 chiffres'); return; }
    verifyCode(code);
  };

  const handleResend = async () => {
    if (!phone || timer > 0 || resending || loading) return;
    setResending(true);
    try {
      const { error } = mode === 'register'
        ? await supabase.auth.resend({ type: 'sms', phone })
        : await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      if (error) {
        console.error('SMS resend failed', error);
        toast.error(error.message || 'Impossible de renvoyer le code. Réessayez plus tard.');
        return;
      }
      setTimer(RESEND_COOLDOWN);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('Nouveau code envoyé !');
    } catch (resendError) {
      console.error('SMS resend failed', resendError);
      toast.error('Impossible de renvoyer le code pour le moment.');
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
              autoComplete="one-time-code"
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
              Vous pourrez demander un nouveau code dans{' '}
              <span className={cn('font-bold', timer < 60 ? 'text-destructive' : 'text-primary')}>
                {formatTime(timer)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Vous pouvez demander un nouveau code.</p>
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
