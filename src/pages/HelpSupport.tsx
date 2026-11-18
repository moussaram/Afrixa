import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Headphones, Search, Mail, BookOpen, ChevronDown, Send, Loader2,
  ShoppingBag, CreditCard, Truck, Store, Copyright, ShieldAlert, UserRound,
  Video, Radio, MessageCircle, Wallet, Megaphone, Smartphone,
  Ticket, AlertTriangle, LifeBuoy, RefreshCw, Paperclip, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type SupportTopic = { value: string; label: string; description: string };
type SupportCategory = {
  value: string;
  label: string;
  icon: typeof ShoppingBag;
  description: string;
  topics: SupportTopic[];
};

const supportCategories: SupportCategory[] = [
  { value: 'marketplace', label: 'Marketplace & achats', icon: ShoppingBag, description: 'Achats, vendeurs et produits', topics: [
    { value: 'seller_scam', label: 'Arnaque ou escroquerie d’un vendeur', description: 'Vendeur frauduleux, fausse boutique ou demande de paiement hors Afrixa' },
    { value: 'buyer_scam', label: 'Fraude ou abus d’un acheteur', description: 'Faux justificatif, commande abusive ou comportement frauduleux' },
    { value: 'product_not_received', label: 'Produit non reçu', description: 'La commande est payée mais jamais livrée' },
    { value: 'product_not_as_described', label: 'Produit différent ou défectueux', description: 'Article non conforme, endommagé ou incomplet' },
    { value: 'seller_unresponsive', label: 'Vendeur injoignable', description: 'Le vendeur ne répond plus après la commande' },
    { value: 'counterfeit_product', label: 'Produit contrefait ou interdit', description: 'Produit suspect, contrefaçon ou article dangereux' },
    { value: 'marketplace_other', label: 'Autre problème d’achat', description: 'Autre difficulté liée à une commande ou un produit' },
  ]},
  { value: 'payment', label: 'Paiements & remboursements', icon: CreditCard, description: 'Mobile Money, carte et transactions', topics: [
    { value: 'debited_not_confirmed', label: 'Débité mais paiement non confirmé', description: 'Le compte ou portefeuille a été débité sans confirmation sur Afrixa' },
    { value: 'payment_failed', label: 'Paiement échoué', description: 'Erreur opérateur, refus ou transaction interrompue' },
    { value: 'duplicate_payment', label: 'Paiement en double', description: 'Plusieurs débits pour une seule commande' },
    { value: 'refund_missing', label: 'Remboursement non reçu', description: 'Remboursement annoncé mais absent du portefeuille' },
    { value: 'unauthorized_payment', label: 'Transaction non autorisée', description: 'Paiement que vous ne reconnaissez pas' },
    { value: 'seller_payout', label: 'Paiement vendeur en attente', description: 'Solde vendeur ou versement non reçu' },
    { value: 'payment_other', label: 'Autre problème de paiement', description: 'Question sur une transaction ou un remboursement' },
  ]},
  { value: 'delivery', label: 'Livraison & suivi', icon: Truck, description: 'Transport, livreur et adresse', topics: [
    { value: 'delivery_late', label: 'Livraison en retard', description: 'La date prévue est dépassée' },
    { value: 'delivery_lost', label: 'Colis perdu ou bloqué', description: 'Le suivi ne progresse plus ou le colis est introuvable' },
    { value: 'delivery_wrong_address', label: 'Mauvaise adresse ou destinataire', description: 'Erreur d’adresse ou colis remis à la mauvaise personne' },
    { value: 'delivery_damaged', label: 'Colis endommagé', description: 'Le colis est arrivé abîmé' },
    { value: 'delivery_fee', label: 'Frais de livraison contestés', description: 'Montant ou frais supplémentaires inattendus' },
  ]},
  { value: 'digital_products', label: 'Produits numériques', icon: Smartphone, description: 'Fichiers, accès et téléchargements', topics: [
    { value: 'digital_access_missing', label: 'Accès au fichier non reçu', description: 'Paiement confirmé mais téléchargement indisponible' },
    { value: 'digital_file_broken', label: 'Fichier illisible ou incomplet', description: 'Fichier endommagé, mauvais format ou contenu manquant' },
    { value: 'digital_wrong_item', label: 'Mauvais produit numérique', description: 'Le contenu livré ne correspond pas à la description' },
    { value: 'digital_refund', label: 'Remboursement d’un produit numérique', description: 'Demande liée à un achat numérique' },
  ]},
  { value: 'seller_store', label: 'Boutique & vendeurs', icon: Store, description: 'Gestion de boutique et ventes', topics: [
    { value: 'store_creation', label: 'Création ou validation de boutique', description: 'Ouverture, vérification ou modification de boutique' },
    { value: 'store_suspended', label: 'Boutique suspendue', description: 'Contester une restriction ou comprendre une suspension' },
    { value: 'seller_order', label: 'Gestion d’une commande vendeur', description: 'Commande, stock, retour ou annulation' },
    { value: 'seller_balance', label: 'Solde ou retrait vendeur', description: 'Solde indisponible, retrait bloqué ou versement' },
    { value: 'seller_fraud_report', label: 'Signaler un acheteur', description: 'Comportement suspect ou abusif d’un acheteur' },
  ]},
  { value: 'intellectual_property', label: 'Droits d’auteur & propriété intellectuelle', icon: Copyright, description: 'Contenu volé, marque et usurpation', topics: [
    { value: 'copyright_infringement', label: 'Mon contenu a été copié', description: 'Vidéo, photo, musique ou texte publié sans autorisation' },
    { value: 'trademark_infringement', label: 'Utilisation abusive de ma marque', description: 'Logo, nom commercial ou identité visuelle utilisée sans droit' },
    { value: 'counterfeit_content', label: 'Contenu ou produit contrefait', description: 'Fausse marque ou imitation présentée comme authentique' },
    { value: 'copyright_counter_notice', label: 'Contester un retrait pour droits d’auteur', description: 'Faire examiner une décision de retrait' },
  ]},
  { value: 'safety_abuse', label: 'Sécurité, fraude & signalements', icon: ShieldAlert, description: 'Menaces, harcèlement et comportements dangereux', topics: [
    { value: 'harassment', label: 'Harcèlement ou intimidation', description: 'Messages, commentaires ou comportements répétés' },
    { value: 'impersonation', label: 'Usurpation d’identité', description: 'Un compte se fait passer pour vous ou une organisation' },
    { value: 'phishing', label: 'Hameçonnage ou tentative de vol', description: 'Lien suspect, demande de code ou tentative d’accès au compte' },
    { value: 'threats', label: 'Menace ou contenu dangereux', description: 'Menace crédible, violence ou mise en danger' },
    { value: 'privacy_violation', label: 'Atteinte à la vie privée', description: 'Publication de données personnelles sans autorisation' },
    { value: 'scam_other', label: 'Autre fraude ou abus', description: 'Signaler un comportement suspect' },
  ]},
  { value: 'account', label: 'Compte & accès', icon: UserRound, description: 'Connexion, profil et vérification', topics: [
    { value: 'account_hacked', label: 'Compte piraté ou compromis', description: 'Connexion inconnue ou compte contrôlé par un tiers' },
    { value: 'login_problem', label: 'Impossible de me connecter', description: 'Mot de passe, code ou authentification' },
    { value: 'account_restricted', label: 'Compte restreint ou suspendu', description: 'Demande d’explication ou de réexamen' },
    { value: 'identity_verification', label: 'Vérification d’identité', description: 'Demande, justificatifs ou badge identité' },
    { value: 'business_verification', label: 'Vérification entreprise/boutique', description: 'Documents commerciaux et badge professionnel' },
    { value: 'account_data', label: 'Données personnelles ou suppression', description: 'Accès, correction ou suppression des données' },
  ]},
  { value: 'content', label: 'Vidéos, publications & modération', icon: Video, description: 'Publication, visibilité et règles communautaires', topics: [
    { value: 'content_removed', label: 'Publication ou vidéo supprimée', description: 'Demander la raison ou contester une suppression' },
    { value: 'content_not_visible', label: 'Contenu non visible ou bloqué', description: 'Problème de diffusion ou de visibilité' },
    { value: 'content_report', label: 'Signaler un contenu', description: 'Contenu illégal, trompeur ou contraire aux règles' },
    { value: 'moderation_appeal', label: 'Faire appel d’une modération', description: 'Contester une sanction ou restriction' },
    { value: 'content_upload', label: 'Problème de publication', description: 'Échec d’envoi, traitement ou lecture' },
  ]},
  { value: 'live', label: 'Lives & diffusions', icon: Radio, description: 'Diffusion, spectateurs et cadeaux', topics: [
    { value: 'live_access', label: 'Accès au Live', description: 'Impossible de démarrer ou rejoindre un Live' },
    { value: 'live_abuse', label: 'Abus pendant un Live', description: 'Harcèlement, fraude ou contenu interdit' },
    { value: 'live_gifts', label: 'Cadeaux ou gains Live', description: 'Cadeau non crédité ou anomalie de gains' },
    { value: 'live_technical', label: 'Problème technique Live', description: 'Coupures, son, vidéo ou connexion' },
  ]},
  { value: 'messaging', label: 'Messagerie & interactions', icon: MessageCircle, description: 'Messages, commentaires et abonnements', topics: [
    { value: 'message_not_sent', label: 'Message non envoyé', description: 'Échec d’envoi ou de réception' },
    { value: 'blocked_user', label: 'Blocage ou restriction de contact', description: 'Problème de blocage ou d’interaction' },
    { value: 'fake_engagement', label: 'Faux abonnés ou interactions', description: 'Activité artificielle ou manipulation' },
  ]},
  { value: 'creator', label: 'Créateurs, coins & retraits', icon: Wallet, description: 'Monétisation, revenus et portefeuille', topics: [
    { value: 'creator_earnings', label: 'Gains non crédités', description: 'Revenus ou coins manquants' },
    { value: 'creator_withdrawal', label: 'Retrait en attente ou refusé', description: 'Demande de retrait ou coordonnées de paiement' },
    { value: 'creator_program', label: 'Programme créateur', description: 'Éligibilité, statistiques ou avantages' },
    { value: 'creator_balance', label: 'Solde incorrect', description: 'Écart dans le portefeuille ou l’historique' },
  ]},
  { value: 'advertising', label: 'Publicité & promotions', icon: Megaphone, description: 'Campagnes, facturation et annonces', topics: [
    { value: 'ad_rejected', label: 'Publicité refusée', description: 'Contester ou comprendre un refus' },
    { value: 'ad_payment', label: 'Paiement de campagne', description: 'Débit, facture ou crédit publicitaire' },
    { value: 'ad_delivery', label: 'Campagne non diffusée', description: 'Impressions ou résultats inattendus' },
    { value: 'ad_report', label: 'Signaler une publicité', description: 'Annonce trompeuse, dangereuse ou frauduleuse' },
  ]},
  { value: 'technical', label: 'Application & problème technique', icon: Smartphone, description: 'Bugs, lenteurs et compatibilité', topics: [
    { value: 'app_crash', label: 'Application se ferme ou bloque', description: 'Crash, écran figé ou erreur répétée' },
    { value: 'performance', label: 'Lenteur ou chargement', description: 'Problème de performance ou de connexion' },
    { value: 'feature_bug', label: 'Fonctionnalité défectueuse', description: 'Bouton ou parcours qui ne fonctionne pas' },
  ]},
  { value: 'other', label: 'Autre demande', icon: LifeBuoy, description: 'Question générale ou demande non classée', topics: [
    { value: 'general_question', label: 'Question générale', description: 'Information sur Afrixa' },
    { value: 'partnership', label: 'Partenariat ou proposition', description: 'Demande professionnelle' },
    { value: 'other_issue', label: 'Autre problème', description: 'Sujet non listé ci-dessus' },
  ]},
];

