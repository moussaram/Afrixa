import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const AdsManager = () => (
  <main className="min-h-screen bg-background px-4 pb-24 pt-8">
    <h1 className="flex items-center gap-2 text-2xl font-black"><Megaphone className="h-6 w-6 text-primary" /> Publicite Afrixa</h1>
    <section className="mt-6 space-y-3 rounded-3xl border border-border bg-card p-4">
      <Input placeholder="Nom annonceur" />
      <Input placeholder="Email annonceur" />
      <Input placeholder="Titre campagne" />
      <Textarea placeholder="Description" />
      <Input type="number" placeholder="Budget FCFA" />
      <Button className="h-12 w-full rounded-2xl">Creer la campagne</Button>
    </section>
  </main>
);

export default AdsManager;
