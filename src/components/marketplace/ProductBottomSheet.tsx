import { useState } from 'react';
import { X, ShoppingCart, ChevronLeft, ChevronRight, MapPin, Package } from 'lucide-react';
import { AfrixaPayment } from '@/components/payment/AfrixaPayment';

interface ProductBottomSheetProps {
  product: { id?: string; name: string; description?: string; price: number; currency: string; imageUrl: string; images?: string[]; sellerName: string; sellerId?: string; sellerVerified?: boolean; productType?: 'physical' | 'digital'; stock?: number; city?: string; country?: string };
  onClose: () => void;
}

export const ProductBottomSheet = ({ product, onClose }: ProductBottomSheetProps) => {
  const [showPayment, setShowPayment] = useState(false);
  const gallery = Array.from(new Set([...(product.images || []), product.imageUrl].filter(Boolean)));
  const [activeImage, setActiveImage] = useState(0);
  const moveImage = (direction: -1 | 1) => setActiveImage(index => (index + direction + gallery.length) % gallery.length);
  if (showPayment) return <AfrixaPayment product={product} onClose={onClose} />;
  return <>
    <button type="button" aria-label="Fermer l’aperçu" className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
    <section role="dialog" aria-modal="true" aria-label={`Aperçu de ${product.name}`} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[94dvh] max-w-2xl overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background shadow-2xl animate-slide-up">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-background/95 px-4 py-3 backdrop-blur"><div><p className="text-xs text-muted-foreground">Aperçu du produit</p><h3 className="font-semibold text-foreground">{product.productType === 'digital' ? 'Produit numérique' : 'Produit physique'}</h3></div><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full bg-muted p-2"><X className="h-5 w-5" /></button></div>
      <div className="px-4 pb-28 pt-3">
        <div className="relative overflow-hidden rounded-2xl bg-muted"><div className="aspect-square w-full"><img src={gallery[activeImage] || '/placeholder.svg'} alt={product.name} className="h-full w-full object-contain" /></div>
          {gallery.length > 1 && <><button type="button" onClick={() => moveImage(-1)} aria-label="Photo précédente" className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 shadow"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => moveImage(1)} aria-label="Photo suivante" className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 shadow"><ChevronRight className="h-5 w-5" /></button><span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">{activeImage+1} / {gallery.length}</span></>}
        </div>
        {gallery.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{gallery.map((image,index)=><button key={image} type="button" onClick={()=>setActiveImage(index)} aria-label={`Afficher la photo ${index+1}`} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${activeImage===index?'border-primary':'border-transparent'}`}><img src={image} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        <div className="mt-4"><p className="text-2xl font-extrabold tracking-tight text-primary">{product.price.toLocaleString('fr-FR')} {product.currency}</p><h2 className="mt-2 text-lg font-bold leading-snug text-foreground">{product.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-2.5 py-1">{product.productType==='digital'?'Numérique':'Physique'}</span>{product.productType==='digital'?<span>Téléchargement après paiement</span>:<span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{(product.stock??0)>0?`${product.stock} disponible(s)`:'Stock indisponible'}</span>}{(product.city||product.country)&&<span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[product.city,product.country].filter(Boolean).join(', ')}</span>}</div></div>
        <div className="my-5 border-t border-border/30" /><h3 className="text-sm font-bold text-foreground">Description du produit</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{product.description?.trim()||'Aucune description fournie par le vendeur.'}</p>
        <div className="mt-5 rounded-2xl border border-border/30 bg-card/40 p-3"><p className="text-xs text-muted-foreground">Vendu par</p><p className="mt-1 font-semibold text-foreground">{product.sellerName}</p></div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-border/30 bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur"><button type="button" onClick={()=>setShowPayment(true)} disabled={product.productType!=='digital'&&(product.stock??0)<=0} className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart className="h-5 w-5" />{product.productType!=='digital'&&(product.stock??0)<=0?'Rupture de stock':'Acheter ce produit'}</button></div>
    </section>
  </>;
};