const faqItems = [
  { category: 'Achats', question: 'J’ai payé mais le vendeur ne livre pas. Que faire ?', answer: 'Ouvre le détail de ta commande, conserve les échanges et preuves de paiement, puis crée un ticket « Produit non reçu ». Ne paie jamais un supplément en dehors du parcours officiel Afrixa.' },
  { category: 'Paiements', question: 'Mon compte Mobile Money a été débité, mais la commande reste impayée.', answer: 'Ne relance pas plusieurs paiements immédiatement. Note la référence de transaction, joins les informations utiles dans un ticket « Débité mais paiement non confirmé » et demande une vérification.' },
  { category: 'Remboursements', question: 'Comment signaler un remboursement manquant ?', answer: 'Crée un ticket dans Paiements & remboursements, indique la référence de la transaction et le numéro de commande si tu en as un. Le support vérifiera le statut avant de confirmer le remboursement.' },
  { category: 'Droits', question: 'Quelqu’un republie ma vidéo sans autorisation.', answer: 'Choisis Droits d’auteur & propriété intellectuelle puis « Mon contenu a été copié ». Fournis les liens du contenu original et de la copie ainsi que les éléments permettant d’établir tes droits.' },
  { category: 'Sécurité', question: 'Un compte me demande mon code OTP ou mon mot de passe.', answer: 'Ne communique jamais ton mot de passe, ton code OTP, ton code PIN Mobile Money ou tes données bancaires. Signale immédiatement le compte dans Sécurité, fraude & signalements.' },
  { category: 'Compte', question: 'Comment contester une suspension ?', answer: 'Sélectionne Compte & accès puis « Compte restreint ou suspendu ». Explique les faits et joins la référence de la notification de modération si elle est disponible.' },
];

