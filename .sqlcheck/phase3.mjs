import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const reportFatal = (error) => {
  console.error('HARNESS ERROR:', error?.message ?? error);
  if (error?.code) console.error('HARNESS CODE:', error.code);
  if (error?.query) console.error('HARNESS QUERY:', String(error.query).slice(0, 400));
  process.exit(1);
};
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const db = new PGlite();
let pass = 0;
let fail = 0;
const results = [];

const check = (name, condition, detail = '') => {
  results.push({ ok: Boolean(condition), name, detail });
  if (condition) pass += 1;
  else fail += 1;
};

let currentRole = { role: 'postgres', sub: null };

const as = async (role, sub = null) => {
  await db.exec('RESET ROLE;');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub, role }),
  ]);
  await db.exec(`SET ROLE ${role};`);
  currentRole = { role, sub };
};

const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const expectError = async (name, fn, matcher) => {
  try {
    await fn();
    check(name, false, 'aucune erreur levee');
  } catch (error) {
    const message = String(error?.message ?? error);
    check(name, matcher ? matcher.test(message) : true, message);
  }
};

await db.exec(read('.sqlcheck/stub.sql'));
await db.exec(read('supabase/migrations/20261018100000_phase1_security_financial_foundations.sql'));
await db.exec(read('.sqlcheck/stub-phase2.sql'));
await db.exec(read('supabase/migrations/20261020100000_phase3_feed_recommendations.sql'));

const U = {
  creatorA: '11111111-1111-4111-8111-111111111111',
  creatorB: '22222222-2222-4222-8222-222222222222',
  follower: '33333333-3333-4333-8333-333333333333',
  stranger: '44444444-4444-4444-8444-444444444444',
  blocked: '55555555-5555-4555-8555-555555555555',
};

const V = {
  aRecent: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  aOld: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  bRecent: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  aFollowers: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  aPrivate: 'aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  aPending: 'aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
  aUnpublished: 'aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
  aProcessing: 'aaaaaaa8-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creatorA}', 'a@afrixa.test'),
    ('${U.creatorB}', 'b@afrixa.test'),
    ('${U.follower}', 'follower@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.blocked}', 'blocked@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.creatorA}', 'createur_a', false),
    ('${U.creatorB}', 'createur_b', false),
    ('${U.follower}', 'abonne', false),
    ('${U.stranger}', 'inconnu', false),
    ('${U.blocked}', 'bloque', false);

  INSERT INTO public.follows (follower_id, following_id) VALUES ('${U.follower}', '${U.creatorA}');
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('${U.creatorA}', '${U.blocked}');
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.videos
    (id, user_id, title, is_published, moderation_status, privacy, cloudflare_status, created_at,
     likes_count, comments_count, shares_count, saves_count, views_count, hls_url)
  VALUES
    ('${V.aRecent}',      '${U.creatorA}', 'A recente',      true,  'approved', 'public',    'ready',      now() - interval '1 hour',   10, 5, 2, 4, 100, 'https://cdn/a1.m3u8'),
    ('${V.aOld}',         '${U.creatorA}', 'A ancienne',     true,  'approved', 'public',    'ready',      now() - interval '30 days',  100, 30, 10, 20, 5000, 'https://cdn/a2.m3u8'),
    ('${V.bRecent}',      '${U.creatorB}', 'B recente',      true,  'approved', 'public',    'ready',      now() - interval '2 hours',  2, 0, 0, 0, 10, 'https://cdn/b1.m3u8'),
    ('${V.aFollowers}',   '${U.creatorA}', 'A abonnes',      true,  'approved', 'followers', 'ready',      now() - interval '30 minutes', 1, 0, 0, 0, 5, 'https://cdn/a3.m3u8'),
    ('${V.aPrivate}',     '${U.creatorA}', 'A privee',       true,  'approved', 'private',   'ready',      now() - interval '20 minutes', 0, 0, 0, 0, 0, 'https://cdn/a4.m3u8'),
    ('${V.aPending}',     '${U.creatorA}', 'A en attente',   true,  'pending',  'public',    'ready',      now() - interval '10 minutes', 50, 10, 5, 5, 200, 'https://cdn/a5.m3u8'),
    ('${V.aUnpublished}', '${U.creatorA}', 'A non publiee',  false, 'approved', 'public',    'ready',      now() - interval '5 minutes', 50, 10, 5, 5, 200, 'https://cdn/a6.m3u8'),
    ('${V.aProcessing}',  '${U.creatorA}', 'A en encodage',  true,  'approved', 'public',    'processing', now() - interval '4 minutes', 50, 10, 5, 5, 200, 'https://cdn/a7.m3u8');
