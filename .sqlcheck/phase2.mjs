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

// Reads that must bypass RLS (assertions on another user's rows).
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
await db.exec(read('supabase/migrations/20261019100000_phase2_social_interactions.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  follower: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  blocked: '44444444-4444-4444-8444-444444444444',
  fan: '55555555-5555-4555-8555-555555555555',
};

const V = {
  public: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  private: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  noComments: 'aaaaaaa8-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.follower}', 'follower@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.blocked}', 'blocked@afrixa.test'),
    ('${U.fan}', 'fan@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private, who_can_comment) VALUES
    ('${U.creator}', 'createur', false, 'everyone'),
    ('${U.follower}', 'abonne', false, 'everyone'),
    ('${U.stranger}', 'inconnu', false, 'everyone'),
    ('${U.blocked}', 'bloque', false, 'everyone'),
    ('${U.fan}', 'fan', false, 'everyone');

  INSERT INTO public.follows (follower_id, following_id) VALUES ('${U.follower}', '${U.creator}');
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('${U.creator}', '${U.blocked}');
  INSERT INTO public.notification_settings (user_id) VALUES ('${U.creator}'), ('${U.follower}');
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.videos (id, user_id, title, is_published, moderation_status, privacy, cloudflare_status, comments_disabled) VALUES
    ('${V.public}',     '${U.creator}', 'publique', true, 'approved', 'public',  'ready', false),
    ('${V.private}',    '${U.creator}', 'privee',   true, 'approved', 'private', 'ready', false),
    ('${V.noComments}', '${U.creator}', 'sans commentaires', true, 'approved', 'public', 'ready', true);
`);

const video = async (id = V.public) => adminOne('SELECT * FROM public.videos WHERE id = $1', [id]);
const notifications = async (userId = U.creator, type) =>
  adminRows(
    `SELECT * FROM public.notifications
     WHERE user_id = $1 ${type ? 'AND type = $2' : ''}
     ORDER BY created_at`,
    type ? [userId, type] : [userId],
  );

// --- 1. Compteurs de likes et notifications groupees ------------------------
await as('authenticated', U.follower);
await db.query('INSERT INTO public.video_likes (video_id, user_id) VALUES ($1, $2)', [V.public, U.follower]);
check('Un like incremente likes_count', (await video()).likes_count === 1, (await video()).likes_count);
check('Un like notifie le createur', (await notifications(U.creator, 'like')).length === 1);
check(
  'La notification de like porte l auteur',
  (await notifications(U.creator, 'like'))[0].actor_id === U.follower,
);

await as('authenticated', U.fan);
await db.query('INSERT INTO public.video_likes (video_id, user_id) VALUES ($1, $2)', [V.public, U.fan]);
check('Un deuxieme like incremente le compteur', (await video()).likes_count === 2);
const grouped = await notifications(U.creator, 'like');
check(
  'Les likes sont groupes en une seule notification',
  grouped.length === 1 && grouped[0].aggregate_count === 2,
  JSON.stringify(grouped.map((row) => row.aggregate_count)),
);

await as('authenticated', U.creator);
await db.query('INSERT INTO public.video_likes (video_id, user_id) VALUES ($1, $2)', [V.public, U.creator]);
check('Un auto-like ne notifie pas', (await notifications(U.creator, 'like')).length === 1);
check('Un auto-like incremente le compteur', (await video()).likes_count === 3);

await as('authenticated', U.stranger);
await db.query('INSERT INTO public.video_likes (video_id, user_id) VALUES ($1, $2)', [V.public, U.stranger]);
check('Le troisieme like est groupe', (await notifications(U.creator, 'like'))[0].aggregate_count === 3);

// --- 2. Preferences de notification ----------------------------------------
await as('authenticated', U.creator);
await db.query('UPDATE public.notification_settings SET likes_enabled = false WHERE user_id = $1', [U.creator]);
await as('authenticated', U.follower);
await db.query('DELETE FROM public.video_likes WHERE video_id = $1 AND user_id = $2', [V.public, U.follower]);
check('Un unlike decremente likes_count', (await video()).likes_count === 3, (await video()).likes_count);
await db.query('INSERT INTO public.video_likes (video_id, user_id) VALUES ($1, $2)', [V.public, U.follower]);
check(
  'La preference "j aime desactivee" bloque la notification',
  (await notifications(U.creator, 'like'))[0].aggregate_count === 3,
  JSON.stringify((await notifications(U.creator, 'like')).map((row) => row.aggregate_count)),
);
await as('authenticated', U.creator);
await db.query('UPDATE public.notification_settings SET likes_enabled = true WHERE user_id = $1', [U.creator]);

// --- 3. Favoris -------------------------------------------------------------
await as('authenticated', U.follower);
await db.query('INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)', [V.public, U.follower]);
check('Un favori incremente saves_count', (await video()).saves_count === 1);
await db.query('DELETE FROM public.video_saves WHERE video_id = $1 AND user_id = $2', [V.public, U.follower]);
check('Un retrait de favori decremente saves_count', (await video()).saves_count === 0);

// --- 4. Partages enregistres -----------------------------------------------
await as('authenticated', U.follower);
await db.query(
  "INSERT INTO public.video_shares (video_id, user_id, channel) VALUES ($1, $2, 'whatsapp')",
  [V.public, U.follower],
);
check('Un partage externe incremente shares_count', (await video()).shares_count === 1);
await db.query(
  "INSERT INTO public.video_shares (video_id, user_id, channel, recipient_id) VALUES ($1, $2, 'internal', $3)",
  [V.public, U.follower, U.creator],
);
check('Un partage interne incremente shares_count', (await video()).shares_count === 2);
await expectError(
  'Un partage ne peut pas etre attribue a un autre utilisateur',
  () => db.query(
    "INSERT INTO public.video_shares (video_id, user_id, channel) VALUES ($1, $2, 'link')",
    [V.public, U.stranger],
  ),
  /row-level security|policy/i,
);
await expectError(
  'Un partage enregistre ne peut pas etre modifie',
  () => db.query("UPDATE public.video_shares SET channel = 'link'"),
  /permission denied/i,
);

// --- 5. Commentaires -------------------------------------------------------
await as('authenticated', U.follower);
const [rootComment] = (await db.query(
  'INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [V.public, U.follower, 'Super video'],
)).rows;
check('Un commentaire incremente comments_count', (await video()).comments_count === 1);
const commentNotif = await notifications(U.creator, 'comment');
check('Un commentaire notifie le createur', commentNotif.length === 1 && commentNotif[0].reference_id === rootComment.id);

await as('authenticated', U.fan);
const [reply] = (await db.query(
  'INSERT INTO public.comments (video_id, user_id, parent_id, content) VALUES ($1, $2, $3, $4) RETURNING id',
  [V.public, U.fan, rootComment.id, 'Je confirme'],
)).rows;
check('Une reponse incremente replies_count', (await one('SELECT replies_count FROM public.comments WHERE id = $1', [rootComment.id])).replies_count === 1);
const replyNotif = await notifications(U.follower, 'reply');
check(
  'Une reponse notifie l auteur du commentaire',
  replyNotif.length === 1 && replyNotif[0].reference_id === reply.id,
  JSON.stringify(replyNotif.length),
);

await expectError(
  'Une reponse imbriquee est refusee',
  () => db.query(
    'INSERT INTO public.comments (video_id, user_id, parent_id, content) VALUES ($1, $2, $3, $4)',
    [V.public, U.fan, reply.id, 'Trop profond'],
  ),
  /imbriquees/i,
);

await as('authenticated', U.creator);
const [privateComment] = (await db.query(
  'INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [V.private, U.creator, 'Commentaire prive'],
)).rows;
await as('authenticated', U.fan);
await expectError(
  'Une reponse doit appartenir a la meme video',
  () => db.query(
    'INSERT INTO public.comments (video_id, user_id, parent_id, content) VALUES ($1, $2, $3, $4)',
    [V.public, U.fan, privateComment.id, 'Mauvaise video'],
  ),
  /meme video/i,
);
check(
  'Les commentaires d une video privee restent invisibles',
  (await rows('SELECT id FROM public.comments WHERE video_id = $1', [V.private])).length === 0,
);

await as('authenticated', U.blocked);
await expectError(
  'Un utilisateur bloque ne peut pas commenter',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.blocked, 'Bonjour']),
  /commenter cette video/i,
);

// --- 6. Restrictions du createur -------------------------------------------
await as('authenticated', U.creator);
await db.query("UPDATE public.profiles SET who_can_comment = 'followers' WHERE user_id = $1", [U.creator]);

await as('authenticated', U.stranger);
await expectError(
  'Un non-abonne ne peut pas commenter quand le createur limite aux abonnes',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.stranger, 'Salut']),
  /abonnes/i,
);

await as('authenticated', U.follower);
await db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.follower, 'Deuxieme commentaire']);
check('Un abonne peut commenter', (await video()).comments_count === 2, (await video()).comments_count);

await as('authenticated', U.creator);
await db.query("UPDATE public.profiles SET who_can_comment = 'nobody' WHERE user_id = $1", [U.creator]);
await db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.creator, 'Note du createur']);
check('Le createur peut toujours commenter', (await video()).comments_count === 3, (await video()).comments_count);

await as('authenticated', U.stranger);
await expectError(
  'Les commentaires sont fermes quand who_can_comment vaut nobody',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.stranger, 'Salut']),
  /reserves au createur/i,
);

await as('authenticated', U.creator);
await db.query("UPDATE public.profiles SET who_can_comment = 'everyone' WHERE user_id = $1", [U.creator]);

await as('authenticated', U.follower);
await expectError(
  'Une video avec commentaires desactives refuse les commentaires',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.noComments, U.follower, 'Interdit']),
  /desactives/i,
);

// --- 7. Epinglage et suppression -------------------------------------------
await as('authenticated', U.creator);
await db.query('UPDATE public.comments SET is_pinned = true WHERE id = $1', [rootComment.id]);
check(
  'Le createur peut epingler un commentaire',
  (await one('SELECT is_pinned FROM public.comments WHERE id = $1', [rootComment.id])).is_pinned === true,
);

await as('authenticated', U.follower);
await expectError(
  'Un auteur ne peut pas epingler son commentaire',
  () => db.query(
    'INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [V.public, U.follower, 'A epingler'],
  ).then(async (result) => {
    const id = result.rows[0].id;
    return db.query('UPDATE public.comments SET is_pinned = true WHERE id = $1', [id]);
  }),
  /createur de la video/i,
);

await as('authenticated', U.stranger);
const strangerDelete = await db.query('UPDATE public.comments SET is_deleted = true WHERE id = $1', [rootComment.id]);
check(
  'Un tiers ne peut pas masquer un commentaire',
  strangerDelete.affectedRows === 0
    && (await one('SELECT is_deleted FROM public.comments WHERE id = $1', [rootComment.id])).is_deleted === false,
);

await as('authenticated', U.creator);
const commentsBeforeHide = (await video()).comments_count;
await db.query('UPDATE public.comments SET is_deleted = true WHERE id = $1', [rootComment.id]);
check(
  'Le createur peut masquer un commentaire',
  (await one('SELECT is_deleted FROM public.comments WHERE id = $1', [rootComment.id])).is_deleted === true,
);
check(
  'Masquer un commentaire decremente comments_count',
  (await video()).comments_count === commentsBeforeHide - 1,
  (await video()).comments_count,
);

// L auteur (et non le proprietaire) masque son propre commentaire.
await as('authenticated', U.fan);
await db.query('UPDATE public.comments SET is_deleted = true WHERE id = $1', [reply.id]);
check(
  'Un auteur peut masquer son propre commentaire',
  (await one('SELECT is_deleted FROM public.comments WHERE id = $1', [reply.id])).is_deleted === true,
);
check(
  'Masquer une reponse decremente replies_count',
  (await adminOne('SELECT replies_count FROM public.comments WHERE id = $1', [rootComment.id])).replies_count === 0,
  (await adminOne('SELECT replies_count FROM public.comments WHERE id = $1', [rootComment.id])).replies_count,
);

// --- 8. Legacy, compteurs et RLS des notifications ------------------------
await as('authenticated', U.follower);
await expectError(
  'L ancienne table video_comments n accepte plus d ecriture cliente',
  () => db.query('INSERT INTO public.video_comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V.public, U.follower, 'Legacy']),
  /permission denied/i,
);

await as('authenticated', U.creator);
await expectError(
  'Un createur ne peut pas falsifier les compteurs',
  () => db.query('UPDATE public.videos SET likes_count = 999 WHERE id = $1', [V.public]),
  /compteurs video/i,
);

const ownNotifications = await rows('SELECT id FROM public.notifications');
check('Le createur lit ses notifications', ownNotifications.length >= 3, ownNotifications.length);
await as('authenticated', U.stranger);
check('Un autre utilisateur ne lit pas ces notifications', (await rows('SELECT id FROM public.notifications')).length === 0);

// --- 9. Notifications d abonnement et preferences -------------------------
// L abonnement initial (follower -> createur) a deja cree une notification :
// les assertions portent donc sur des deltas, pas sur un total absolu.
const followBaseline = (await notifications(U.creator, 'follow')).length;

await as('authenticated', U.creator);
await db.query('UPDATE public.notification_settings SET follows_enabled = false WHERE user_id = $1', [U.creator]);
await as('authenticated', U.fan);
await db.query('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)', [U.fan, U.creator]);
check(
  'La preference "abonnements desactives" bloque la notification',
  (await notifications(U.creator, 'follow')).length === followBaseline,
);

await as('authenticated', U.creator);
await db.query('UPDATE public.notification_settings SET follows_enabled = true WHERE user_id = $1', [U.creator]);
await as('authenticated', U.stranger);
await db.query('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)', [U.stranger, U.creator]);
const followNotif = await notifications(U.creator, 'follow');
check(
  'Un abonnement notifie le createur',
  followNotif.length === followBaseline + 1
    && followNotif[followNotif.length - 1]?.actor_id === U.stranger,
  JSON.stringify(followNotif.length),
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
