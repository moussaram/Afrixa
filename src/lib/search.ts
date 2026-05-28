import { supabase } from '@/integrations/supabase/client';
import { sanitizeText } from './validation';

const SEARCH_KEY = 'afrixa:search-history';

export const getSearchHistory = () => JSON.parse(localStorage.getItem(SEARCH_KEY) || '[]') as string[];

export const pushSearchHistory = (query: string) => {
  const clean = sanitizeText(query);
  if (!clean) return;
  const next = [clean, ...getSearchHistory().filter(item => item !== clean)].slice(0, 10);
  localStorage.setItem(SEARCH_KEY, JSON.stringify(next));
};

export const clearSearchHistory = () => localStorage.removeItem(SEARCH_KEY);

export const searchAll = async (query: string) => {
  const clean = sanitizeText(query);
  if (!clean) return { videos: [], users: [], products: [], challenges: [], sounds: [] };
  // New migration tables are not present in the generated Supabase types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const [videos, users, products, sounds] = await Promise.all([
    client.from('videos').select('*').textSearch('search_vector', clean).limit(20),
    client.from('profiles').select('*').or(`username.ilike.%${clean}%,prenom.ilike.%${clean}%,nom.ilike.%${clean}%`).limit(20),
    client.from('products').select('*').ilike('name', `%${clean}%`).limit(20),
    client.from('sounds').select('*').or(`title.ilike.%${clean}%,artist.ilike.%${clean}%`).limit(20),
  ]);
  return {
    videos: videos.data ?? [],
    users: users.data ?? [],
    products: products.data ?? [],
    challenges: [],
    sounds: sounds.data ?? [],
  };
};
