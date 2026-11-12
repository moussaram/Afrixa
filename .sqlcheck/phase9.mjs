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
await db.exec(read('.sqlcheck/stub-phase8.sql'));
await db.exec(read('supabase/migrations/20261025100000_phase8_afrixa_ads.sql'));
await db.exec(read('.sqlcheck/stub-phase9.sql'));
await db.exec(read('supabase/migrations/20261026100000_phase9_moderation.sql'));

const U = {
  author: '11111111-1111-4111-8111-111111111111',
  r1: '22222222-2222-4222-8222-222222222222',
  r2: '33333333-3333-4333-8333-333333333333',
  r3: '44444444-4444-4444-8444-444444444444',
  r4: '55555555-5555-4555-8555-555555555555',
  mod: '66666666-6666-4666-8666-666666666666',
};

const V1 = 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1';
const V2 = 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2';
const V3 = 'ddddddd3-dddd-4ddd-8ddd-ddddddddddd3';
const V4 = 'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4';

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.author}', 'author@afrixa.test'),
    ('${U.r1}', 'r1@afrixa.test'),
    ('${U.r2}', 'r2@afrixa.test'),
    ('${U.r3}', 'r3@afrixa.test'),
    ('${U.r4}', 'r4@afrixa.test'),
    ('${U.mod}', 'mod@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.author}', 'auteur', false),
    ('${U.r1}', 'signal1', false),
    ('${U.r2}', 'signal2', false),
    ('${U.r3}', 'signal3', false),
    ('${U.r4}', 'signal4', false),
    ('${U.mod}', 'moderateur', false);

  INSERT INTO public.platform_admins (user_id) VALUES ('${U.mod}');
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.videos (id, user_id, title, is_published, moderation_status, cloudflare_status, privacy)
  VALUES
    ('${V1}', '${U.author}', 'Video signalee', true, 'approved', 'ready', 'public'),
    ('${V2}', '${U.author}', 'Video a masquer', true, 'approved', 'ready', 'public'),
    ('${V3}', '${U.author}', 'Video limite 1', true, 'approved', 'ready', 'public'),
    ('${V4}', '${U.author}', 'Video limite 2', true, 'approved', 'ready', 'public');
