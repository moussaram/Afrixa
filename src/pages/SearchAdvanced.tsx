import { useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clearSearchHistory, getSearchHistory, pushSearchHistory, searchAll } from '@/lib/search';

type SearchItem = { id: string; title?: string; name?: string; username?: string };
type SearchResults = Record<'videos' | 'users' | 'products' | 'challenges' | 'sounds', SearchItem[]>;

const SearchAdvanced = () => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const [results, setResults] = useState<SearchResults>({ videos: [], users: [], products: [], challenges: [], sounds: [] });

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!query.trim()) return;
      pushSearchHistory(query);
      setHistory(getSearchHistory());
      setResults(await searchAll(query));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-8">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} className="h-12 rounded-2xl pl-10" placeholder="Videos, utilisateurs, produits, challenges, sons" />
      </div>
      {!query && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-black">Recherches recentes</h1>
            <Button variant="ghost" size="sm" onClick={() => { clearSearchHistory(); setHistory([]); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Effacer
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map(item => <button key={item} onClick={() => setQuery(item)} className="rounded-full bg-muted px-3 py-2 text-sm">{item}</button>)}
          </div>
        </section>
      )}
      {query && (
        <Tabs defaultValue="videos" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="products">Shop</TabsTrigger>
            <TabsTrigger value="challenges">Defis</TabsTrigger>
            <TabsTrigger value="sounds">Sons</TabsTrigger>
          </TabsList>
          {Object.keys(results).map(key => (
            <TabsContent key={key} value={key} className="space-y-2">
              {(results[key as keyof SearchResults] ?? []).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun resultat</p> : results[key as keyof SearchResults].map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card p-4 text-sm">{item.title || item.name || item.username || item.id}</div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </main>
  );
};

export default SearchAdvanced;
