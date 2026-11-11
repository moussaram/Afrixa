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
const one = async (sql, params = []) => (await rows(sql, params))[0] ?? null;
const adminRows = async (sql, params = []) => {
  await db.exec('RESET ROLE;');
  const result = await rows(sql, params);
  await as(currentRole.role, currentRole.sub);
  return result;
};
const adminOne = async (sql, params = []) => (await adminRows(sql, params))[0] ?? null;

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
await db.exec(read('.sqlcheck/stub-phase4.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  follower: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
};

const V = {
  public: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  followers: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  private: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  pending: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.follower}', 'follower@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test');

  INSERT INTO public.profiles (user_id, username, prenom, nom, bio) VALUES
    ('${U.creator}', 'createur', 'Awa', 'Diallo', 'Créatrice de contenu'),
    ('${U.follower}', 'abonne', 'Moussa', 'Traoré', null),
    ('${U.stranger}', 'inconnu', 'Inconnu', 'Test', null);

  INSERT INTO public.follows (follower_id, following_id) VALUES ('${U.follower}', '${U.creator}');
`);

await db.exec(read('supabase/migrations/20261021100000_phase4_profiles_creator_stats.sql'));

// --- 1. Compteurs de profil et backfill -----------------------------------
await as('authenticated', U.creator);
check('Le backfill compte les abonnes', (await one('SELECT followers_count FROM public.profiles WHERE user_id = $1', [U.creator])).followers_count === 1);
check('Le backfill compte les abonnements', (await one('SELECT following_count FROM public.profiles WHERE user_id = $1', [U.follower])).following_count === 1);

await expectError(
  'Un utilisateur ne peut pas falsifier ses compteurs',
  () => db.query('UPDATE public.profiles SET followers_count = 999 WHERE user_id = $1', [U.creator]),
  /compteurs de profil/i,
);

await as('authenticated', U.stranger);
await db.query('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)', [U.stranger, U.creator]);
check('Un nouvel abonnement incremente les deux compteurs', (await adminOne('SELECT followers_count FROM public.profiles WHERE user_id = $1', [U.creator])).followers_count === 2 && (await adminOne('SELECT following_count FROM public.profiles WHERE user_id = $1', [U.stranger])).following_count === 1);
await db.query('DELETE FROM public.follows WHERE follower_id = $1 AND following_id = $2', [U.stranger, U.creator]);
check('Un desabonnement decremente les compteurs', (await adminOne('SELECT followers_count FROM public.profiles WHERE user_id = $1', [U.creator])).followers_count === 1);

await as('authenticated', U.creator);
await db.query('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $1)', [U.creator]);
check(
  'Un auto-abonnement ne modifie pas les compteurs',
  (await adminOne('SELECT followers_count FROM public.profiles WHERE user_id = $1', [U.creator])).followers_count === 1
    && (await adminOne('SELECT following_count FROM public.profiles WHERE user_id = $1', [U.creator])).following_count === 0,
);
await db.query('DELETE FROM public.follows WHERE follower_id = $1 AND following_id = $1', [U.creator]);

// --- 2. Videos et statistiques createur -----------------------------------
await as('service_role');
await db.exec(`
  INSERT INTO public.videos
    (id, user_id, title, is_published, moderation_status, privacy, cloudflare_status, likes_count, views_count, comments_count, shares_count, saves_count, hls_url)
  VALUES
    ('${V.public}',    '${U.creator}', 'Publique', true,  'approved', 'public',    'ready', 5,  100, 2, 1, 1, 'https://cdn/1.m3u8'),
    ('${V.followers}', '${U.creator}', 'Abonnes',  true,  'approved', 'followers', 'ready', 7,  200, 3, 2, 2, 'https://cdn/2.m3u8'),
    ('${V.private}',   '${U.creator}', 'Privee',   true,  'approved', 'private',   'ready', 11, 300, 4, 3, 3, 'https://cdn/3.m3u8'),
    ('${V.pending}',   '${U.creator}', 'Attente',  true,  'pending',  'public',    'ready', 100, 900, 9, 9, 9, 'https://cdn/4.m3u8');
`);

await as('authenticated', U.creator);
await db.query('SELECT public.refresh_my_creator_analytics()');
const analytics = await adminOne('SELECT * FROM public.profile_analytics WHERE user_id = $1', [U.creator]);
check('Afrixa Studio recoit une ligne de statistiques', Boolean(analytics));
check('Les vues agregees sont reelles', Number(analytics.total_views) === 600, analytics?.total_views);
check(
  'Les j aime agreges excluent les videos non approuvees',
  Number(analytics.total_likes) === 23,
  analytics?.total_likes,
);
check('Les abonnes sont repris dans les statistiques', analytics.followers_count === 1);
check(
  'Les videos analysees excluent les non approuvees',
  (await adminRows('SELECT video_id FROM public.video_analytics WHERE user_id = $1', [U.creator])).length === 3,
);

await db.query('SELECT public.refresh_my_creator_analytics()');
check(
  'Le rafraichissement est idempotent sur la journee',
  (await adminRows('SELECT id FROM public.profile_analytics WHERE user_id = $1', [U.creator])).length === 1,
);

await as('authenticated', U.stranger);
// La fonction n'est pas executee par les clients : seul le wrapper personnel
// (ou service_role) peut declencher un recalcul.
await expectError(
  'Un autre utilisateur ne peut pas recalculer ces statistiques',
  () => db.query('SELECT public.refresh_creator_analytics($1)', [U.creator]),
  /permission denied|reservees au createur/i,
);

// --- 3. Statistiques publiques --------------------------------------------
const statsFor = async (userId) =>
  (await rows('SELECT * FROM public.get_profile_stats($1)', [userId]))[0];

await as('authenticated', U.stranger);
const strangerStats = await statsFor(U.creator);
check('Les abonnes sont publics', Number(strangerStats.followers_count) === 1);
check('Un non-abonne ne compte que les videos publiques', Number(strangerStats.videos_count) === 1, strangerStats.videos_count);
check('Les j aime publics sont coherents', Number(strangerStats.likes_count) === 5, strangerStats.likes_count);
check('Le statut d abonnement est faux pour un inconnu', strangerStats.is_following === false);

await as('authenticated', U.follower);
const followerStats = await statsFor(U.creator);
check('Un abonne voit les videos reservees aux abonnes', Number(followerStats.videos_count) === 2, followerStats.videos_count);
check('Un abonne voit les j aime correspondants', Number(followerStats.likes_count) === 12, followerStats.likes_count);
check('Le statut d abonnement est vrai pour un abonne', followerStats.is_following === true);

await as('authenticated', U.creator);
const ownerStats = await statsFor(U.creator);
check('Le createur voit toutes ses videos pretes', Number(ownerStats.videos_count) === 3, ownerStats.videos_count);
check('Le createur voit tous ses j aime', Number(ownerStats.likes_count) === 23, ownerStats.likes_count);

await as('anon');
await expectError(
  'Les statistiques ne sont pas exposees aux anonymes',
  () => statsFor(U.creator),
  /permission denied/i,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