`);

const feed = async (mode = 'foryou', limit = 20, offset = 0) =>
  rows('SELECT id FROM public.get_feed($1, $2, $3)', [mode, limit, offset]).then((list) =>
    list.map((row) => row.id),
  );

// --- 1. Visibilite et recommandations --------------------------------------
await as('authenticated', U.follower);
const followerFeed = await feed();
check('Le fil "Pour toi" ne renvoie que les videos visibles', followerFeed.length === 4, followerFeed.length);
check(
  'Les videos en attente, non publiees ou en encodage sont exclues',
  ![V.aPending, V.aUnpublished, V.aProcessing].some((id) => followerFeed.includes(id)),
);
check('Une video privee est exclue du fil', !followerFeed.includes(V.aPrivate));
check('Un abonne voit les videos reservees aux abonnes', followerFeed.includes(V.aFollowers));
check('Le contenu le plus engage remonte en premier', followerFeed[0] === V.aRecent, followerFeed[0]);

const followerRepeat = await feed();
check(
  'Le classement est deterministe',
  JSON.stringify(followerRepeat) === JSON.stringify(followerFeed),
);

await as('authenticated', U.stranger);
const strangerFeed = await feed();
check('Un non-abonne ne voit pas les videos abonnes', !strangerFeed.includes(V.aFollowers));
check('Un non-abonne voit les videos publiques', strangerFeed.length === 3, strangerFeed.length);

await as('authenticated', U.blocked);
const blockedFeed = await feed();
check(
  'Un utilisateur bloque ne voit plus les videos du createur',
  !blockedFeed.some((id) => [V.aRecent, V.aOld, V.aFollowers].includes(id)),
);
check('Le reste du fil reste accessible malgre le blocage', blockedFeed.length === 1, blockedFeed.length);

// --- 2. Mode abonnements ---------------------------------------------------
await as('authenticated', U.follower);
const followingFeed = await feed('following');
check('Le fil abonnements ne contient que les createurs suivis', followingFeed.length === 3, followingFeed.length);
check('Le fil abonnements exclut les autres createurs', !followingFeed.includes(V.bRecent));
check(
  'Le fil abonnements est trie du plus recent au plus ancien',
  followingFeed[0] === V.aFollowers && followingFeed[1] === V.aRecent,
  JSON.stringify(followingFeed),
);

await as('authenticated', U.stranger);
check('Sans abonnement, le fil abonnements est vide', (await feed('following')).length === 0);

// --- 3. Pagination ---------------------------------------------------------
await as('authenticated', U.follower);
const page1 = await feed('foryou', 2, 0);
const page2 = await feed('foryou', 2, 2);
const page3 = await feed('foryou', 2, 4);
check('La premiere page respecte la limite', page1.length === 2);
check('La deuxieme page continue le fil', page2.length === 2);
check('Les pages ne se repetent pas', [...page1, ...page2].length === new Set([...page1, ...page2]).size);
check('La page au-dela du fil est vide', page3.length === 0, page3.length);
check(
  'La pagination recompose le fil complet',
  JSON.stringify([...page1, ...page2]) === JSON.stringify(followerFeed),
);

const clamped = await feed('foryou', 500, 0);
check('La limite est bornee a 50', clamped.length <= 50, clamped.length);

await expectError(
  'Un mode inconnu est refuse',
  () => feed('trending'),
  /Mode de fil inconnu/i,
);

// --- 4. Acces --------------------------------------------------------------
await as('anon');
await expectError(
  'Le fil n est pas expose aux visiteurs anonymes',
  () => feed(),
  /permission denied/i,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
