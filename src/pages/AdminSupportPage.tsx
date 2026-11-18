import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type SupportTicket = {
  id: string; user_id: string; ticket_number: string; category: string; topic: string;
  subject: string; message: string; priority: string; status: string; order_reference: string | null;
  contact_email: string | null; admin_reply: string | null; created_at: string;
};

const statusLabels: Record<string, string> = {
  new: 'Nouveau', in_progress: 'En cours', waiting_customer: 'En attente du client',
  resolved: 'Résolu', closed: 'Clôturé',
};
const priorityLabels: Record<string, string> = { low: 'Faible', normal: 'Normale', high: 'Élevée', urgent: 'Urgente' };

const AdminSupportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const userId = user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('help_messages')
      .select('id,user_id,ticket_number,category,topic,subject,message,priority,status,order_reference,contact_email,admin_reply,created_at')
      .order('created_at', { ascending: true }).limit(150);
    if (filter === 'active') query = query.in('status', ['new', 'in_progress', 'waiting_customer', 'non_lu', 'lu']);
    else query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) {
      console.error('Support queue load failed', error);
      toast.error('Impossible de charger la file du support.');
      setItems([]);
    } else {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const rows = (data ?? []) as SupportTicket[];
      setItems([...rows].sort((left, right) =>
        (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2)
        || new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      ));
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (!userId) { setAllowed(false); setLoading(false); return; }
    void (async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error || data !== true) { setAllowed(false); setLoading(false); return; }
      setAllowed(true);
      await load();
    })();
  }, [userId, load]);

  const saveReply = async (item: SupportTicket) => {
    const reply = (replies[item.id] ?? item.admin_reply ?? '').trim();
    if (reply.length < 3) return toast.error('Écris une réponse avant de l’envoyer.');
    const nextStatus = statuses[item.id] ?? 'waiting_customer';
    setWorkingId(item.id);
    const { error } = await supabase.from('help_messages').update({
      admin_reply: reply,
      status: nextStatus,
    }).eq('id', item.id);
    if (error) {
      console.error('Support reply failed', error);
      toast.error('La réponse n’a pas pu être enregistrée.');
    } else {
      toast.success('Réponse envoyée au demandeur.');
      await load();
    }
    setWorkingId(null);
  };

  const updateStatus = async (item: SupportTicket, status: string) => {
    setWorkingId(item.id);
    const { error } = await supabase.from('help_messages').update({ status }).eq('id', item.id);
    if (error) toast.error('Impossible de modifier le statut.');
    else { toast.success('Statut mis à jour.'); await load(); }
    setWorkingId(null);
  };

  if (allowed === false) return <main className="min-h-screen bg-background p-6"><div className="mx-auto max-w-md rounded-2xl border border-border p-6 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-3 font-bold">Accès réservé</h1><p className="mt-2 text-sm text-muted-foreground">Cette file est accessible uniquement aux administrateurs Afrixa.</p><Button className="mt-4" variant="outline" onClick={() => navigate(-1)}>Retour</Button></div></main>;

  return <main className="min-h-screen bg-background px-4 pb-20 pt-5">
    <header className="mx-auto flex max-w-5xl items-center gap-3"><Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button><div className="min-w-0 flex-1"><h1 className="text-xl font-black">Support client Afrixa</h1><p className="text-xs text-muted-foreground">File des demandes, réponses et suivi</p></div><Button size="icon" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></header>
    <div className="mx-auto mt-5 flex max-w-5xl flex-wrap gap-2">{[['active','À traiter'],['resolved','Résolus'],['closed','Clôturés']].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{label}</button>)}</div>
    <section className="mx-auto mt-4 max-w-5xl space-y-4">
      {loading && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Chargement des tickets…</p>}
      {!loading && items.length === 0 && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Aucun ticket dans cette catégorie.</p>}
      {!loading && items.map((item) => <article key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-mono text-xs text-primary">{item.ticket_number}</p><h2 className="mt-1 font-bold">{item.subject}</h2><p className="mt-1 text-xs text-muted-foreground">{item.category} / {item.topic} · {new Date(item.created_at).toLocaleString('fr-FR')}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">Utilisateur : {item.user_id}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{priorityLabels[item.priority] ?? item.priority}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{statusLabels[item.status] ?? item.status}</span></div></div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
        {(item.order_reference || item.contact_email) && <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{item.order_reference && <p>Référence : {item.order_reference}</p>}{item.contact_email && <p>Contact : {item.contact_email}</p>}</div>}
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><div className="space-y-1.5"><label className="text-xs font-semibold">Réponse au client</label><Textarea value={replies[item.id] ?? item.admin_reply ?? ''} onChange={(event) => setReplies((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Rédige une réponse claire et précise…" className="min-h-24" maxLength={5000} /></div><div className="space-y-2"><label className="text-xs font-semibold">Statut après réponse</label><Select value={statuses[item.id] ?? (item.status === 'new' ? 'in_progress' : item.status)} onValueChange={(value) => setStatuses((current) => ({ ...current, [item.id]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="waiting_customer">En attente du client</SelectItem><SelectItem value="resolved">Résolu</SelectItem><SelectItem value="closed">Clôturé</SelectItem></SelectContent></Select><Button className="w-full" disabled={workingId === item.id} onClick={() => void saveReply(item)}><Send className="mr-2 h-4 w-4" />Envoyer la réponse</Button><Button className="w-full" variant="outline" disabled={workingId === item.id} onClick={() => void updateStatus(item, 'in_progress')}>Prendre en charge</Button></div></div>
        {item.admin_reply && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold text-primary">Dernière réponse enregistrée</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.admin_reply}</p></div>}
      </article>)}
    </section>
  </main>;
};

export default AdminSupportPage;
