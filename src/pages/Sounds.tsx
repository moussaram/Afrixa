import { Music, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const sounds = [
  { id: '1', title: 'Afrobeats sunset', artist: 'Afrixa Sounds', category: 'Afrobeats', uses: 12800 },
  { id: '2', title: 'Coupe-decale club', artist: 'DJ Babi', category: 'Coupe-Decale', uses: 8400 },
  { id: '3', title: 'Zouglou mood', artist: 'Studio Abidjan', category: 'Zouglou', uses: 5200 },
];

const Sounds = () => (
  <main className="min-h-screen bg-background px-4 pb-24 pt-8">
    <h1 className="text-2xl font-black">Sons</h1>
    <Input className="mt-4 h-12 rounded-2xl" placeholder="Rechercher titre, artiste, categorie" />
    <section className="mt-6 space-y-3">
      {sounds.map(sound => (
        <article key={sound.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Music className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold">{sound.title}</h2>
            <p className="truncate text-xs text-muted-foreground">{sound.artist} | {sound.category} | {sound.uses.toLocaleString()} utilisations</p>
          </div>
          <Button size="icon" variant="outline"><Play className="h-4 w-4" /></Button>
        </article>
      ))}
    </section>
  </main>
);

export default Sounds;
