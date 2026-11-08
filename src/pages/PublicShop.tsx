import { useEffect,useMemo,useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { ArrowLeft,Store,MapPin,Package,Search,Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { ProductBottomSheet } from '@/components/marketplace/ProductBottomSheet';
import type { Product } from '@/types/marketplace';

type Seller={user_id:string;username:string|null;prenom:string|null;nom:string|null;avatar_url:string|null;bio:string|null};
type ProductRow={id:string;name:string;description:string|null;category:string;price:number;promo_price:number|null;currency:string;product_type:'physical'|'digital';seller_id:string;stock:number|null;unlimited_stock:boolean|null;images:string[]|null;city:string|null;country:string|null;sales_count:number|null;created_at:string};

const PublicShop=()=>{
 const navigate=useNavigate();const {username=''}=useParams<{username:string}>();
 const [seller,setSeller]=useState<Seller|null>(null);const [products,setProducts]=useState<(Product & {images:string[]})[]>([]);
 const [selected,setSelected]=useState<(Product & {images:string[]})|null>(null);const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{
  setLoading(true);setError(null);
  try{
   const {data:profile,error:profileError}=await supabase.from('profiles').select('user_id,username,prenom,nom,avatar_url,bio').eq('username',username.replace(/^@/,'')).maybeSingle();
   if(profileError)throw profileError;if(!profile){if(active){setSeller(null);setProducts([]);setError('Cette boutique est introuvable.')}return}
   const {data:rows,error:productsError}=await supabase.from('products').select('id,name,description,category,price,promo_price,currency,product_type,seller_id,stock,unlimited_stock,images,city,country,sales_count,created_at').eq('seller_id',profile.user_id).eq('is_active',true).eq('publication_status','published').eq('moderation_status','approved').is('deleted_at',null).order('created_at',{ascending:false}).range(0,199);
   if(productsError)throw productsError;if(!active)return;
   const sellerName=[profile.prenom,profile.nom].filter(Boolean).join(' ')||profile.username||'Boutique Afrixa';
   setSeller(profile as Seller);setProducts(((rows||[]) as ProductRow[]).map(row=>({id:row.id,name:row.name,description:row.description||'',price:row.promo_price&&row.promo_price>0&&row.promo_price<row.price?row.promo_price:row.price,currency:row.currency||'XOF',imageUrl:row.images?.[0]||'/placeholder.svg',images:row.images||[],category:row.category,sellerId:row.seller_id,sellerName,sellerAvatar:profile.avatar_url||'/placeholder.svg',sellerVerified:false,stock:row.stock??0,city:row.city||'',country:row.country||'',views:0,sales:row.sales_count||0,rating:null,createdAt:row.created_at,productType:row.product_type,promoPrice:row.promo_price,unlimitedStock:row.unlimited_stock??false})));
  }catch(e){console.error('Public shop load failed',e);if(active)setError('Impossible de charger cette boutique. Réessayez plus tard.')}finally{if(active)setLoading(false)}
 };void load();return()=>{active=false}},[username]);
 const filtered=useMemo(()=>{const term=search.trim().toLocaleLowerCase();return term?products.filter(p=>p.name.toLocaleLowerCase().includes(term)||p.category.toLocaleLowerCase().includes(term)):products},[products,search]);
 const sellerName=seller?([seller.prenom,seller.nom].filter(Boolean).join(' ')||seller.username||'Boutique Afrixa'):'Boutique';
 return <div className="min-h-screen bg-background pb-20">
  <header className="sticky top-0 z-40 border-b border-border/30 bg-background/90 backdrop-blur-xl"><div className="flex items-center gap-3 px-4 py-3"><button type="button" onClick={()=>navigate(-1)} aria-label="Retour" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Boutique Afrixa</p><h1 className="truncate text-base font-bold text-foreground">{sellerName}</h1></div><Store className="h-5 w-5 text-primary"/></div></header>
  {loading?<div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Chargement de la boutique…</div>:error?<div className="px-6 py-20 text-center text-sm text-muted-foreground">{error}</div>:seller&&<>
   <section className="border-b border-border/20 bg-gradient-to-b from-primary/10 to-transparent px-4 py-6"><div className="flex items-center gap-3"><img src={seller.avatar_url||'/placeholder.svg'} alt={sellerName} className="h-16 w-16 rounded-2xl border border-border/40 object-cover"/><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-foreground">{sellerName}</h2><p className="text-xs text-muted-foreground">@{seller.username}</p><div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5"/>{products.length} produit(s)</div></div></div>{seller.bio&&<p className="mt-4 text-sm leading-6 text-muted-foreground">{seller.bio}</p>}{products[0]?.city&&<p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5"/>{[products[0].city,products[0].country].filter(Boolean).join(', ')}</p>}</section>
   <section className="px-3 py-4 sm:px-4"><div className="mb-4 flex items-center gap-2"><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-foreground">Découvrir les produits</h2><p className="text-xs text-muted-foreground">Sélection de la boutique</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{filtered.length}</span></div><label className="mb-4 flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2.5"><Search className="h-4 w-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher dans cette boutique" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"/></label>{filtered.length?<div className="grid grid-cols-2 gap-2.5 sm:gap-4">{filtered.map(p=><ProductCard key={p.id} product={p} onView={setSelected}/>)}</div>:<div className="py-16 text-center text-sm text-muted-foreground">Aucun produit ne correspond à votre recherche.</div>}</section>
  </>}
  {selected&&<ProductBottomSheet product={{id:selected.id,name:selected.name,description:selected.description,price:selected.price,currency:selected.currency,imageUrl:selected.imageUrl,images:selected.images,sellerName:selected.sellerName,sellerId:selected.sellerId,sellerVerified:selected.sellerVerified,productType:selected.productType,stock:selected.stock,city:selected.city,country:selected.country}} onClose={()=>setSelected(null)}/>}
 </div>
};
export default PublicShop;
