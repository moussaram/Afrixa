import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Building2, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type RequestRow = { id:string; status:string; entity_type:string; legal_name:string; public_name:string; decision_reason:string|null; submitted_at:string };
const labels:Record<string,string> = { payment_pending:'Paiement en attente',active:'Abonnement actif',submitted:'Dossier transmis',under_review:'En cours d’examen',needs_information:'Complément demandé',approved:'Vérification approuvée',rejected:'Demande refusée',expired:'Abonnement expiré',revoked:'Vérification retirée' };

export default function BusinessVerification() {
  const navigate = useNavigate();
  const [params,setParams] = useSearchParams();
  const { user } = useAuth();
  const [plan,setPlan] = useState<{amount_xof:number;duration_days:number}|null>(null);
  const [subscription,setSubscription] = useState<any>(null);
  const [request,setRequest] = useState<RequestRow|null>(null);
  const [reviewer,setReviewer] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [entityType,setEntityType] = useState<'company'|'shop'>('company');
  const [fields,setFields] = useState({legal_name:'',public_name:'',country:'BJ',registration_number:'',tax_number:'',address:'',phone:'',website:'',note:''});
  const [files,setFiles] = useState<File[]>([]);
  const [consent,setConsent] = useState(false);
  const [message,setMessage] = useState('');
  const set = (key:string,value:string) => setFields(v=>({...v,[key]:value}));
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const {data,error} = await supabase.functions.invoke('business-verification',{body:{action:'status'}});
    if (error || data?.error) toast.error('Impossible de charger le statut de vérification commerciale.');
    else {
      setPlan(data.plan ?? null);
      setSubscription((data.subscriptions ?? []).find((s:any)=>s.status==='active' && s.expires_at && new Date(s.expires_at)>new Date()) ?? data.subscriptions?.[0] ?? null);
      setRequest(data.requests?.[0] ?? null);
      setReviewer(Boolean(data.reviewer_role));
    }
    setLoading(false);
  },[user]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const id=params.get('subscription_id');
    if(params.get('payment')!=='return'||!id)return;
    let cancelled=false;
    void (async()=>{
      setMessage('Vérification du paiement auprès de FedaPay…');
      const {data,error}=await supabase.functions.invoke('business-verification',{body:{action:'verify_payment',subscription_id:id}});
      if(cancelled)return;
      setMessage(error?'Paiement non confirmé pour le moment. Réessaie dans quelques instants.':data?.verified?'Paiement confirmé. Tu peux déposer ton dossier.':'Paiement en attente de confirmation.');
      if(data?.verified) await load();
      const next=new URLSearchParams(params);next.delete('payment');setParams(next,{replace:true});
    })();
    return ()=>{cancelled=true;};
  },[params,setParams,load]);
  const checkout = async()=>{
    setBusy(true);
    try {
      const {data,error}=await supabase.functions.invoke('business-verification',{body:{action:'create_checkout'}});
      if(error||!data?.checkout_url)throw new Error(data?.error??'Paiement indisponible');
      window.location.assign(data.checkout_url);
    }catch(e:any){toast.error(e?.message??'Impossible de lancer le paiement.');setBusy(false);}
  };
  const submit = async()=>{
    if(!subscription || files.length<1 || files.length>4 || !consent){toast.error('Vérifie le paiement, les pièces et le consentement.');return;}
    if(files.some(f=>!['image/jpeg','image/png','application/pdf'].includes(f.type)||f.size>10*1024*1024)||files.reduce((n,f)=>n+f.size,0)>30*1024*1024){toast.error('1 à 4 fichiers JPG, PNG ou PDF, 10 Mo chacun (30 Mo au total).');return;}
    setBusy(true);
    const folder=crypto.randomUUID();const paths:string[]=[];
    try{
      for(const [i,file] of files.entries()){
        const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
        const path=user!.id+'/'+folder+'/'+(i+1)+'-'+name;
        const {error}=await supabase.storage.from('business-verification-documents').upload(path,file,{contentType:file.type,upsert:false});
        if(error)throw error;paths.push(path);
      }
      const {data,error}=await supabase.functions.invoke('business-verification',{body:{
        action:'submit_request',subscription_id:subscription.id,entity_type:entityType,legal_name:fields.legal_name,
        public_name:fields.public_name,registration_country:fields.country,registration_number:fields.registration_number,
        tax_number:fields.tax_number,business_address:fields.address,contact_phone:fields.phone,website_url:fields.website,
        applicant_note:fields.note,document_paths:paths,consent:true,
      }});
      if(error||data?.error)throw new Error(data?.error??error?.message??'Dossier non transmis');
      toast.success('Dossier transmis à l’équipe Afrixa.');setFiles([]);setConsent(false);await load();
    }catch(e:any){toast.error(e?.message??'Impossible de transmettre le dossier.');if(paths.length)await supabase.storage.from('business-verification-documents').remove(paths);}
    finally{setBusy(false);}
  };
  const active=subscription?.status==='active'&&subscription.expires_at&&new Date(subscription.expires_at)>new Date();
  const canSubmit=active&&(!request||request.status==='needs_information'||request.status==='rejected'||request.status==='approved');
  return <main className="min-h-screen bg-background px-4 pb-24 pt-5"><div className="mx-auto max-w-xl">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={()=>navigate(-1)}><ArrowLeft/></Button><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Afrixa · Niveau 3</p><h1 className="text-2xl font-black">Entreprise / boutique vérifiée</h1></div></div>
    {reviewer&&<Button className="mt-4 w-full" variant="outline" onClick={()=>navigate('/business-verification/admin')}>Ouvrir l’espace d’examen Afrixa</Button>}
    <section className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-5"><div className="flex items-center gap-3"><BadgeCheck className="h-9 w-9 text-primary"/><div><h2 className="font-bold">Un badge commercial officiel</h2><p className="text-sm text-muted-foreground">Confirme qu’une entreprise ou une boutique a été examinée par l’équipe Afrixa.</p></div></div>
      <p className="mt-4 text-2xl font-black">{plan?.amount_xof?.toLocaleString('fr-FR')??'5 000'} FCFA <span className="text-sm font-medium text-muted-foreground">/ 12 mois</span></p>
      <p className="mt-1 text-xs text-muted-foreground">Renouvellement manuel. Le paiement couvre l’examen du dossier et ne garantit pas l’approbation.</p>
      {!active&&<Button className="mt-4 w-full" disabled={busy||loading} onClick={()=>void checkout()}>{busy?'Ouverture…':'Payer et commencer la vérification'}</Button>}
    </section>
    {message&&<p className="mt-3 rounded-xl bg-muted p-3 text-sm">{message}</p>}
    {request&&<section className="mt-4 rounded-xl border p-4"><p className="font-semibold">{labels[request.status]??request.status}</p><p className="mt-1 text-sm text-muted-foreground">{request.public_name} · {request.entity_type==='company'?'Entreprise':'Boutique'}</p>{request.decision_reason&&<p className="mt-2 text-sm">{request.decision_reason}</p>}</section>}
    {active&&<section className="mt-5 space-y-4 rounded-2xl border p-4"><div><h2 className="font-bold">Constituer le dossier commercial</h2><p className="text-sm text-muted-foreground">Prépare les justificatifs officiels de l’activité et la preuve que tu représentes ou contrôles cette entreprise/boutique.</p></div>
      <div className="flex gap-2"><Button type="button" variant={entityType==='company'?'default':'outline'} onClick={()=>setEntityType('company')}><Building2 className="mr-2 h-4 w-4"/>Entreprise</Button><Button type="button" variant={entityType==='shop'?'default':'outline'} onClick={()=>setEntityType('shop')}><Store className="mr-2 h-4 w-4"/>Boutique</Button></div>
      <div className="space-y-1"><Label>Nom légal / nom du propriétaire</Label><Input value={fields.legal_name} onChange={e=>set('legal_name',e.target.value)} maxLength={180}/></div>
      <div className="space-y-1"><Label>Nom public de l’entreprise ou boutique</Label><Input value={fields.public_name} onChange={e=>set('public_name',e.target.value)} maxLength={100}/></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Pays (code ISO)</Label><Input value={fields.country} onChange={e=>set('country',e.target.value.toUpperCase())} maxLength={2}/></div><div className="space-y-1"><Label>RCCM / registre</Label><Input value={fields.registration_number} onChange={e=>set('registration_number',e.target.value)} maxLength={100}/></div></div>
      <div className="space-y-1"><Label>IFU / identifiant fiscal (si applicable)</Label><Input value={fields.tax_number} onChange={e=>set('tax_number',e.target.value)} maxLength={100}/></div>
      <div className="space-y-1"><Label>Adresse professionnelle</Label><Input value={fields.address} onChange={e=>set('address',e.target.value)} maxLength={300}/></div>
      <div className="space-y-1"><Label>Téléphone professionnel</Label><Input value={fields.phone} onChange={e=>set('phone',e.target.value)} maxLength={30}/></div>
      <div className="space-y-1"><Label>Site ou lien de boutique (facultatif)</Label><Input value={fields.website} onChange={e=>set('website',e.target.value)} maxLength={300}/></div>
      <div className="space-y-1"><Label>Note à l’équipe (facultatif)</Label><Textarea value={fields.note} onChange={e=>set('note',e.target.value)} maxLength={1000}/></div>
      <div className="space-y-1"><Label>Justificatifs (1 à 4 fichiers, JPG/PNG/PDF)</Label><Input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFiles(Array.from(e.target.files??[]))}/><p className="text-xs text-muted-foreground">Exemples : RCCM ou équivalent, IFU si disponible, autorisation ou preuve de contrôle de la boutique. 10 Mo par fichier.</p></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>J’autorise Afrixa à examiner ces informations et justificatifs pour vérifier mon entreprise ou ma boutique. Les pièces restent privées et leur suppression est prévue 90 jours après la décision finale.</span></label>
      <Button className="w-full" disabled={busy||!canSubmit||!consent} onClick={()=>void submit()}>{busy?'Transmission…':'Envoyer le dossier à Afrixa'}</Button>
    </section>}
    {loading&&<p className="mt-5 text-center text-sm text-muted-foreground">Chargement…</p>}
    <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/>Les justificatifs ne sont jamais affichés publiquement. Le badge n’est attribué qu’après examen humain et reste lié à la durée de validité.</div>
  </div></main>;
}