const statusLabels: Record<string, string> = {
  new: 'Reçu', in_progress: 'En cours', waiting_customer: 'Informations demandées',
  resolved: 'Résolu', closed: 'Clôturé', non_lu: 'Reçu', lu: 'Reçu',
};
const priorityLabels: Record<string, string> = { low: 'Faible', normal: 'Normale', high: 'Élevée', urgent: 'Urgente' };

type TicketRow = {
  id: string; ticket_number: string; category: string; topic: string; subject: string;
  status: string; priority: string; created_at: string; admin_reply: string | null;
};

const HelpSupport = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [topic, setTopic] = useState(params.get('topic') ?? '');
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [description, setDescription] = useState(params.get('details') ?? '');
  const [reference, setReference] = useState(params.get('reference') ?? '');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [priority, setPriority] = useState('normal');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [sentTicket, setSentTicket] = useState<{ number: string } | null>(null);
  const userId = user?.id;

  const selectedCategory = supportCategories.find((item) => item.value === category);
  const selectedTopic = selectedCategory?.topics.find((item) => item.value === topic);
  const filteredFaq = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? faqItems.filter((item) =>
      [item.category, item.question, item.answer].some((value) => value.toLowerCase().includes(query))
    ) : faqItems;
  }, [searchQuery]);

  const loadTickets = useCallback(async () => {
    if (!userId) { setTickets([]); return; }
    setLoadingTickets(true);
    const { data, error } = await supabase.from('help_messages')
      .select('id,ticket_number,category,topic,subject,status,priority,created_at,admin_reply')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      console.error('Support ticket history failed', error);
      toast.error('Impossible de charger l’historique du support.');
    } else setTickets((data ?? []) as TicketRow[]);
    setLoadingTickets(false);
  }, [userId]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const resetForm = () => {
    setCategory(''); setTopic(''); setSubject(''); setDescription('');
    setReference(''); setPriority('normal'); setAttachments([]); setSentTicket(null);
  };

  const submitTicket = async () => {
    if (!user) {
      toast.error('Connecte-toi pour créer et suivre un ticket.');
      navigate('/auth/login');
      return;
    }
    if (!category || !topic) return toast.error('Choisis un domaine et un sujet précis.');
    if (subject.trim().length < 5) return toast.error('Le sujet doit contenir au moins 5 caractères.');
    if (description.trim().length < 20) return toast.error('Décris le problème avec au moins 20 caractères.');
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return toast.error('Adresse e-mail de contact invalide.');
    }
    if (attachments.length > 5) return toast.error('Tu peux joindre au maximum 5 fichiers.');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (attachments.some((file) => !allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024)) return toast.error('Formats autorisés : JPG, PNG, WebP et PDF, 10 Mo maximum par fichier.');
    setSending(true);
    try {
      const { data, error } = await supabase.from('help_messages').insert({
        user_id: user.id,
        category,
        topic,
        subject: subject.trim(),
        message: description.trim(),
        priority,
        order_reference: reference.trim() || null,
        contact_email: contactEmail.trim() || null,
        status: 'new',
        related_dispute_id: params.get('dispute_id') || null,
        related_order_id: params.get('order_id') || null,
      } as any).select('id,ticket_number').single();
      if (error) throw error;
      if (attachments.length) {
        const uploadedPaths: string[] = [];
        try {
          const metadata = [];
          for (const file of attachments) {
            const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'evidence';
            const objectPath = `support/${user.id}/${data.id}/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabase.storage.from('support-attachments').upload(objectPath, file, { contentType: file.type, upsert: false });
            if (uploadError) throw uploadError;
            uploadedPaths.push(objectPath);
            metadata.push({ help_message_id: data.id, uploaded_by: user.id, object_path: objectPath, file_name: file.name.slice(0, 180), content_type: file.type, file_size_bytes: file.size });
          }
          const { error: metadataError } = await (supabase.from('support_attachments' as any) as any).insert(metadata);
          if (metadataError) throw metadataError;
        } catch (attachmentError) {
          if (uploadedPaths.length) await supabase.storage.from('support-attachments').remove(uploadedPaths);
          setSentTicket({ number: data.ticket_number });
          setAttachments([]);
          await loadTickets();
          toast.error('Ton ticket est créé, mais les pièces jointes n’ont pas été ajoutées. Tu peux les transmettre dans un nouveau ticket.');
          console.error('Support attachment upload failed', attachmentError);
          return;
        }
      }
      setSentTicket({ number: data.ticket_number });
      setDescription(''); setReference(''); setSubject(''); setAttachments([]);
      await loadTickets();
      toast.success('Demande transmise au support Afrixa.');
    } catch (error) {
      console.error('Support ticket submission failed', error);
      toast.error('La demande n’a pas été envoyée. Réessaie après vérification de ta connexion.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1"><h1 className="font-bold">Centre d’aide Afrixa</h1><p className="text-xs text-muted-foreground">Assistance, réclamations et signalements</p></div>
          <Headphones className="h-6 w-6 text-primary" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-7 px-4 py-6">
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><LifeBuoy className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">Comment pouvons-nous t’aider ?</h2><p className="mt-1 text-sm text-muted-foreground">Sélectionne le domaine concerné pour envoyer ta demande à l’équipe compétente.</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => document.getElementById('support-ticket-form')?.scrollIntoView({ behavior: 'smooth' })}><Ticket className="mr-2 h-4 w-4" /> Créer un ticket</Button>
            <Button size="sm" variant="outline" onClick={() => document.getElementById('support-faq')?.scrollIntoView({ behavior: 'smooth' })}><BookOpen className="mr-2 h-4 w-4" /> Consulter la FAQ</Button>
          </div>
        </section>

        <section className="space-y-3">
          <div><h2 className="font-bold">Choisir un domaine d’assistance</h2><p className="text-xs text-muted-foreground">Tous les principaux services Afrixa sont couverts.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {supportCategories.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} type="button" onClick={() => { setCategory(item.value); setTopic(''); setSubject(''); setSentTicket(null); document.getElementById('support-ticket-form')?.scrollIntoView({ behavior: 'smooth' }); }} className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40', category === item.value ? 'border-primary bg-primary/5' : 'border-border')}>
                <span className="rounded-lg bg-muted p-2"><Icon className="h-5 w-5 text-primary" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span></span>
                <ChevronDown className="-rotate-90 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>;
            })}
          </div>
        </section>

        <section id="support-ticket-form" className="scroll-mt-20 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4"><h2 className="font-bold">Contacter le support</h2><p className="mt-1 text-xs text-muted-foreground">Les champs détaillés permettent à l’équipe de traiter ta demande sans aller-retour inutile.</p></div>
          {sentTicket ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
            <Ticket className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="mt-2 font-bold">Demande enregistrée</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ton numéro de suivi :</p><p className="mt-2 font-mono text-lg font-bold">{sentTicket.number}</p>
            <p className="mt-2 text-xs text-muted-foreground">Retrouve son statut et les réponses dans « Mes demandes ».</p>
            <Button className="mt-4" variant="outline" onClick={resetForm}>Créer une autre demande</Button>
          </div> : <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-sm font-medium">Domaine</label><Select value={category} onValueChange={(value) => { setCategory(value); setTopic(''); setSubject(''); setSentTicket(null); }}><SelectTrigger><SelectValue placeholder="Sélectionner un domaine" /></SelectTrigger><SelectContent>{supportCategories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Sujet précis</label><Select value={topic} onValueChange={(value) => { setTopic(value); const found = selectedCategory?.topics.find((item) => item.value === value); if (found) setSubject(found.label); }} disabled={!selectedCategory}><SelectTrigger><SelectValue placeholder="Choisir le sujet" /></SelectTrigger><SelectContent>{selectedCategory?.topics.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {selectedTopic && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{selectedTopic.description}</p>}
            <div className="space-y-1.5"><label className="text-sm font-medium">Objet de la demande</label><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Résume le problème en une phrase" maxLength={160} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-sm font-medium">Référence commande / transaction (facultatif)</label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex. numéro de commande ou transaction" maxLength={120} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Priorité</label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normale</SelectItem><SelectItem value="high">Élevée</SelectItem><SelectItem value="urgent">Urgente — fraude active ou sécurité</SelectItem><SelectItem value="low">Faible</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Adresse e-mail de contact (facultatif)</label><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="exemple@email.com" maxLength={254} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Description détaillée</label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explique ce qui s’est passé, les étapes déjà effectuées et le résultat attendu. N’inclus jamais ton mot de passe, code OTP ou code PIN." className="min-h-36 resize-y" maxLength={10000} /><p className="text-right text-xs text-muted-foreground">{description.length}/10 000</p></div>
            <div className="space-y-2"><label className="text-sm font-medium">Pièces justificatives (facultatif)</label><div className="rounded-xl border border-dashed border-border p-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-primary"><Paperclip className="h-4 w-4" /> Ajouter des fichiers<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!user || sending} onChange={(event) => { const chosen = Array.from(event.target.files ?? []); setAttachments((current) => [...current, ...chosen].slice(0, 5)); event.target.value = ''; }} /></label><p className="mt-1 text-xs text-muted-foreground">5 fichiers maximum · JPG, PNG, WebP ou PDF · 10 Mo maximum chacun. Les fichiers restent privés.</p>{attachments.length > 0 && <ul className="mt-3 space-y-2">{attachments.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} Mo</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></li>)}</ul>}</div></div>
            {params.get('dispute_id') && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Ce ticket sera relié au litige sélectionné. Le support pourra suivre le dossier sans modifier automatiquement les fonds ou le statut du litige.</p>}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>Afrixa ne te demandera jamais ton mot de passe, ton code OTP ou ton code PIN Mobile Money. Pour une fraude, conserve les preuves et ne verse aucun paiement supplémentaire hors plateforme.</span></div>
            <Button className="w-full" onClick={() => void submitTicket()} disabled={sending || !user}><span className="inline-flex items-center gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? 'Envoi en cours…' : 'Envoyer ma demande'}</span></Button>
            {!user && <p className="text-center text-xs text-muted-foreground">Connecte-toi pour envoyer une demande et suivre son traitement.</p>}
          </div>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><div><h2 className="font-bold">Mes demandes</h2><p className="text-xs text-muted-foreground">Les 10 derniers tickets et les réponses du support.</p></div><Button size="icon" variant="ghost" onClick={() => void loadTickets()} disabled={loadingTickets}><RefreshCw className={cn('h-4 w-4', loadingTickets && 'animate-spin')} /></Button></div>
          {!user ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Connecte-toi pour consulter tes demandes.</p> : loadingTickets ? <p className="p-4 text-center text-sm text-muted-foreground">Chargement…</p> : tickets.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Aucune demande pour le moment.</p> : <div className="space-y-2">{tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-mono text-xs text-primary">{ticket.ticket_number}</p><h3 className="mt-1 text-sm font-semibold">{ticket.subject}</h3><p className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString('fr-FR')} · {priorityLabels[ticket.priority] ?? 'Normale'}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{statusLabels[ticket.status] ?? ticket.status}</span></div>{ticket.admin_reply && <div className="mt-3 rounded-lg bg-primary/5 p-3"><p className="text-xs font-semibold text-primary">Réponse du support</p><p className="mt-1 whitespace-pre-wrap text-sm">{ticket.admin_reply}</p></div>}</article>)}</div>}
        </section>

        <section id="support-faq" className="scroll-mt-20 space-y-3">
          <div><h2 className="font-bold">Questions fréquentes</h2><p className="text-xs text-muted-foreground">Des réponses rapides aux problèmes les plus courants.</p></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Rechercher dans les questions…" className="pl-9" /></div>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{filteredFaq.map((item) => <div key={item.question}><button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpenFaq(openFaq === item.question ? null : item.question)}><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">{item.category}</span><span className="mt-0.5 block text-sm font-medium">{item.question}</span></span><ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', openFaq === item.question && 'rotate-180')} /></button>{openFaq === item.question && <p className="bg-muted/30 px-3 pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>}</div>)}</div>
          {filteredFaq.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Aucune réponse trouvée.</p>}
        </section>

        <section className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Contacter directement Afrixa</h2><p className="text-xs text-muted-foreground">Pour les demandes générales qui ne nécessitent pas un ticket.</p></div></div>
          <a href="mailto:support@afrixa.com" className="mt-3 inline-flex text-sm font-semibold text-primary underline underline-offset-4">support@afrixa.com</a>
          <p className="mt-2 text-xs text-muted-foreground">Pour un litige, une fraude ou un paiement, privilégie la création d’un ticket afin de conserver un numéro de suivi.</p>
        </section>
      </div>
    </main>
  );
};

export default HelpSupport;
