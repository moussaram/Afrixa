import { Gem, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

const packs = [
  ['Starter', 100, 500, '0%'],
  ['Basic', 550, 2000, '+10%'],
  ['Popular', 1300, 3500, '+30%'],
  ['Pro', 3750, 7500, '+50%'],
  ['Elite', 9000, 12000, '+80%'],
] as const;

const gifts = [
  ['Rose', 10],
  ['Coeur', 50],
  ['Diamant', 200],
  ['Lion', 500],
  ['Couronne', 1000],
  ['Fusee', 2000],
] as const;

const Coins = () => (
  <main className="min-h-screen bg-background px-4 pb-24 pt-8">
    <h1 className="text-2xl font-black">Afrixa Coins</h1>
    <section className="mt-5 grid grid-cols-2 gap-3">
      {packs.map(([name, coins, price, bonus]) => (
        <article key={name} className="rounded-2xl border border-border bg-card p-4">
          <Gem className="mb-3 h-6 w-6 text-primary" />
          <h2 className="font-black">{name}</h2>
          <p className="text-xl font-black">{coins} coins</p>
          <p className="text-xs text-muted-foreground">{price.toLocaleString()} FCFA | {bonus}</p>
          <Button size="sm" className="mt-3 w-full">Acheter</Button>
        </article>
      ))}
    </section>
    <h2 className="mt-8 text-lg font-black">Cadeaux virtuels</h2>
    <section className="mt-3 space-y-2">
      {gifts.map(([name, price]) => (
        <div key={name} className="flex items-center justify-between rounded-2xl bg-card p-4">
          <span className="flex items-center gap-2 font-bold"><Gift className="h-5 w-5 text-primary" /> {name}</span>
          <span className="text-sm text-muted-foreground">{price} coins</span>
        </div>
      ))}
    </section>
  </main>
);

export default Coins;
