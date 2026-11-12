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
await db.exec(read('supabase/migrations/20261023100000_phase6_coins_gifts.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  sender: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  poor: '44444444-4444-4444-8444-444444444444',
};

const LIVE = 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const ENDED = 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.sender}', 'sender@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.poor}', 'poor@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.creator}', 'createur', false),
    ('${U.sender}', 'expediteur', false),
    ('${U.stranger}', 'inconnu', false),
    ('${U.poor}', 'fauché', false);
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.live_sessions (id, host_id, agora_channel, title, status, privacy, comments_enabled)
  VALUES
    ('${LIVE}',  '${U.creator}', 'chan-coin-live',  'Live cadeaux', 'live',  'public', true),
    ('${ENDED}', '${U.creator}', 'chan-coin-ended', 'Live termine', 'ended', 'public', true);
`);
await db.exec(`UPDATE public.live_sessions SET ended_at = now() WHERE id = '${ENDED}'`);

const pack = async (slug) => adminOne('SELECT id, coins, price_fcfa FROM public.coin_packs WHERE slug = $1', [slug]);
const gift = async (name) => adminOne('SELECT id, price_coins, fcfa_value FROM public.virtual_gifts WHERE name = $1 LIMIT 1', [name]);
const balanceOf = async (userId) => adminOne('SELECT balance FROM public.coin_balances WHERE user_id = $1', [userId]);
const startPurchase = async (userId, slug, reference) => {
  await as('service_role');
  const target = await pack(slug);
  const result = await one(
    'SELECT public.start_coin_purchase($1, $2, $3, $4, $5) AS purchase',
    [userId, target.id, 'fedapay', '0197000000', reference],
  );
  return result.purchase;
};
const settle = async (purchaseId, transactionId, key) => {
  await as('service_role');
  return one(
    'SELECT public.settle_coin_purchase($1, $2, $3, $4) AS result',
    [purchaseId, transactionId, `provider-${transactionId}`, key],
  ).then((row) => row.result);
};

// --- 1. Catalogue serveur -------------------------------------------------
await as('anon');
check('Cinq packs de Coins sont configures', (await rows('SELECT id FROM public.coin_packs')).length === 5);
check('Les packs exposent bonus et prix', Boolean((await one("SELECT * FROM public.coin_packs WHERE slug = 'popular'"))?.bonus_percent === 30));

await as('authenticated', U.sender);
await expectError(
  'Un client ne peut pas modifier les packs',
  () => db.query("INSERT INTO public.coin_packs (slug, name, coins, price_fcfa) VALUES ('hack', 'Hack', 999999, 1)"),
  /permission|policy|row-level/i,
);

await as('anon');
const giftCatalog = await rows('SELECT id, name, price_coins FROM public.virtual_gifts WHERE is_active = true');
check('Le catalogue de cadeaux vient du serveur', giftCatalog.length >= 6 && giftCatalog.some((entry) => entry.name === 'Fusee'));

// --- 2. Achat de Coins ----------------------------------------------------
await as('authenticated', U.sender);
await expectError(
  'Un client ne peut pas creer un achat directement',
  () => db.query(
    "INSERT INTO public.coin_purchases (user_id, coins_amount, fcfa_paid, operator) VALUES ($1, 99999, 0, 'fedapay')",
    [U.sender],
  ),
  /permission|policy|row-level/i,
);

const purchase = await startPurchase(U.sender, 'popular', 'COIN-TEST-1');
check(
  'Une intention d achat reprend le prix du pack',
  purchase?.coins === 1300 && purchase?.price_fcfa === 3500,
  JSON.stringify(purchase),
);
check(
  'L achat reste en attente avant confirmation',
  (await adminOne('SELECT status FROM public.coin_purchases WHERE id = $1', [purchase.purchase_id])).status === 'pending',
);

await as('authenticated', U.sender);
await expectError(
  'Un client ne peut pas regler un achat lui-meme',
  () => db.query('SELECT public.settle_coin_purchase($1, $2, $3, $4)', [purchase.purchase_id, '1', null, 'k1']),
  /permission denied/i,
);

await as('service_role');
await db.query('SELECT public.attach_coin_purchase_transaction($1, $2, $3)', [purchase.purchase_id, '123456', null]);
const settled = await settle(purchase.purchase_id, '123456', `coin_purchase:${purchase.purchase_id}`);
check('Le paiement confirme credite les coins', settled.duplicate === false && Number(settled.balance) === 1300, JSON.stringify(settled));
check('Le solde du portefeuille est a jour', (await balanceOf(U.sender))?.balance === 1300);

const settledAgain = await settle(purchase.purchase_id, '123456', `coin_purchase:${purchase.purchase_id}`);
check('Un webhook rejoue ne credite pas deux fois', settledAgain.duplicate === true && (await balanceOf(U.sender))?.balance === 1300, JSON.stringify(settledAgain));
check(
  'Un seul achat de coins est enregistre',
  (await adminOne('SELECT count(*)::int AS c FROM public.coin_transactions WHERE user_id = $1 AND type = $2', [U.sender, 'purchased'])).c === 1,
);
check(
  'Le journal financier garde une ligne par achat',
  (await adminOne("SELECT count(*)::int AS c FROM public.financial_ledger WHERE user_id = $1 AND operation = 'coin_purchase'", [U.sender])).c === 1,
);

// Paiement refuse : aucun credit.
const failedPurchase = await startPurchase(U.poor, 'starter', 'COIN-TEST-2');
await as('service_role');
await db.query('SELECT public.attach_coin_purchase_transaction($1, $2, $3)', [failedPurchase.purchase_id, '777777', null]);
await db.query('SELECT public.fail_coin_purchase($1, $2, $3)', [failedPurchase.purchase_id, 'declined', '777777']);
check(
  'Un paiement refuse ne credite aucun coin',
  (await balanceOf(U.poor)) === null
    && (await adminOne('SELECT status FROM public.coin_purchases WHERE id = $1', [failedPurchase.purchase_id])).status === 'failed',
);
await expectError(
  'Un achat echoue ne peut plus etre regle',
  () => db.query('SELECT public.settle_coin_purchase($1, $2, $3, $4)', [failedPurchase.purchase_id, '777777', null, 'coin_purchase:x']),
  /non payable/i,
);

// Transaction incoherente.
const mismatch = await startPurchase(U.poor, 'starter', 'COIN-TEST-3');
await as('service_role');
await db.query('SELECT public.attach_coin_purchase_transaction($1, $2, $3)', [mismatch.purchase_id, '888888', null]);
await expectError(
  'Une transaction differente est refusee',
  () => db.query('SELECT public.settle_coin_purchase($1, $2, $3, $4)', [mismatch.purchase_id, '999999', null, 'coin_purchase:y']),
  /incoherente/i,
);

await as('authenticated', U.stranger);
check('Le solde des autres reste invisible', (await rows('SELECT balance FROM public.coin_balances WHERE user_id = $1', [U.sender])).length === 0);
check('Les achats des autres restent invisibles', (await rows('SELECT id FROM public.coin_purchases WHERE user_id = $1', [U.sender])).length === 0);

// --- 3. Envoi de cadeaux --------------------------------------------------
const senderPurchase = await startPurchase(U.sender, 'starter', 'COIN-TEST-4');
await settle(senderPurchase.purchase_id, '555555', `coin_purchase:${senderPurchase.purchase_id}`);
check('Un second achat s ajoute au solde', (await balanceOf(U.sender))?.balance === 1400);

const rose = await gift('Rose');
await as('authenticated', U.sender);
const sent = await one(
  'SELECT public.send_gift($1, $2, $3, $4) AS result',
  [rose.id, LIVE, U.stranger, 'gift-key-1'],
).then((row) => row.result);
check('Un cadeau debite l expediteur', Number(sent.sender_balance) === 1390, JSON.stringify(sent));
check('Le cadeau est attribue a l hote du live', sent.receiver_id === U.creator, sent.receiver_id);
check('Le createur recoit la valeur en FCFA', (await adminOne('SELECT balance FROM public.creator_wallet WHERE user_id = $1', [U.creator]))?.balance === rose.fcfa_value);
check(
  'Le gain createur est confirme',
  (await adminOne("SELECT status, amount FROM public.creator_earnings WHERE user_id = $1 AND type = 'gift_received' ORDER BY created_at DESC LIMIT 1", [U.creator]))?.status === 'confirmed',
);
check(
  'Les deux lignes comptables du cadeau existent',
  (await adminOne("SELECT count(*)::int AS c FROM public.financial_ledger WHERE operation IN ('gift_sent', 'gift_received')")).c === 2,
);
check(
  'L historique des coins reflete le cadeau',
  (await adminOne("SELECT amount FROM public.coin_transactions WHERE user_id = $1 AND type = 'sent_gift'", [U.sender]))?.amount === -rose.price_coins,
);
check('Le cadeau est visible par l expediteur', (await rows('SELECT id FROM public.gift_transactions WHERE live_id = $1', [LIVE])).length === 1);

await as('authenticated', U.poor);
await expectError(
  'Un solde insuffisant bloque le cadeau',
  () => db.query('SELECT public.send_gift($1, $2, $3, $4)', [rose.id, LIVE, U.creator, 'gift-key-poor']),
  /Solde de coins insuffisant/i,
);

await as('authenticated', U.creator);
await expectError(
  'Un createur ne peut pas s envoyer un cadeau',
  () => db.query('SELECT public.send_gift($1, $2, $3, $4)', [rose.id, LIVE, U.creator, 'gift-key-self']),
  /s envoyer|s'envoyer/i,
);

await as('authenticated', U.sender);
await expectError(
  'Un cadeau ne peut pas etre envoye a un live termine',
  () => db.query('SELECT public.send_gift($1, $2, $3, $4)', [rose.id, ENDED, U.creator, 'gift-key-ended']),
  /Live termine/i,
);

await expectError(
  'Un client ne peut pas creer de transaction cadeau',
  () => db.query(
    'INSERT INTO public.gift_transactions (sender_id, receiver_id, live_id, gift_id, coins_spent, fcfa_earned) VALUES ($1, $2, $3, $4, 0, 0)',
    [U.sender, U.creator, LIVE, rose.id],
  ),
  /perm|policy|row-level|serveurs Afrixa/i,
);

await as('authenticated', U.creator);
await expectError(
  'Le createur ne peut pas modifier son portefeuille',
  () => db.query('UPDATE public.creator_wallet SET balance = 999999 WHERE user_id = $1', [U.creator]),
  /serveurs Afrixa|permission|policy/i,
);

await as('authenticated', U.sender);
await expectError(
  'Un utilisateur ne peut pas modifier son solde de coins',
  () => db.query('UPDATE public.coin_balances SET balance = 999999 WHERE user_id = $1', [U.sender]),
  /serveurs Afrixa|permission|policy/i,
);

// Limite anti-rafale.
const boomPurchase = await startPurchase(U.stranger, 'elite', 'COIN-TEST-5');
await settle(boomPurchase.purchase_id, '666666', `coin_purchase:${boomPurchase.purchase_id}`);
await as('authenticated', U.stranger);
for (let index = 0; index < 20; index += 1) {
  await db.query('SELECT public.send_gift($1, $2, $3, $4)', [rose.id, LIVE, U.creator, `gift-burst-${index}`]);
}
await expectError(
  'Les rafales de cadeaux sont limitees',
  () => db.query('SELECT public.send_gift($1, $2, $3, $4)', [rose.id, LIVE, U.creator, 'gift-burst-21']),
  /Trop de cadeaux/i,
);

// --- 4. Remboursement et visibilite ---------------------------------------
const refundPurchase = boomPurchase.purchase_id;
await as('authenticated', U.stranger);
await expectError(
  'Un client ne peut pas rembourser un achat',
  () => db.query('SELECT public.refund_coin_purchase($1, $2)', [refundPurchase, 'refund-key-1']),
  /permission denied/i,
);

await as('service_role');
const refunded = await one('SELECT public.refund_coin_purchase($1, $2) AS result', [refundPurchase, 'refund-key-1']).then((row) => row.result);
check(
  'Un remboursement debite les coins et marque l achat',
  refunded.duplicate === false
    && (await adminOne('SELECT status FROM public.coin_purchases WHERE id = $1', [refundPurchase])).status === 'refunded',
  JSON.stringify(refunded),
);
check('Le solde ne devient jamais negatif', (await balanceOf(U.stranger))?.balance === 0);
const refundedAgain = await one('SELECT public.refund_coin_purchase($1, $2) AS result', [refundPurchase, 'refund-key-1']).then((row) => row.result);
check('Un remboursement rejoue est sans effet', refundedAgain.duplicate === true);

// Cadeau hors live : seul l expediteur et le destinataire le voient.
const directGift = await gift('Coeur');
await as('authenticated', U.sender);
await db.query('SELECT public.send_gift($1, $2, $3, $4)', [directGift.id, null, U.creator, 'gift-key-direct']);
check('Un cadeau direct est visible par son expediteur', (await rows('SELECT id FROM public.gift_transactions WHERE live_id IS NULL')).length === 1);

await as('authenticated', U.stranger);
check('Un cadeau direct reste prive', (await rows('SELECT id FROM public.gift_transactions WHERE live_id IS NULL')).length === 0);
check('Les cadeaux de live restent visibles aux participants', (await rows('SELECT id FROM public.gift_transactions WHERE live_id = $1', [LIVE])).length >= 20);

await as('authenticated', U.creator);
check(
  'Le createur voit les cadeaux recus',
  (await rows('SELECT id FROM public.gift_transactions WHERE receiver_id = $1', [U.creator])).length >= 2,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
