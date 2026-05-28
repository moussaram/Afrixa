import { Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Premium = () => (
  <main className="min-h-screen bg-background px-4 pb-24 pt-10">
    <div className="mx-auto max-w-md">
      <Crown className="mb-5 h-12 w-12 text-primary" />
      <h1 className="text-3xl font-black">Afrixa Premium</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sans pubs, badge premium, statistiques avancees et telechargements illimites.</p>
      <div className="mt-8 grid gap-4">
        {[
          { plan: 'Mensuel', price: '1 000 FCFA/mois', bonus: 'Flexible' },
          { plan: 'Annuel', price: '8 000 FCFA/an', bonus: '2 mois offerts' },
        ].map(item => (
          <article key={item.plan} className="rounded-3xl border border-primary/30 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{item.plan}</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{item.bonus}</span>
            </div>
            <p className="mt-2 text-2xl font-black">{item.price}</p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Pas de pubs</li>
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary" /> Badge Premium</li>
              <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Stats avancees</li>
            </ul>
            <Button className="mt-5 h-12 w-full rounded-2xl">Souscrire</Button>
          </article>
        ))}
      </div>
    </div>
  </main>
);

export default Premium;
