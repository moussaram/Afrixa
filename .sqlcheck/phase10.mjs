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
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, role })]);
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
const adminOne = async (sql, params = []) => {
  await db.exec('RESET ROLE;');
  const result = await one(sql, params);
  await as(currentRole.role, currentRole.sub);
  return result;
};
const expectError = async (name, fn, matcher) => {
  try {
    await fn();
    check(name, false, 'aucune erreur levee');
  } catch (error) {
    const message = String(error?.message ?? error);
    check(name, matcher ? matcher.test(message) : true, message);
  }
};
const watch = async (videoId, position, duration) => {
  const row = await one(
    'SELECT public.record_video_watch($1, $2, $3) AS result',
    [videoId, position, duration],
  );
  return row?.result ?? null;
};

await db.exec(read('.sqlcheck/stub.sql'));
await db.exec(read('supabase/migrations/20261018100000_phase1_security_financial_foundations.sql'));
await db.exec(`
  CREATE TABLE public.video_watch_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
    watch_duration double precision DEFAULT 0,
    completion_rate double precision DEFAULT 0,
    last_position double precision DEFAULT 0,
    watch_count integer DEFAULT 1,
    last_watched_at timestamptz DEFAULT now(),
    UNIQUE (user_id, video_id)
  );
  ALTER TABLE public.video_watch_history ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "video_watch_history_owner_all"
    ON public.video_watch_history FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_watch_history TO authenticated;
  GRANT ALL ON public.video_watch_history TO service_role;
  ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS hidden_by_reports boolean NOT NULL DEFAULT false;
`);
await db.exec(read('supabase/migrations/20261027100000_phase10_watch_history.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  viewer: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  privateCreator: '44444444-4444-4444-8444-444444444444',
};
const V = {
  public: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  followers: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.viewer}', 'viewer@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.privateCreator}', 'private@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.creator}', 'createur', false),
    ('${U.viewer}', 'spectateur', false),
    ('${U.stranger}', 'inconnu', false),
    ('${U.privateCreator}', 'prive', true);
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.videos (id, user_id, title, is_published, moderation_status, cloudflare_status, privacy)
  VALUES
    ('${V.public}', '${U.creator}', 'Video publique', true, 'approved', 'ready', 'public'),
    ('${V.followers}', '${U.privateCreator}', 'Video abonnes', true, 'approved', 'ready', 'followers');
`);

await as('anon');
await expectError(
  'Un visiteur non connecte ne peut pas enregistrer de lecture',
  () => db.query('SELECT public.record_video_watch($1, $2, $3)', [V.public, 10, 60]),
  /Connexion requise|permission denied/i,
);

await as('authenticated', U.viewer);
const first = await watch(V.public, 12, 60);
check(
  'Une premiere lecture est enregistree',
  first?.watch_duration === 12 && first?.completion_rate === 0.2 && first?.watch_count === 1 && first?.is_new_view === true,
  JSON.stringify(first),
);

const second = await watch(V.public, 30, 60);
check(
  'La meme session met a jour sans compter une nouvelle vue',
  second?.watch_duration === 30 && second?.completion_rate === 0.5 && second?.watch_count === 1 && second?.is_new_view === false,
  JSON.stringify(second),
);

const completed = await watch(V.public, 60, 60);
check(
  'La fin de video marque la completion et remet la position a zero',
  completed?.completion_rate === 1 && completed?.last_position === 0,
  JSON.stringify(completed),
);

const state = await one('SELECT * FROM public.get_watch_states($1)', [[V.public]]);
check(
  'L etat renvoye permet la detection des videos deja vues',
  state?.completed === true && state?.watch_count === 1,
  JSON.stringify(state),
);

// Nouvelle session apres 30 minutes : la vue est recomptee.
await as('service_role');
await db.query("UPDATE public.video_watch_history SET last_watched_at = now() - interval '2 hours' WHERE user_id = $1", [U.viewer]);
await as('authenticated', U.viewer);
const resumed = await watch(V.public, 8, 60);
check(
  'Une reprise apres 30 minutes compte une nouvelle vue',
  resumed?.watch_count === 2 && resumed?.is_new_view === true && resumed?.last_position === 8,
  JSON.stringify(resumed),
);

// Position hors bornes.
const clamped = await watch(V.public, -5, 60);
check('Une position negative est ramenee a zero', clamped?.last_position === 0);

// Confidentialite.
await as('authenticated', U.stranger);
await expectError(
  'Une video reservee aux abonnes est refusee a un inconnu',
  () => db.query('SELECT public.record_video_watch($1, $2, $3)', [V.followers, 10, 60]),
  /Video indisponible/i,
);
await expectError(
  'Une video inconnue est refusee',
  () => db.query('SELECT public.record_video_watch($1, $2, $3)', ['ffffffff-ffff-4fff-8fff-ffffffffffff', 10, 60]),
  /Video introuvable/i,
);

await as('service_role');
await db.query('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)', [U.stranger, U.privateCreator]);
await as('authenticated', U.stranger);
const allowed = await watch(V.followers, 15, 60);
check('Un abonne peut enregistrer la lecture d une video abonnes', allowed?.watch_duration === 15);

// Isolation.
await as('authenticated', U.creator);
check(
  'Un compte ne voit pas l historique des autres',
  (await rows('SELECT * FROM public.video_watch_history WHERE user_id = $1', [U.viewer])).length === 0
    && (await rows('SELECT * FROM public.get_watch_states($1)', [[V.public]])).length === 0,
);

// Compatibilite avec le calcul des gains de la Phase 7.
const eligible = await adminOne(
  `SELECT count(*)::int AS c FROM public.video_watch_history AS history
   WHERE history.last_watched_at >= now() - interval '1 day'
     AND history.watch_duration >= 3
     AND history.user_id <> $1`,
  [U.creator],
);
check('Les lectures enregistrees sont exploitables par les gains de vues', eligible.c >= 2, JSON.stringify(eligible));

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