`);

await as('authenticated', U.author);
const comment = await one(
  'INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [V1, U.author, 'Commentaire a signaler'],
);
check('Un commentaire normal est accepte', Boolean(comment?.id));

const report = async (user, type, id, reason = 'Contenu inapproprie') => {
  await as('authenticated', user);
  return one(
    'SELECT public.submit_report($1, $2, $3, $4) AS result',
    [type, id, reason, null],
  ).then((row) => row.result);
};
const reportId = async (reporter, type, contentId) => adminOne(
  'SELECT id FROM public.content_reports WHERE reporter_id = $1 AND content_type = $2 AND content_id = $3 ORDER BY created_at DESC LIMIT 1',
  [reporter, type, contentId],
).then((row) => row?.id);

// --- 1. Signalements ------------------------------------------------------
const firstReport = await report(U.r1, 'comment', comment.id);
check(
  'Un signalement est enregistre avec son auteur cible',
  firstReport.status === 'pending'
    && (await adminOne('SELECT target_user_id FROM public.content_reports WHERE id = $1', [firstReport.report_id]))?.target_user_id === U.author,
  JSON.stringify(firstReport),
);

await as('authenticated', U.r1);
await expectError(
  'Un meme utilisateur ne peut pas signaler deux fois',
  () => db.query('SELECT public.submit_report($1, $2, $3, $4)', ['comment', comment.id, 'Doublon', null]),
  /deja ete signale/i,
);

await as('authenticated', U.author);
await expectError(
  'On ne peut pas signaler son propre contenu',
  () => db.query('SELECT public.submit_report($1, $2, $3, $4)', ['comment', comment.id, 'Moi', null]),
  /propre contenu/i,
);

await as('authenticated', U.r1);
await expectError(
  'Un type de contenu inconnu est refuse',
  () => db.query('SELECT public.submit_report($1, $2, $3, $4)', ['foo', comment.id, 'Test', null]),
  /Type de contenu invalide/i,
);

// --- 2. Auto-masquage -----------------------------------------------------
await report(U.r2, 'comment', comment.id);
const thirdReport = await report(U.r3, 'comment', comment.id);
check(
  'Trois signalements masquent automatiquement le commentaire',
  thirdReport.auto_hidden === true
    && (await adminOne('SELECT is_deleted FROM public.comments WHERE id = $1', [comment.id]))?.is_deleted === true,
  JSON.stringify(thirdReport),
);

await report(U.r1, 'video', V1);
await report(U.r2, 'video', V1);
const videoHidden = await report(U.r3, 'video', V1);
check(
  'Trois signalements masquent automatiquement la video',
  videoHidden.auto_hidden === true
    && (await adminOne('SELECT hidden_by_reports FROM public.videos WHERE id = $1', [V1]))?.hidden_by_reports === true,
);

await as('authenticated', U.r4);
check(
  'Une video masquee par signalements n est plus visible',
  (await rows('SELECT id FROM public.videos WHERE id = $1', [V1])).length === 0,
);

// Limite quotidienne.
await as('service_role');
await db.query('UPDATE public.moderation_settings SET max_reports_per_day = 2 WHERE id = 1');
await report(U.r4, 'video', V2);
await report(U.r4, 'video', V3);
await as('authenticated', U.r4);
await expectError(
  'La limite quotidienne de signalements est appliquee',
  () => db.query('SELECT public.submit_report($1, $2, $3, $4)', ['video', V4, 'Encore', null]),
  /Limite quotidienne/i,
);

// --- 3. File de moderation ------------------------------------------------
await as('authenticated', U.r1);
await expectError(
  'Un utilisateur ne peut pas lire la file de moderation',
  () => db.query('SELECT * FROM public.list_moderation_reports($1, $2)', ['pending', 50]),
  /Reserve a la moderation/i,
);

await as('authenticated', U.mod);
const pendingReports = await rows('SELECT * FROM public.list_moderation_reports($1, $2)', ['pending', 50]);
check('Le moderateur voit les signalements en attente', pendingReports.length >= 7, String(pendingReports.length));
check(
  'La file expose les pseudos et le nombre de signalements',
  pendingReports.some((row) => row.target_username === 'auteur' && Number(row.reports_on_content) === 3),
);

await expectError(
  'Un moderateur ne peut pas appliquer de sanction directe invalide',
  () => db.query('SELECT public.apply_user_sanction($1, $2, $3)', [U.author, 'ban_life', 'test']),
  /Sanction invalide/i,
);

// Classement.
const dismissReport = await reportId(U.r4, 'video', V2);
const dismissed = await one(
  'SELECT public.moderate_report($1, $2, $3, $4) AS result',
  [dismissReport, 'dismiss', 'Pas de violation', true],
).then((row) => row.result);
check('Classer un signalement ne sanctionne pas', dismissed.status === 'dismissed', JSON.stringify(dismissed));

// Avertissement.
const warningReport = await reportId(U.r2, 'comment', comment.id);
const warning = await one(
  'SELECT public.moderate_report($1, $2, $3, $4) AS result',
  [warningReport, 'warning', 'Propos limites', true],
).then((row) => row.result);
check('Un avertissement est enregistre', warning.sanction?.action === 'warning');
check(
  'Le destinataire est notifie',
  (await adminOne("SELECT count(*)::int AS c FROM public.notifications WHERE user_id = $1 AND type = 'moderation'", [U.author])).c === 1,
);

// Restriction 24 h.
const restrictReport = await reportId(U.r3, 'comment', comment.id);
const restriction = await one(
  'SELECT public.moderate_report($1, $2, $3, $4) AS result',
  [restrictReport, 'restrict_24h', 'Comportement abusif', true],
).then((row) => row.result);
check('Une restriction de 24 h est appliquee', restriction.sanction?.action === 'restrict_24h');

await as('authenticated', U.author);
await expectError(
  'Un compte restreint ne peut plus commenter',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V2, U.author, 'Je continue']),
  /Compte restreint/i,
);

await as('service_role');
await db.query(
  "UPDATE public.moderation_actions SET expires_at = now() - interval '1 minute' WHERE user_id = $1 AND action_type = 'restrict_24h'",
  [U.author],
);
await as('authenticated', U.author);
const afterExpiry = await one(
  'INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
  [V2, U.author, 'Commentaire apres expiration'],
);
check('Une restriction expiree laisse de nouveau commenter', Boolean(afterExpiry?.id));

// Bannissement direct par un moderateur.
await as('authenticated', U.mod);
const ban = await one(
  'SELECT public.apply_user_sanction($1, $2, $3) AS result',
  [U.author, 'ban_7days', 'Recidive'],
).then((row) => row.result);
check('Un moderateur bannit directement un compte', ban.active === true && ban.action === 'ban_7days');

await as('authenticated', U.r1);
await expectError(
  'Un utilisateur ne peut pas sanctionner',
  () => db.query('SELECT public.apply_user_sanction($1, $2, $3)', [U.author, 'ban_7days', 'Abus']),
  /Reserve a la moderation/i,
);

await as('authenticated', U.author);
const status = await rows('SELECT * FROM public.get_my_moderation_status()');
check(
  'Le compte voit sa sanction active',
  status.some((row) => row.action_type === 'ban_7days' && row.is_active === true),
  JSON.stringify(status),
);
await expectError(
  'Un compte banni ne peut plus publier de commentaire',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V2, U.author, 'Encore']),
  /Compte restreint/i,
);

await as('authenticated', U.r2);
check('Un utilisateur sans sanction ne voit rien', (await rows('SELECT * FROM public.get_my_moderation_status()')).length === 0);

await expectError(
  'Un client ne peut pas ecrire une sanction',
  () => db.query('INSERT INTO public.moderation_actions (user_id, action_type, reason) VALUES ($1, $2, $3)', [U.r2, 'warning', 'Faux']),
  /permission|policy/i,
);

// --- 4. Mots interdits serveur -------------------------------------------
await as('authenticated', U.r1);
await expectError(
  'Un mot interdit grave est refuse a la publication',
  () => db.query('INSERT INTO public.comments (video_id, user_id, content) VALUES ($1, $2, $3)', [V2, U.r1, 'Ceci est de la haine']),
  /termes interdits/i,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
