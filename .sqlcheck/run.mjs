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

const as = async (role, sub = null) => {
  await db.exec('RESET ROLE;');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub, role }),
  ]);
  await db.exec(`SET ROLE ${role};`);
};

const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const expectError = async (name, fn, matcher) => {
  try {
    await fn();
    check(name, false, 'aucune erreur levee');
    return null;
  } catch (error) {
    const message = String(error?.message ?? error);
    check(name, matcher ? matcher.test(message) : true, message);
    return message;
  }
};

await db.exec(read('.sqlcheck/stub.sql'));
await db.exec(read('supabase/migrations/20261018100000_phase1_security_financial_foundations.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  follower: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  blocked: '44444444-4444-4444-8444-444444444444',
};

const V = {
  public: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  followers: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  private: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  pending: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  uploading: 'aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  rejected: 'aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
  notReady: 'aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
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
  INSERT INTO public.videos (id, user_id, title, is_published, moderation_status, privacy, cloudflare_status) VALUES
    ('${V.public}',    '${U.creator}', 'publique',      true,  'approved', 'public',    'ready'),
    ('${V.followers}', '${U.creator}', 'abonnes',       true,  'approved', 'followers', 'ready'),
    ('${V.private}',   '${U.creator}', 'privee',        true,  'approved', 'private',   'ready'),
    ('${V.pending}',   '${U.creator}', 'en moderation', true,  'pending',  'public',    'ready'),
    ('${V.uploading}', '${U.creator}', 'en upload',     true,  'approved', 'public',    'uploading'),
    ('${V.rejected}',  '${U.creator}', 'refusee',       false, 'rejected', 'public',    'ready'),
    ('${V.notReady}',  '${U.creator}', 'non publiee',   false, 'approved', 'public',    'uploading');
`);

const visibleIds = async () => (await rows('SELECT id::text AS id FROM public.videos')).map((row) => row.id).sort();
const sameSet = (actual, expected) =>
  actual.length === expected.length && [...expected].sort().every((id, index) => id === actual[index]);

// --- 1. Visibilite des videos ------------------------------------------------
await as('authenticated', U.stranger);
check(
  'Un inconnu ne voit que les videos publiques approuvees et pretes',
  sameSet(await visibleIds(), [V.public]),
  JSON.stringify(await visibleIds()),
);

await as('authenticated', U.follower);
check(
  'Un abonne voit les videos publiques et reservees aux abonnes, jamais le prive',
  sameSet(await visibleIds(), [V.public, V.followers]),
  JSON.stringify(await visibleIds()),
);

await as('authenticated', U.blocked);
check('Un utilisateur bloque ne voit aucune video du createur', (await visibleIds()).length === 0);

await as('authenticated', U.creator);
check('Le createur voit toutes ses videos', (await visibleIds()).length === 7);

await db.exec('RESET ROLE;');
await db.query('UPDATE public.profiles SET is_private = true WHERE user_id = $1', [U.creator]);
await as('authenticated', U.stranger);
check('Un profil prive masque ses videos publiques aux non-abonnes', (await visibleIds()).length === 0);
await as('authenticated', U.follower);
check('Un profil prive reste visible par ses abonnes', sameSet(await visibleIds(), [V.public, V.followers]));
await db.exec('RESET ROLE;');
await db.query('UPDATE public.profiles SET is_private = false WHERE user_id = $1', [U.creator]);

// --- 2. Integrite de publication / moderation --------------------------------
await as('authenticated', U.creator);
await expectError(
  "Un createur ne peut pas s'auto-approuver",
  () => db.query("UPDATE public.videos SET moderation_status = 'approved' WHERE id = $1", [V.pending]),
  /moderation des videos/i,
);
await expectError(
  'Une video non prete ne peut pas etre publiee',
  () => db.query('UPDATE public.videos SET is_published = true WHERE id = $1', [V.notReady]),
  /prete avant publication/i,
);
await db.query("UPDATE public.videos SET title = 'titre modifie' WHERE id = $1", [V.notReady]);
check('Le createur peut modifier les champs autorises', true);

await expectError(
  'Une video refusee ne peut pas etre publiee',
  () => db.query('UPDATE public.videos SET is_published = true WHERE id = $1', [V.rejected]),
  /refusee/i,
);

await db.query(
  `INSERT INTO public.videos (user_id, title, is_published, moderation_status, cloudflare_status)
   VALUES ($1, 'auto-publication', true, 'approved', 'ready') RETURNING id`,
  [U.creator],
);
const [selfPublished] = (await db.query(
  "SELECT is_published, moderation_status, cloudflare_status FROM public.videos WHERE title = 'auto-publication'",
)).rows;
check(
  'Une insertion cliente est forcee en brouillon non modere',
  selfPublished.is_published === false
    && selfPublished.moderation_status === 'pending'
    && selfPublished.cloudflare_status === 'uploading',
  JSON.stringify(selfPublished),
);

// --- 3. Ecritures financieres bloquees --------------------------------------
await expectError(
  'Un createur ne peut plus insérer de revenus',
  () => db.query(
    "INSERT INTO public.creator_earnings (user_id, type, amount, status) VALUES ($1, 'tip_received', 500, 'confirmed')",
    [U.creator],
  ),
  /permission denied|Seuls les serveurs/i,
);
await expectError(
  'Un createur ne peut plus modifier son portefeuille',
  () => db.query('UPDATE public.creator_wallet SET balance = 999999 WHERE user_id = $1', [U.creator]),
  /permission denied/i,
);
await expectError(
  'Le journal financier est inaccessible en ecriture',
  () => db.query("DELETE FROM public.financial_ledger WHERE idempotency_key = 'buy-1'"),
  /permission denied/i,
);
await expectError(
  "Un client ne peut pas appeler l'operation serveur",
  () => db.query('SELECT public.credit_coin_purchase($1, 10, 500, $2, $3, $4)', [U.creator, 'wave', 'p1', 'k1']),
  /permission denied/i,
);

// --- 4. Achat de coins idempotent -------------------------------------------
await as('service_role');
const [purchase] = (await db.query(
  'SELECT public.credit_coin_purchase($1, 1000, 5000, $2, $3, $4) AS result',
  [U.creator, 'wave', 'provider-ref-1', 'buy-1'],
)).rows;
check('Achat de coins credite le solde', purchase.result.balance === 1000 && purchase.result.duplicate === false);

const [purchaseAgain] = (await db.query(
  'SELECT public.credit_coin_purchase($1, 1000, 5000, $2, $3, $4) AS result',
  [U.creator, 'wave', 'provider-ref-1', 'buy-1'],
)).rows;
check(
  'Un webhook rejoue ne double pas le credit',
  purchaseAgain.result.duplicate === true && purchaseAgain.result.balance === 1000,
  JSON.stringify(purchaseAgain.result),
);
const [{ count: purchaseRows }] = await rows(
  "SELECT count(*)::int AS count FROM public.financial_ledger WHERE operation = 'coin_purchase' AND user_id = $1",
  [U.creator],
);
check('Une seule ligne comptable pour un achat rejoue', purchaseRows === 1);

await db.query('SELECT public.credit_coin_purchase($1, 100, 500, $2, $3, $4)', [
  U.follower, 'orange', 'provider-ref-2', 'buy-2',
]);

// --- 5. Journal immuable (une ligne existe maintenant) ----------------------
await db.exec('RESET ROLE;');
await expectError(
  'Le journal financier refuse les modifications',
  () => db.query("UPDATE public.financial_ledger SET fcfa_delta = 1 WHERE idempotency_key = 'buy-1'"),
  /append-only/i,
);

// --- 6. Cadeaux virtuels -----------------------------------------------------
await as('service_role');
const [gift] = (await db.query(
  "INSERT INTO public.virtual_gifts (name, emoji, price_coins, fcfa_value) VALUES ('Rose', '*', 10, 50) RETURNING id",
)).rows;
const [expensiveGift] = (await db.query(
  "INSERT INTO public.virtual_gifts (name, emoji, price_coins, fcfa_value) VALUES ('Couronne', '*', 5000, 25000) RETURNING id",
)).rows;

const [sent] = (await db.query(
  'SELECT public.send_virtual_gift($1, $2, $3, NULL, $4) AS result',
  [U.follower, U.creator, gift.id, 'gift-1'],
)).rows;
check(
  'Un cadeau debite l expediteur et credite le createur',
  sent.result.sender_balance === 90 && sent.result.receiver_balance === 50,
  JSON.stringify(sent.result),
);
const [sentAgain] = (await db.query(
  'SELECT public.send_virtual_gift($1, $2, $3, NULL, $4) AS result',
  [U.follower, U.creator, gift.id, 'gift-1'],
)).rows;
check('Un cadeau rejoue est ignore', sentAgain.result.duplicate === true);

await expectError(
  'Un cadeau sans solde suffisant est refuse',
  () => db.query('SELECT public.send_virtual_gift($1, $2, $3, NULL, $4)', [U.follower, U.creator, expensiveGift.id, 'gift-2']),
  /Solde de coins insuffisant/i,
);

// --- 7. Revenus et retraits --------------------------------------------------
const [earning] = (await db.query(
  "SELECT public.credit_creator_earning($1, NULL, 'tip_received', 200, NULL, 'tip-1') AS result",
  [U.creator],
)).rows;
check(
  'Un pourboire credite le portefeuille',
  earning.result.balance === 250 && earning.result.status === 'confirmed',
  JSON.stringify(earning.result),
);

const [withdrawal] = (await db.query(
  'SELECT public.request_creator_withdrawal($1, 100, $2, $3, $4) AS result',
  [U.creator, 'wave', '+225 07 00 00 00 00', 'wd-1'],
)).rows;
check(
  'Une demande de retrait reserve le solde',
  withdrawal.result.balance === 150 && withdrawal.result.status === 'demande',
  JSON.stringify(withdrawal.result),
);

const [withdrawalAgain] = (await db.query(
  'SELECT public.request_creator_withdrawal($1, 100, $2, $3, $4) AS result',
  [U.creator, 'wave', '+225 07 00 00 00 00', 'wd-1'],
)).rows;
check('Un retrait rejoue ne debite pas deux fois', withdrawalAgain.result.duplicate === true);

await expectError(
  'Un retrait superieur au solde est refuse',
  () => db.query('SELECT public.request_creator_withdrawal($1, 9999, $2, $3, $4)', [U.creator, 'wave', '+2250700000000', 'wd-2']),
  /Solde disponible insuffisant/i,
);

// --- 8. Defense en profondeur du verrou trigger -----------------------------
// RLS bloque deja l'ecriture cliente ; on verifie en plus que le trigger
// refuse une ecriture qui contournerait RLS (ici le role proprietaire).
await db.exec('RESET ROLE;');
await db.query("select set_config('request.jwt.claims', $1, false)", [
  JSON.stringify({ sub: U.creator, role: 'authenticated' }),
]);
await expectError(
  'Le verrou trigger bloque une ecriture qui contourne RLS',
  () => db.query('UPDATE public.creator_wallet SET balance = 999999 WHERE user_id = $1', [U.creator]),
  /Seuls les serveurs Afrixa/i,
);
await db.query("select set_config('request.jwt.claims', '', false)");
const [walletAfterLock] = (await db.query(
  'SELECT balance FROM public.creator_wallet WHERE user_id = $1',
  [U.creator],
)).rows;
check('Le solde du portefeuille reste inchange', walletAfterLock.balance === 150, JSON.stringify(walletAfterLock));

// --- 9. Lecture du journal ---------------------------------------------------
const [{ count: ledgerRows }] = await rows(
  'SELECT count(*)::int AS count FROM public.financial_ledger WHERE user_id = $1',
  [U.creator],
);
await as('authenticated', U.creator);
const [{ count: readableRows }] = await rows('SELECT count(*)::int AS count FROM public.financial_ledger');
check('Le createur lit son propre journal', readableRows === ledgerRows, `${readableRows} vs ${ledgerRows}`);

await as('authenticated', U.stranger);
const [{ count: foreignRows }] = await rows('SELECT count(*)::int AS count FROM public.financial_ledger');
check('Un autre utilisateur ne lit pas le journal du createur', foreignRows === 0);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
