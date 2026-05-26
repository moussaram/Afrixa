import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, User, MapPin, Briefcase, Globe, FileText, Calendar, Phone, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { cn } from '@/lib/utils';

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  verified: boolean;
}

const InfoRow = ({ icon: Icon, label, value, verified }: InfoRowProps) => (
  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/10 last:border-0">
    <div className={cn(
      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
      verified ? "bg-green-500/10" : "bg-destructive/10"
    )}>
      <Icon className={cn("w-5 h-5", verified ? "text-green-500" : "text-destructive")} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">
        {value || <span className="text-muted-foreground italic">Non renseigné</span>}
      </p>
    </div>
    <div className={cn(
      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
      verified
        ? "bg-green-500/10 text-green-500"
        : "bg-destructive/10 text-destructive"
    )}>
      {verified ? (
        <><CheckCircle2 className="w-3.5 h-3.5" /> Vérifié</>
      ) : (
        <><XCircle className="w-3.5 h-3.5" /> Non vérifié</>
      )}
    </div>
  </div>
);

const MyInfo = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const fields: InfoRowProps[] = [
    { icon: User, label: 'Nom', value: profile?.nom, verified: !!profile?.nom?.trim() },
    { icon: User, label: 'Prénom', value: profile?.prenom, verified: !!profile?.prenom?.trim() },
    { icon: User, label: '2ème prénom', value: profile?.deuxieme_prenom, verified: !!profile?.deuxieme_prenom?.trim() },
    { icon: Calendar, label: 'Date de naissance', value: profile?.date_naissance, verified: !!profile?.date_naissance },
    { icon: MapPin, label: 'Lieu de naissance', value: profile?.lieu_naissance, verified: !!profile?.lieu_naissance?.trim() },
    { icon: Briefcase, label: 'Profession', value: profile?.profession, verified: !!profile?.profession?.trim() },
    { icon: Globe, label: 'Nationalité', value: profile?.nationalite ? `${profile.nationalite_flag || ''} ${profile.nationalite}` : null, verified: !!profile?.nationalite },
    { icon: FileText, label: 'Bio', value: profile?.bio, verified: !!profile?.bio?.trim() },
    { icon: Mail, label: 'Email', value: user?.email, verified: !!profile?.email_verifie },
    { icon: Phone, label: 'Numéro mobile', value: profile?.numero_mobile, verified: !!profile?.mobile_verifie },
  ];

  const verifiedCount = fields.filter(f => f.verified).length;
  const allVerified = verifiedCount === fields.length;
  const percentage = Math.round((verifiedCount / fields.length) * 100);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="flex items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Mes infos</h1>
        </div>
      </header>

      {/* Progress */}
      <div className="px-4 pt-5 pb-2">
        <div className="bg-card/40 rounded-2xl p-4 border border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn("w-5 h-5", allVerified ? "text-green-500" : "text-primary")} />
              <span className="text-sm font-semibold text-foreground">Statut du profil</span>
            </div>
            <span className={cn(
              "text-sm font-bold",
              allVerified ? "text-green-500" : "text-primary"
            )}>
              {percentage}%
            </span>
          </div>
          <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allVerified ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {verifiedCount}/{fields.length} informations vérifiées
          </p>
        </div>
      </div>

      {/* Info List */}
      <div className="mx-4 mt-3 bg-card/30 rounded-2xl border border-border/20 overflow-hidden">
        {fields.map((field, i) => (
          <InfoRow key={i} {...field} />
        ))}
      </div>

      {/* Verify Button */}
      {!allVerified && (
        <div className="px-4 pt-6">
          <Button
            variant="gradient"
            className="w-full h-14 text-base font-bold rounded-2xl gap-2"
            onClick={() => navigate('/auth/complete-profile')}
          >
            <ShieldCheck className="w-5 h-5" />
            Vérifier maintenant
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Complétez vos informations pour un profil vérifié
          </p>
        </div>
      )}

      {allVerified && (
        <div className="px-4 pt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-semibold text-green-500">Profil entièrement vérifié ✓</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyInfo;
