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
const adminOne = async (sql, params = []) => {
  await db.exec('RESET ROLE;');
  const result = await one(sql, params);
  await as(currentRole.role, currentRole.sub);
  return result;
};
const adminRows = async (sql, params = []) => {
  await db.exec('RESET ROLE;');
  const result = await rows(sql, params);
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

await db.exec(read('.sqlcheck/stub.sql'));
await db.exec(read('supabase/migrations/20261018100000_phase1_security_financial_foundations.sql'));
await db.exec(read('.sqlcheck/stub-phase5.sql'));
await db.exec(read('supabase/migrations/20261022100000_phase5_live_realtime.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  follower: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  blocked: '44444444-4444-4444-8444-444444444444',
};

const L = {
  public: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  followers: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  private: 'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  ended: 'bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
  noComments: 'bbbbbbb5-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.follower}', 'follower@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.blocked}', 'blocked@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.creator}', 'createur', false),
    ('${U.follower}', 'abonne', false),
    ('${U.stranger}', 'inconnu', false),
    ('${U.blocked}', 'bloque', false);

  INSERT INTO public.follows (follower_id, following_id) VALUES ('${U.follower}', '${U.creator}');
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('${U.creator}', '${U.blocked}');
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.live_sessions
    (id, host_id, agora_channel, title, status, privacy, comments_enabled, started_at)
  VALUES
    ('${L.public}',     '${U.creator}', 'chan-public',     'Public',           'live',  'public',    true,  now() - interval '10 minutes'),
    ('${L.followers}',  '${U.creator}', 'chan-followers',  'Abonnes',          'live',  'followers', true,  now() - interval '5 minutes'),
    ('${L.private}',    '${U.creator}', 'chan-private',    'Prive',            'live',  'private',   true,  now() - interval '2 minutes'),
    ('${L.ended}',      '${U.creator}', 'chan-ended',      'Termine',          'ended', 'public',    true,  now() - interval '1 hour'),
    ('${L.noComments}', '${U.creator}', 'chan-no-comments', 'Sans commentaires', 'live', 'public',    false, now() - interval '1 minute');
`);
await db.exec(`UPDATE public.live_sessions SET ended_at = now() - interval '30 minutes' WHERE id = '${L.ended}'`);

// --- 1. Visibilite ---------------------------------------------------------
await as('authenticated', U.stranger);
check('Un live prive est invisible aux autres', (await rows('SELECT id FROM public.live_sessions WHERE id = $1', [L.private])).length === 0);
check('Un live public reste visible', (await rows('SELECT id FROM public.live_sessions WHERE id = $1', [L.public])).length === 1);

await as('authenticated', U.follower);
check('Un abonne voit un live reserve aux abonnes', (await rows('SELECT id FROM public.live_sessions WHERE id = $1', [L.followers])).length === 1);

// --- 2. Presence reelle ----------------------------------------------------
await as('authenticated', U.follower);
const firstJoin = await one('SELECT public.join_live($1) AS viewers', [L.public]);
check('Rejoindre un live compte le spectateur', Number(firstJoin.viewers) === 1, firstJoin.viewers);

await as('authenticated', U.stranger);
const secondJoin = await one('SELECT public.join_live($1) AS viewers', [L.public]);
check('Un second spectateur porte le compteur a 2', Number(secondJoin.viewers) === 2, secondJoin.viewers);
check('Le pic de spectateurs est mis a jour', (await adminOne('SELECT peak_viewers FROM public.live_sessions WHERE id = $1', [L.public])).peak_viewers === 2);

await as('authenticated', U.follower);
const afterLeave = await one('SELECT public.leave_live($1) AS viewers', [L.public]);
check('Quitter le live decremente le compteur', Number(afterLeave.viewers) === 1, afterLeave.viewers);

await expectError(
  'Un live termine ne peut pas etre rejoint',
  () => db.query('SELECT public.join_live($1)', [L.ended]),
  /Live termine/i,
);
await expectError(
  'Un live prive ne peut pas etre rejoint par un abonne',
  () => db.query('SELECT public.join_live($1)', [L.private]),
  /indisponible/i,
);

// --- 3. Chat temps reel et moderation -------------------------------------
await as('authenticated', U.follower);
const [firstMessage] = await db.query(
  'INSERT INTO public.live_messages (session_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [L.public, U.follower, 'Bonjour le live'],
).then((result) => result.rows);
check('Un spectateur peut ecrire dans le chat', Boolean(firstMessage?.id));
check(
  'Le compteur de commentaires suit le chat',
  (await adminOne('SELECT comments_count FROM public.live_sessions WHERE id = $1', [L.public])).comments_count === 1,
);

await expectError(
  'Un utilisateur bloque ne peut pas commenter le live',
  () => db.query(
    'INSERT INTO public.live_messages (session_id, user_id, content) VALUES ($1, $2, $3)',
    [L.public, U.blocked, 'Je force'],
  ),
  /row-level security|policy/i,
);

await as('authenticated', U.stranger);
await expectError(
  'Le chat est ferme quand les commentaires sont desactives',
  () => db.query(
    'INSERT INTO public.live_messages (session_id, user_id, content) VALUES ($1, $2, $3)',
    [L.noComments, U.stranger, 'Interdit'],
  ),
  /row-level security|policy/i,
);

const [strangerMessage] = await db.query(
  'INSERT INTO public.live_messages (session_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [L.public, U.stranger, 'Message a moderer'],
).then((result) => result.rows);

// Le createur masque le message.
await as('authenticated', U.creator);
await db.query('UPDATE public.live_messages SET is_hidden = true WHERE id = $1', [strangerMessage.id]);
check(
  'Le createur peut masquer un message',
  (await adminOne('SELECT is_hidden FROM public.live_messages WHERE id = $1', [strangerMessage.id])).is_hidden === true,
);
check(
  'Masquer un message decremente les commentaires',
  (await adminOne('SELECT comments_count FROM public.live_sessions WHERE id = $1', [L.public])).comments_count === 1,
);

await as('authenticated', U.follower);
check(
  'Un message masque disparait pour les autres spectateurs',
  (await rows('SELECT id FROM public.live_messages WHERE id = $1', [strangerMessage.id])).length === 0,
);

await as('authenticated', U.creator);
check('Le createur voit toujours le message masque', (await rows('SELECT id FROM public.live_messages WHERE id = $1', [strangerMessage.id])).length === 1);

await as('authenticated', U.follower);
const unauthorizedHide = await db.query('UPDATE public.live_messages SET is_hidden = false WHERE id = $1', [strangerMessage.id]);
check(
  'Un spectateur ne peut pas restaurer un message masque',
  unauthorizedHide.affectedRows === 0
    && (await adminOne('SELECT is_hidden FROM public.live_messages WHERE id = $1', [strangerMessage.id])).is_hidden === true,
);

await as('authenticated', U.creator);
await expectError(
  'Un message de live ne peut pas etre reecrit',
  () => db.query('UPDATE public.live_messages SET content = $1 WHERE id = $2', ['Modifie', firstMessage.id]),
  /reecrit/i,
);

// --- 4. Co-animateurs ------------------------------------------------------
await as('authenticated', U.stranger);
await expectError(
  'Seul le createur peut nommer un co-animateur',
  () => db.query('SELECT public.promote_live_cohost($1, $2)', [L.public, U.stranger]),
  /createur/i,
);

await as('authenticated', U.creator);
await db.query('SELECT public.promote_live_cohost($1, $2)', [L.public, U.follower]);
check(
  'Le co-animateur est enregistre',
  (await adminOne('SELECT status FROM public.live_cohosts WHERE session_id = $1 AND user_id = $2', [L.public, U.follower])).status === 'accepted',
);

await as('authenticated', U.follower);
await db.query('UPDATE public.live_messages SET is_hidden = false WHERE id = $1', [strangerMessage.id]);
check(
  'Un co-animateur peut moderer le chat',
  (await adminOne('SELECT is_hidden FROM public.live_messages WHERE id = $1', [strangerMessage.id])).is_hidden === false,
);

// --- 5. Reactions et statistiques -----------------------------------------
await as('authenticated', U.follower);
await db.query('INSERT INTO public.live_reactions (session_id, user_id) VALUES ($1, $2)', [L.public, U.follower]);
check(
  'Un like de live incremente le compteur',
  (await adminOne('SELECT likes_count FROM public.live_sessions WHERE id = $1', [L.public])).likes_count === 1,
);
await expectError(
  'Les rafales de reactions sont limitees',
  () => db.query('INSERT INTO public.live_reactions (session_id, user_id) VALUES ($1, $2)', [L.public, U.follower]),
  /Trop de reactions/i,
);

await as('authenticated', U.stranger);
await db.query('INSERT INTO public.live_reactions (session_id, user_id) VALUES ($1, $2)', [L.public, U.stranger]);
check(
  'Les likes de plusieurs spectateurs se cumulent',
  (await adminOne('SELECT likes_count FROM public.live_sessions WHERE id = $1', [L.public])).likes_count === 2,
);

await expectError(
  'Un spectateur ne peut pas terminer le live',
  () => db.query('SELECT public.end_live($1)', [L.public]),
  /createur/i,
);

await as('authenticated', U.creator);
await expectError(
  'Le createur ne peut pas falsifier les compteurs du live',
  () => db.query('UPDATE public.live_sessions SET likes_count = 999 WHERE id = $1', [L.public]),
  /compteurs de live/i,
);

await db.query('SELECT public.end_live($1)', [L.ended]);
const endedSession = await adminOne('SELECT status, ended_at, viewers_count FROM public.live_sessions WHERE id = $1', [L.ended]);
check('Terminer le live le passe en termine', endedSession.status === 'ended' && Boolean(endedSession.ended_at) === true);

const stats = await one('SELECT * FROM public.get_live_stats($1)', [L.public]);
check('Les statistiques du live sont reelles', Number(stats.likes_count) === 2 && Number(stats.comments_count) === 2, JSON.stringify(stats));
check('La duree du live est calculee', Number(stats.duration_seconds) >= 590, stats.duration_seconds);
check('Les spectateurs totaux sont comptes', Number(stats.viewers_total) === 2, stats.viewers_total);

await as('authenticated', U.stranger);
check('Les statistiques sont reservees au createur', (await rows('SELECT * FROM public.get_live_stats($1)', [L.public])).length === 0);
check('La liste des spectateurs est reservee au createur', (await rows('SELECT * FROM public.list_live_viewers($1)', [L.public])).length === 0);

await as('authenticated', U.creator);
check('Le createur liste les spectateurs actifs', (await rows('SELECT * FROM public.list_live_viewers($1)', [L.public])).length >= 1);

await expectError(
  'Un live termine ne peut pas etre relance',
  () => db.query("UPDATE public.live_sessions SET status = 'live' WHERE id = $1", [L.ended]),
  /termine/i,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
