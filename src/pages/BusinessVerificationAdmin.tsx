import { useCallback,useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft,FileText,RefreshCw,ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type Row={id:string;user_id:string;status:string;entity_type:string;legal_name:string;public_name:string;registration_country:string;registration_number:string|null;tax_number:string|null;business_address:string;contact_phone:string;website_url:string|null;applicant_note:string|null;decision_reason:string|null;submitted_at:string};
export default function BusinessVerificationAdmin(){
 const navigate=useNavigate();const {user}=useAuth();
 const [allowed,setAllowed]=useState<boolean|null>(null);const [role,setRole]=useState('reviewer');
 const [rows,setRows]=useState<Row[]>([]);const [filter,setFilter]=useState('submitted');
 const [reason,setReason]=useState<Record<string,string>>({});const [notes,setNotes]=useState<Record<string,string>>({});
 const [docs,setDocs]=useState<Record<string,{index:number;document_url:string}[]>>({});const [busy,setBusy]=useState<string|null>(null);const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{if(!user)return;setLoading(true);const {data,error}=await supabase.functions.invoke('business-verification',{body:{action:'review_queue',status:filter}});
  if(error||data?.error){setAllowed(false);setRows([]);}else{setAllowed(true);setRole(data.reviewer_role??'reviewer');setRows(data.requests??[]);}setLoading(false);
 },[user,filter]);useEffect(()=>{void load();},[load]);
 const open=async(r:Row)=>{setBusy(r.id);const {data,error}=await supabase.functions.invoke('business-verification',{body:{action:'review_document',request_id:r.id}});
  if(error||data?.error)toast.error('Impossible de préparer les pièces privées.');else setDocs(v=>({...v,[r.id]:data.documents??[]}));setBusy(null);};
 const decide=async(r:Row,decision:string)=>{const why=(reason[r.id]??'').trim();if(['needs_information','rejected','revoked'].includes(decision)&&why.length<3){toast.error('Un motif est obligatoire.');return;}
  setBusy(r.id);const {data,error}=await supabase.functions.invoke('business-verification',{body:{action:'review_decide',request_id:r.id,decision,reason:why,internal_note:notes[r.id]??''}});
  if(error||data?.error)toast.error(data?.error??'Décision impossible.');else{toast.success('Décision enregistrée.');await load();}setBusy(null);};
 if(allowed===false)return <main className="min-h-screen bg-background p-6"><div className="mx-auto max-w-lg rounded-xl border p-6 text-center"><ShieldAlert className="mx-auto mb-3"/><h1 className="font-bold">Accès réservé</h1><p className="mt-2 text-sm text-muted-foreground">Ce compte n’est pas habilité à examiner les dossiers commerciaux.</p><Button className="mt-4" onClick={()=>navigate(-1)}>Retour</Button></div></main>;
 return <main className="min-h-screen bg-background px-4 pb-24 pt-6"><div className="mx-auto max-w-3xl">
  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={()=>navigate(-1)}><ArrowLeft/></Button><div><p className="text-xs uppercase tracking-wider text-primary">Afrixa · Équipe</p><h1 className="text-2xl font-black">Vérification commerciale</h1></div></div><Button variant="outline" size="icon" onClick={()=>void load()} disabled={loading}><RefreshCw/></Button></div>
  <div className="mt-5 flex flex-wrap gap-2">{[['submitted','Nouveaux'],['under_review','En examen'],['needs_information','Compléments'],['approved','Approuvés'],['rejected','Refusés'],['revoked','Retirés']].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={`rounded-full border px-3 py-2 text-xs ${filter===v?'border-primary bg-primary/10 text-primary':'border-border text-muted-foreground'}`}>{l}</button>)}</div>
  <section className="mt-4 space-y-4">{loading&&<p className="py-8 text-center">Chargement…</p>}{!loading&&!rows.length&&<p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Aucun dossier.</p>}
   {rows.map(r=><article key={r.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{r.public_name}</h2><p className="text-sm text-muted-foreground">{r.legal_name} · {r.entity_type==='company'?'Entreprise':'Boutique'} · {r.registration_country}</p><p className="mt-1 text-xs text-muted-foreground">Compte : {r.user_id}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{r.status}</span></div>
    <dl className="mt-3 grid grid-cols-1 gap-1 text-sm"><div>Registre : {r.registration_number||'Non renseigné'}</div><div>IFU : {r.tax_number||'Non renseigné'}</div><div>Adresse : {r.business_address}</div><div>Contact : {r.contact_phone}</div>{r.website_url&&<div>Lien : {r.website_url}</div>}</dl>
    {r.applicant_note&&<p className="mt-2 rounded-lg bg-muted/40 p-3 text-sm">{r.applicant_note}</p>}
    <div className="mt-3">{docs[r.id]?docs[r.id].map(d=><a key={d.index} href={d.document_url} target="_blank" rel="noreferrer" className="mr-2 inline-flex rounded-lg border px-3 py-2 text-sm text-primary"><FileText className="mr-2 h-4 w-4"/>Pièce {d.index}</a>):<Button size="sm" variant="outline" disabled={busy===r.id} onClick={()=>void open(r)}>Consulter les pièces privées</Button>}</div>
    {r.decision_reason&&<p className="mt-2 text-xs text-muted-foreground">Motif précédent : {r.decision_reason}</p>}
    {r.status==='approved'&&role==='supervisor'&&<div className="mt-3 space-y-2"><Textarea value={reason[r.id]??''} onChange={e=>setReason(v=>({...v,[r.id]:e.target.value}))} placeholder="Motif de révocation obligatoire"/><Button size="sm" variant="destructive" onClick={()=>void decide(r,'revoked')} disabled={busy===r.id}>Révoquer</Button></div>}
    {['submitted','under_review','needs_information'].includes(r.status)&&<div className="mt-3 space-y-2"><Textarea value={reason[r.id]??''} onChange={e=>setReason(v=>({...v,[r.id]:e.target.value}))} placeholder="Motif (obligatoire pour complément ou refus)"/><Textarea value={notes[r.id]??''} onChange={e=>setNotes(v=>({...v,[r.id]:e.target.value}))} placeholder="Note interne facultative"/><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void decide(r,'under_review')} disabled={busy===r.id}>Prendre en charge</Button><Button size="sm" variant="secondary" onClick={()=>void decide(r,'needs_information')} disabled={busy===r.id}>Demander un complément</Button><Button size="sm" onClick={()=>void decide(r,'approved')} disabled={busy===r.id}>Approuver</Button><Button size="sm" variant="destructive" onClick={()=>void decide(r,'rejected')} disabled={busy===r.id}>Refuser</Button></div></div>}
   </article>)}
  </section></div></main>;
}
