import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Link as LinkIcon,
  Eye,
  EyeOff,
  MessageSquare,
  Users,
  Bell,
  BellOff,
  Heart,
  AtSign,
  Video,
  Play,
  Volume2,
  Moon,
  Sun,
  Smartphone,
  Wifi,
  HardDrive,
  Trash2,
  Globe,
  Clock,
  BarChart3,
  DollarSign,
  Palette,
  Accessibility,
  Languages,
  Database,
  ShieldCheck,
  Flag,
  HelpCircle,
  FileText,
  Info,
  LogOut,
  UserX,
  ChevronDown,
  Search,
  Download,
  Ban,
  Sparkles,
  Timer,
  Fingerprint,
  Save,
  MapPin,
  Briefcase,
  Check,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsItem } from '@/components/settings/SettingsItem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { africanCountries, type AfricanCountry } from '@/data/africanCountries';

const SETTINGS_STORAGE_KEY = 'afrixa:user-settings:v1';

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<string[]>(['account']);
  const [dangerDialog, setDangerDialog] = useState<null | 'deactivate' | 'delete' | 'logout'>(null);
  const [confirmText, setConfirmText] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [cacheSize, setCacheSize] = useState('Calcul...');
  
  // Identity editing
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [identityForm, setIdentityForm] = useState({
    nom: '',
    prenom: '',
    deuxieme_prenom: '',
    date_naissance: '',
    lieu_naissance: '',
    profession: '',
    bio: '',
    nationalite: null as AfricanCountry | null,
  });

  useEffect(() => {
    if (profile) {
      const country = africanCountries.find(c => c.name === profile.nationalite) || null;
      setIdentityForm({
        nom: profile.nom || '',
        prenom: profile.prenom || '',
        deuxieme_prenom: profile.deuxieme_prenom || '',
        date_naissance: profile.date_naissance || '',
        lieu_naissance: profile.lieu_naissance || '',
        profession: profile.profession || '',
        bio: profile.bio || '',
        nationalite: country,
      });
    }
  }, [profile]);

  const filteredCountries = africanCountries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSaveIdentity = async () => {
    if (!user) return;
    setIdentityLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        nom: identityForm.nom || null,
        prenom: identityForm.prenom || null,
        deuxieme_prenom: identityForm.deuxieme_prenom || null,
        date_naissance: identityForm.date_naissance || null,
        lieu_naissance: identityForm.lieu_naissance || null,
        profession: identityForm.profession || null,
        bio: identityForm.bio || null,
        nationalite: identityForm.nationalite?.name || null,
        nationalite_flag: identityForm.nationalite?.flag || null,
        inscription_complete: !!(identityForm.nom && identityForm.prenom),
      }).eq('user_id', user.id);

      if (error) { toast.error('Erreur de sauvegarde'); return; }
      await refreshProfile();
      toast.success('Informations mises à jour ✓');
      setEditingIdentity(false);
    } finally {
      setIdentityLoading(false);
    }
  };

  // Toggle states
  const [privateAccount, setPrivateAccount] = useState(false);
  const [filterComments, setFilterComments] = useState(true);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [allowDuets, setAllowDuets] = useState(true);
  const [allowStitchs, setAllowStitchs] = useState(true);
  
  // Notifications
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyNewVideos, setNotifyNewVideos] = useState(true);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  
  // Content & Display
  const [autoPlay, setAutoPlay] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [autoSubtitles, setAutoSubtitles] = useState(false);
  const [hdOnWifi, setHdOnWifi] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  
  // Well-being
  const [screenTimeReminder, setScreenTimeReminder] = useState(false);
  const [sleepReminder, setSleepReminder] = useState(false);
  
  // Accessibility
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  
  // Security
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [securityEmails, setSecurityEmails] = useState(true);

  const settingsSnapshot = {
    privateAccount,
    filterComments,
    allowDownloads,
    allowDuets,
    allowStitchs,
    notifyLikes,
    notifyComments,
    notifyFollowers,
    notifyMentions,
    notifyMessages,
    notifyNewVideos,
    doNotDisturb,
    autoPlay,
    dataSaver,
    autoSubtitles,
    hdOnWifi,
    darkMode,
    screenTimeReminder,
    sleepReminder,
    reducedMotion,
    highContrast,
    twoFactorAuth,
    securityEmails,
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setPrivateAccount(Boolean(parsed.privateAccount));
      setFilterComments(parsed.filterComments ?? true);
      setAllowDownloads(parsed.allowDownloads ?? true);
      setAllowDuets(parsed.allowDuets ?? true);
      setAllowStitchs(parsed.allowStitchs ?? true);
      setNotifyLikes(parsed.notifyLikes ?? true);
      setNotifyComments(parsed.notifyComments ?? true);
      setNotifyFollowers(parsed.notifyFollowers ?? true);
      setNotifyMentions(parsed.notifyMentions ?? true);
      setNotifyMessages(parsed.notifyMessages ?? true);
      setNotifyNewVideos(parsed.notifyNewVideos ?? true);
      setDoNotDisturb(Boolean(parsed.doNotDisturb));
      setAutoPlay(parsed.autoPlay ?? true);
      setDataSaver(Boolean(parsed.dataSaver));
      setAutoSubtitles(Boolean(parsed.autoSubtitles));
      setHdOnWifi(parsed.hdOnWifi ?? true);
      setDarkMode(parsed.darkMode ?? true);
      setScreenTimeReminder(Boolean(parsed.screenTimeReminder));
      setSleepReminder(Boolean(parsed.sleepReminder));
      setReducedMotion(Boolean(parsed.reducedMotion));
      setHighContrast(Boolean(parsed.highContrast));
      setTwoFactorAuth(Boolean(parsed.twoFactorAuth));
      setSecurityEmails(parsed.securityEmails ?? true);
    } catch {
      toast.error('Impossible de charger les préférences locales');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsSnapshot));
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    document.documentElement.classList.toggle('high-contrast', highContrast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(settingsSnapshot));

  useEffect(() => {
    const bytes = Object.keys(localStorage).reduce((sum, key) => {
      const value = localStorage.getItem(key) || '';
      return sum + key.length + value.length;
    }, 0);
    setCacheSize(bytes > 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`);
  }, [searchQuery]);

  const settingsSearchIndex = [
    { section: 'account', title: 'Gérer le compte', terms: 'profil email telephone mot de passe verification compte createur donnees suppression' },
    { section: 'privacy', title: 'Confidentialité', terms: 'compte prive commentaires duets stitch telechargement blocage interactions' },
    { section: 'notifications', title: 'Notifications', terms: 'push email ne pas deranger likes commentaires abonnes mentions messages videos' },
    { section: 'content', title: 'Contenu et affichage', terms: 'lecture automatique economie donnees wifi sous titres theme sombre apparence langue' },
    { section: 'wellbeing', title: 'Bien-être numérique', terms: 'temps ecran pause sommeil supervision familiale' },
    { section: 'creator', title: 'Créateur & Outils', terms: 'analytics monetisation portefeuille studio fan club challenges cadeaux live' },
    { section: 'accessibility', title: 'Accessibilité', terms: 'contraste animations sous titres lisibilite' },
    { section: 'language', title: 'Langue et région', terms: 'francais pays region heure devise' },
    { section: 'storage', title: 'Stockage et données', terms: 'cache telechargements preload donnees export' },
    { section: 'security', title: 'Sécurité', terms: 'appareils connectes permissions camera micro localisation emails securite 2fa' },
    { section: 'support', title: 'Aide et signalement', terms: 'support signaler probleme commentaires aide contact' },
    { section: 'legal', title: 'Informations légales', terms: 'conditions confidentialite licences version mentions legales' },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? settingsSearchIndex.filter((item) => `${item.title} ${item.terms}`.toLowerCase().includes(normalizedSearch))
    : [];

  const openSearchResult = (section: string) => {
    setOpenSections((current) => Array.from(new Set([...current, section])));
    toast.info(`Section ouverte : ${settingsSearchIndex.find((item) => item.section === section)?.title}`);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Déconnexion réussie');
    navigate('/auth/login');
  };

  const handleDeleteAccount = () => {
    setConfirmText('');
    setDangerDialog('delete');
  };

  const handleDeactivateAccount = () => {
    setConfirmText('');
    setDangerDialog('deactivate');
  };

  const exportSettings = async () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        username: profile?.username,
      },
      profile,
      preferences: settingsSnapshot,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Données copiées dans le presse-papiers');
  };

  const clearAppCache = () => {
    const preserved = new Set([SETTINGS_STORAGE_KEY]);
    Object.keys(localStorage)
      .filter((key) => key.startsWith('afrixa:') && !preserved.has(key))
      .forEach((key) => localStorage.removeItem(key));
    setCacheSize('0 B');
    toast.success('Cache Afrixa vidé');
  };

  const confirmDangerAction = async () => {
    if (dangerDialog === 'logout') {
      await handleLogout();
      return;
    }
    if (dangerDialog === 'deactivate') {
      if (confirmText.toLowerCase() !== 'desactiver') {
        toast.error('Tapez DESACTIVER pour confirmer');
        return;
      }
      setDangerDialog(null);
      toast.success('Demande de désactivation enregistrée pour 30 jours');
      return;
    }
    if (dangerDialog === 'delete') {
      if (confirmText.toLowerCase() !== 'supprimer') {
        toast.error('Tapez SUPPRIMER pour confirmer');
        return;
      }
      setDangerDialog(null);
      toast.error('Suppression programmée. Une vérification support sera requise.');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="flex items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">
            Paramètres et confidentialité
          </h1>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un paramètre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/30 border-border/30"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-2xl border border-border/30 bg-card/95 p-2 shadow-lg">
              {searchResults.slice(0, 5).map((result) => (
                <button
                  key={result.section}
                  onClick={() => openSearchResult(result.section)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/40"
                >
                  <span className="font-medium text-foreground">{result.title}</span>
                  <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Settings Content */}
      <div className="py-4">
        <div className="mx-4 mb-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setOpenSections(['privacy', 'security']);
              toast.info('Audit confidentialité ouvert');
            }}
            className="rounded-2xl border border-border/30 bg-card/40 p-4 text-left"
          >
            <ShieldCheck className="mb-3 h-5 w-5 text-emerald-500" />
            <p className="text-sm font-bold text-foreground">Audit confidentialité</p>
            <p className="mt-1 text-xs text-muted-foreground">Compte, interactions, permissions</p>
          </button>
          <button
            onClick={exportSettings}
            className="rounded-2xl border border-border/30 bg-card/40 p-4 text-left"
          >
            <Download className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm font-bold text-foreground">Exporter mes données</p>
            <p className="mt-1 text-xs text-muted-foreground">Profil et préférences</p>
          </button>
        </div>

        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
          {/* 1. Account Management */}
          <AccordionItem value="account" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Gérer le compte</p>
                  <p className="text-xs text-muted-foreground">Profil, email, mot de passe</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              {/* Identité - Section éditable */}
              <SettingsSection title="Identité personnelle">
                {!editingIdentity ? (
                  <>
                    <SettingsItem icon={User} label="Nom" value={profile?.nom || 'Non renseigné'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={User} label="Prénom" value={profile?.prenom || 'Non renseigné'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={User} label="2ème prénom" value={profile?.deuxieme_prenom || '—'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={MapPin} label="Lieu de naissance" value={profile?.lieu_naissance || 'Non renseigné'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={Briefcase} label="Profession" value={profile?.profession || 'Non renseigné'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={Globe} label="Nationalité" value={profile?.nationalite ? `${profile.nationalite_flag || ''} ${profile.nationalite}` : 'Non renseigné'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    <SettingsItem icon={FileText} label="Bio" value={profile?.bio || 'Ajouter une bio'} type="navigate" onClick={() => setEditingIdentity(true)} />
                    {!profile?.inscription_complete && (
                      <div className="px-4 py-2">
                        <button onClick={() => setEditingIdentity(true)} className="text-sm text-primary font-semibold underline">
                          ⚠️ Compléter vos informations
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nom</label>
                        <Input value={identityForm.nom} onChange={e => setIdentityForm(f => ({ ...f, nom: e.target.value }))}
                          placeholder="Kouassi" className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Prénom</label>
                        <Input value={identityForm.prenom} onChange={e => setIdentityForm(f => ({ ...f, prenom: e.target.value }))}
                          placeholder="Jean" className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">2ème prénom</label>
                      <Input value={identityForm.deuxieme_prenom} onChange={e => setIdentityForm(f => ({ ...f, deuxieme_prenom: e.target.value }))}
                        placeholder="Optionnel" className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Date de naissance</label>
                      <Input type="date" value={identityForm.date_naissance} onChange={e => setIdentityForm(f => ({ ...f, date_naissance: e.target.value }))}
                        className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Lieu de naissance</label>
                      <Input value={identityForm.lieu_naissance} onChange={e => setIdentityForm(f => ({ ...f, lieu_naissance: e.target.value }))}
                        placeholder="Abidjan, Côte d'Ivoire" className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Profession</label>
                      <Input value={identityForm.profession} onChange={e => setIdentityForm(f => ({ ...f, profession: e.target.value }))}
                        placeholder="Ingénieur, Étudiant..." className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Bio</label>
                      <Input value={identityForm.bio} onChange={e => setIdentityForm(f => ({ ...f, bio: e.target.value }))}
                        placeholder="Parlez de vous..." className="h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                    </div>
                    {/* Nationalité */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nationalité</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Rechercher..." value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          className="pl-9 h-10 rounded-lg bg-muted/30 border-border/30 text-sm" />
                      </div>
                      {identityForm.nationalite && (
                        <div className="mt-1.5 flex items-center gap-2 p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                          <span>{identityForm.nationalite.flag}</span>
                          <span className="text-sm">{identityForm.nationalite.name}</span>
                          <Check className="w-3.5 h-3.5 text-primary ml-auto" />
                        </div>
                      )}
                      {countrySearch && (
                        <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-border/30 bg-background shadow-lg">
                          {filteredCountries.slice(0, 6).map(c => (
                            <button key={c.code} onClick={() => { setIdentityForm(f => ({ ...f, nationalite: c })); setCountrySearch(''); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 text-left text-sm">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setEditingIdentity(false)}>
                        Annuler
                      </Button>
                      <Button variant="gradient" className="flex-1 h-10 rounded-xl gap-1.5" onClick={handleSaveIdentity} disabled={identityLoading}>
                        <Save className="w-4 h-4" />
                        {identityLoading ? 'Sauvegarde...' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                )}
              </SettingsSection>

              <SettingsSection title="Vérification">
                <SettingsItem icon={ShieldCheck} label="Mes infos" description="Voir le statut de vérification" type="navigate" onClick={() => navigate('/settings/my-info')} />
              </SettingsSection>

              <SettingsSection title="Informations du profil">
                <SettingsItem icon={User} label="Photo de profil" type="navigate" onClick={() => toast.info('Modifier la photo de profil')} />
                <SettingsItem icon={AtSign} label="Nom d'utilisateur" value={profile?.username ? `@${profile.username}` : 'Non défini'} type="navigate" onClick={() => toast.info('Modifier le nom d\'utilisateur')} />
                <SettingsItem icon={LinkIcon} label="Lien vers site web" type="navigate" onClick={() => toast.info('Ajouter un lien')} />
              </SettingsSection>
              
              <SettingsSection title="Gestion du compte">
                <SettingsItem icon={Mail} label="Email" value={user?.email || 'Non défini'} type="navigate" onClick={() => toast.info('Modifier l\'email')} />
                <SettingsItem icon={Phone} label="Numéro de téléphone" value={profile?.numero_mobile || 'Ajouter'} type="navigate" onClick={() => toast.info('Ajouter un numéro')} />
                <SettingsItem icon={Lock} label="Mot de passe" type="navigate" onClick={() => toast.info('Changer le mot de passe')} />
                <SettingsItem 
                  icon={Fingerprint} 
                  label="Vérification en deux étapes" 
                  type="toggle"
                  checked={twoFactorAuth}
                  onToggle={setTwoFactorAuth}
                />
                <SettingsItem icon={LinkIcon} label="Comptes liés" value="Google" type="navigate" onClick={() => toast.info('Gérer les comptes liés')} />
              </SettingsSection>

              <SettingsSection title="Type de compte">
                <SettingsItem icon={Sparkles} label="Passer en compte créateur" description="Accès aux analytics et outils" type="navigate" onClick={() => navigate('/creators/program')} />
                <SettingsItem icon={BarChart3} label="Passer en compte professionnel" description="Outils marketing et publicités" type="navigate" onClick={() => navigate('/boost')} />
              </SettingsSection>

              <SettingsSection title="Données et compte">
                <SettingsItem icon={Download} label="Télécharger mes données" type="navigate" onClick={exportSettings} />
                <SettingsItem icon={Timer} label="Désactiver le compte" description="Désactivation temporaire 30 jours" type="navigate" onClick={handleDeactivateAccount} />
                <SettingsItem icon={UserX} label="Supprimer le compte" danger type="navigate" onClick={handleDeleteAccount} />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Privacy */}
          <AccordionItem value="privacy" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Confidentialité</p>
                  <p className="text-xs text-muted-foreground">Compte privé, interactions</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Type de compte">
                <SettingsItem 
                  icon={privateAccount ? EyeOff : Eye} 
                  label="Compte privé" 
                  description="Seuls les abonnés approuvés voient vos vidéos"
                  type="toggle"
                  checked={privateAccount}
                  onToggle={setPrivateAccount}
                />
              </SettingsSection>

              <SettingsSection title="Interactions">
                <SettingsItem icon={Video} label="Qui peut voir vos vidéos" value="Tout le monde" type="navigate" />
                <SettingsItem icon={MessageSquare} label="Qui peut envoyer des messages" value="Amis" type="navigate" />
                <SettingsItem 
                  icon={Video} 
                  label="Autoriser les Duos" 
                  type="toggle"
                  checked={allowDuets}
                  onToggle={setAllowDuets}
                />
                <SettingsItem 
                  icon={Video} 
                  label="Autoriser les Stitchs" 
                  type="toggle"
                  checked={allowStitchs}
                  onToggle={setAllowStitchs}
                />
                <SettingsItem 
                  icon={Download} 
                  label="Autoriser téléchargement vidéos" 
                  type="toggle"
                  checked={allowDownloads}
                  onToggle={setAllowDownloads}
                />
                <SettingsItem icon={MessageSquare} label="Qui peut commenter" value="Tout le monde" type="navigate" />
                <SettingsItem icon={AtSign} label="Qui peut vous mentionner" value="Tout le monde" type="navigate" />
              </SettingsSection>

              <SettingsSection title="Filtrage des commentaires">
                <SettingsItem 
                  icon={Shield} 
                  label="Filtrer spam et offensif" 
                  type="toggle"
                  checked={filterComments}
                  onToggle={setFilterComments}
                />
                <SettingsItem icon={Ban} label="Mots-clés à filtrer" type="navigate" onClick={() => toast.info('Gérer les mots-clés')} />
              </SettingsSection>

              <SettingsSection title="Blocage et restrictions">
                <SettingsItem icon={Ban} label="Comptes bloqués" value="0" type="navigate" />
                <SettingsItem icon={Users} label="Comptes restreints" value="0" type="navigate" />
                <SettingsItem icon={EyeOff} label="Comptes masqués" value="0" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Notifications */}
          <AccordionItem value="notifications" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Push, email, ne pas déranger</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Mode silencieux">
                <SettingsItem 
                  icon={BellOff} 
                  label="Ne pas déranger" 
                  description="Désactiver temporairement les notifications"
                  type="toggle"
                  checked={doNotDisturb}
                  onToggle={setDoNotDisturb}
                />
              </SettingsSection>

              <SettingsSection title="Interactions">
                <SettingsItem 
                  icon={Heart} 
                  label="J'aime" 
                  type="toggle"
                  checked={notifyLikes}
                  onToggle={setNotifyLikes}
                />
                <SettingsItem 
                  icon={MessageSquare} 
                  label="Commentaires" 
                  type="toggle"
                  checked={notifyComments}
                  onToggle={setNotifyComments}
                />
                <SettingsItem 
                  icon={Users} 
                  label="Nouveaux abonnés" 
                  type="toggle"
                  checked={notifyFollowers}
                  onToggle={setNotifyFollowers}
                />
                <SettingsItem 
                  icon={AtSign} 
                  label="Mentions" 
                  type="toggle"
                  checked={notifyMentions}
                  onToggle={setNotifyMentions}
                />
                <SettingsItem 
                  icon={MessageSquare} 
                  label="Messages directs" 
                  type="toggle"
                  checked={notifyMessages}
                  onToggle={setNotifyMessages}
                />
              </SettingsSection>

              <SettingsSection title="Abonnements">
                <SettingsItem 
                  icon={Video} 
                  label="Nouvelles vidéos" 
                  type="toggle"
                  checked={notifyNewVideos}
                  onToggle={setNotifyNewVideos}
                />
              </SettingsSection>

              <SettingsSection title="Email">
                <SettingsItem icon={Mail} label="Notifications par email" type="navigate" value="Hebdo" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 4. Content & Display */}
          <AccordionItem value="content" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Contenu et affichage</p>
                  <p className="text-xs text-muted-foreground">Lecture, thème, langues</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Lecture vidéo">
                <SettingsItem 
                  icon={Play} 
                  label="Lecture automatique" 
                  type="toggle"
                  checked={autoPlay}
                  onToggle={setAutoPlay}
                />
                <SettingsItem 
                  icon={Wifi} 
                  label="Économie de données" 
                  description="Qualité réduite sur données mobiles"
                  type="toggle"
                  checked={dataSaver}
                  onToggle={setDataSaver}
                />
                <SettingsItem 
                  icon={Download} 
                  label="HD uniquement sur WiFi" 
                  type="toggle"
                  checked={hdOnWifi}
                  onToggle={setHdOnWifi}
                />
                <SettingsItem 
                  icon={FileText} 
                  label="Sous-titres automatiques" 
                  type="toggle"
                  checked={autoSubtitles}
                  onToggle={setAutoSubtitles}
                />
              </SettingsSection>

              <SettingsSection title="Apparence">
                <SettingsItem 
                  icon={darkMode ? Moon : Sun} 
                  label="Mode sombre" 
                  type="toggle"
                  checked={darkMode}
                  onToggle={setDarkMode}
                />
                <SettingsItem icon={Palette} label="Taille du texte" value="Moyen" type="navigate" />
              </SettingsSection>

              <SettingsSection title="Préférences de contenu">
                <SettingsItem icon={Globe} label="Langues de contenu" value="Français" type="navigate" />
                <SettingsItem icon={Sparkles} label="Sujets d'intérêt" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Well-being */}
          <AccordionItem value="wellbeing" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-pink-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Bien-être numérique</p>
                  <p className="text-xs text-muted-foreground">Temps d'écran, rappels</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Temps d'écran">
                <SettingsItem icon={Clock} label="Limite quotidienne" value="Non définie" type="navigate" />
                <SettingsItem 
                  icon={Bell} 
                  label="Rappels de pause" 
                  type="toggle"
                  checked={screenTimeReminder}
                  onToggle={setScreenTimeReminder}
                />
                <SettingsItem icon={BarChart3} label="Tableau de bord activité" type="navigate" onClick={() => toast.info('Voir les statistiques d\'utilisation')} />
              </SettingsSection>

              <SettingsSection title="Sommeil">
                <SettingsItem 
                  icon={Moon} 
                  label="Rappel heure de coucher" 
                  type="toggle"
                  checked={sleepReminder}
                  onToggle={setSleepReminder}
                />
              </SettingsSection>

              <SettingsSection title="Contrôle familial">
                <SettingsItem icon={Users} label="Mode supervision familiale" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Creator Tools */}
          <AccordionItem value="creator" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Créateur & Outils</p>
                  <p className="text-xs text-muted-foreground">Analytics, monétisation</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Analytics">
                <SettingsItem icon={BarChart3} label="Vue d'ensemble" type="navigate" onClick={() => navigate('/creators/studio')} />
                <SettingsItem icon={Video} label="Performance du contenu" type="navigate" onClick={() => navigate('/creators/studio')} />
                <SettingsItem icon={Users} label="Données abonnés" type="navigate" onClick={() => navigate('/creators/studio')} />
              </SettingsSection>

              <SettingsSection title="Monétisation">
                <SettingsItem icon={DollarSign} label="Fonds pour créateurs" type="navigate" onClick={() => navigate('/creators/wallet')} />
                <SettingsItem icon={Sparkles} label="Cadeaux Live" type="navigate" onClick={() => navigate('/creators/wallet')} />
                <SettingsItem icon={DollarSign} label="Informations bancaires" type="navigate" onClick={() => navigate('/creators/wallet')} />
              </SettingsSection>

              <SettingsSection title="Outils créatifs">
                <SettingsItem icon={Sparkles} label="Effets favoris" type="navigate" />
                <SettingsItem icon={Volume2} label="Sons enregistrés" type="navigate" />
                <SettingsItem icon={Video} label="Brouillons" value="3" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 7. Accessibility */}
          <AccordionItem value="accessibility" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Accessibility className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Accessibilité</p>
                  <p className="text-xs text-muted-foreground">Contraste, animations</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Affichage">
                <SettingsItem 
                  icon={Eye} 
                  label="Contraste élevé" 
                  type="toggle"
                  checked={highContrast}
                  onToggle={setHighContrast}
                />
                <SettingsItem 
                  icon={Sparkles} 
                  label="Réduire les animations" 
                  type="toggle"
                  checked={reducedMotion}
                  onToggle={setReducedMotion}
                />
                <SettingsItem icon={FileText} label="Taille des sous-titres" value="Moyen" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 8. Language & Region */}
          <AccordionItem value="language" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Langue et région</p>
                  <p className="text-xs text-muted-foreground">Langue, pays, format</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Préférences">
                <SettingsItem icon={Languages} label="Langue de l'application" value="Français" type="navigate" />
                <SettingsItem icon={Globe} label="Région" value="Niger" type="navigate" />
                <SettingsItem icon={Clock} label="Format de l'heure" value="24h" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 9. Storage & Data */}
          <AccordionItem value="storage" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Stockage et données</p>
                  <p className="text-xs text-muted-foreground">Cache, téléchargements</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Stockage">
                <SettingsItem icon={HardDrive} label="Cache local" value={cacheSize} type="info" />
                <SettingsItem icon={Trash2} label="Vider le cache Afrixa" type="action" onClick={clearAppCache} />
                <SettingsItem icon={Video} label="Vidéos téléchargées" value="3 vidéos" type="navigate" />
              </SettingsSection>

              <SettingsSection title="Données">
                <SettingsItem 
                  icon={Wifi} 
                  label="Précharger les vidéos" 
                  type="toggle"
                  checked={!dataSaver}
                  onToggle={(v) => setDataSaver(!v)}
                />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 10. Security */}
          <AccordionItem value="security" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Sécurité</p>
                  <p className="text-xs text-muted-foreground">Appareils, permissions</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Connexions">
                <SettingsItem icon={Smartphone} label="Appareils connectés" value="2" type="navigate" />
                <SettingsItem 
                  icon={Mail} 
                  label="Emails de sécurité" 
                  type="toggle"
                  checked={securityEmails}
                  onToggle={setSecurityEmails}
                />
              </SettingsSection>

              <SettingsSection title="Permissions de l'app">
                <SettingsItem icon={Video} label="Caméra" value="Autorisé" type="navigate" />
                <SettingsItem icon={Volume2} label="Microphone" value="Autorisé" type="navigate" />
                <SettingsItem icon={HardDrive} label="Photos" value="Autorisé" type="navigate" />
                <SettingsItem icon={Globe} label="Localisation" value="Jamais" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 11. Support & Safety */}
          <AccordionItem value="support" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-teal-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Aide et signalement</p>
                  <p className="text-xs text-muted-foreground">Support, règles, problèmes</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Centre de sécurité">
                <SettingsItem icon={Flag} label="Signaler un problème" type="navigate" />
                <SettingsItem icon={FileText} label="Consignes communautaires" type="navigate" />
              </SettingsSection>

              <SettingsSection title="Support">
                <SettingsItem icon={HelpCircle} label="Aide & Support" type="navigate" onClick={() => navigate('/help-support')} />
                <SettingsItem icon={MessageSquare} label="Contacter le support" type="navigate" onClick={() => navigate('/help-support')} />
                <SettingsItem icon={FileText} label="Envoyer des commentaires" type="navigate" onClick={() => navigate('/help-support')} />
              </SettingsSection>

              <SettingsSection title="Message rapide">
                <div className="space-y-3 px-4 py-4">
                  <Textarea
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder="Décrivez le problème ou votre suggestion..."
                    className="min-h-24 bg-muted/30"
                  />
                  <Button
                    className="w-full"
                    variant="gradient"
                    onClick={() => {
                      if (!supportMessage.trim()) {
                        toast.error('Ajoutez un message avant l’envoi');
                        return;
                      }
                      setSupportMessage('');
                      toast.success('Message transmis au support Afrixa');
                    }}
                  >
                    Envoyer au support
                  </Button>
                </div>
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>

          {/* 12. Legal */}
          <AccordionItem value="legal" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Informations légales</p>
                  <p className="text-xs text-muted-foreground">CGU, confidentialité, à propos</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SettingsSection title="Documents">
                <SettingsItem icon={FileText} label="Conditions d'utilisation" type="navigate" />
                <SettingsItem icon={Shield} label="Politique de confidentialité" type="navigate" />
                <SettingsItem icon={FileText} label="Consignes communautaires" type="navigate" />
                <SettingsItem icon={FileText} label="Licences open source" type="navigate" />
              </SettingsSection>

              <SettingsSection title="À propos">
                <SettingsItem icon={Info} label="Version" value="2.0.0" type="info" />
                <SettingsItem icon={Info} label="Mentions légales" type="navigate" />
              </SettingsSection>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Quick Actions */}
        <div className="mt-8 px-4 space-y-3">
          <Button 
            variant="outline" 
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => setDangerDialog('logout')}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Se déconnecter
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 pb-8 text-center">
          <p className="text-xs text-muted-foreground">Afrixa v2.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">© 2026 Afrixa. Tous droits réservés.</p>
        </div>
      </div>

      <Dialog open={dangerDialog !== null} onOpenChange={(open) => !open && setDangerDialog(null)}>
        <DialogContent className="border-border/30 bg-background text-foreground">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              {dangerDialog === 'logout' ? (
                <LogOut className="h-6 w-6 text-destructive" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <DialogTitle>
              {dangerDialog === 'logout' && 'Se déconnecter'}
              {dangerDialog === 'deactivate' && 'Désactiver le compte'}
              {dangerDialog === 'delete' && 'Supprimer le compte'}
            </DialogTitle>
            <DialogDescription>
              {dangerDialog === 'logout' && 'Vous devrez vous reconnecter pour accéder à votre compte Afrixa.'}
              {dangerDialog === 'deactivate' && 'Votre profil sera masqué temporairement. Tapez DESACTIVER pour confirmer.'}
              {dangerDialog === 'delete' && 'Cette demande est critique. Tapez SUPPRIMER pour confirmer la procédure.'}
            </DialogDescription>
          </DialogHeader>

          {dangerDialog !== 'logout' && (
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={dangerDialog === 'deactivate' ? 'DESACTIVER' : 'SUPPRIMER'}
              className="bg-muted/30"
            />
          )}

          {dangerDialog === 'delete' && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Les retraits, commandes et litiges doivent être vérifiés avant suppression définitive.
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDangerDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDangerAction}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
