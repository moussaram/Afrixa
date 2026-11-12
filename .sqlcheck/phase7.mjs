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
await db.exec(read('.sqlcheck/stub-phase7.sql'));
await db.exec(read('supabase/migrations/20261024100000_phase7_monetization.sql'));

const U = {
  creator: '11111111-1111-4111-8111-111111111111',
  supporter: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
  viewer1: '44444444-4444-4444-8444-444444444444',
  viewer2: '55555555-5555-4555-8555-555555555555',
  viewer3: '66666666-6666-4666-8666-666666666666',
};

const VIDEO = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1';

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.creator}', 'creator@afrixa.test'),
    ('${U.supporter}', 'supporter@afrixa.test'),
    ('${U.stranger}', 'stranger@afrixa.test'),
    ('${U.viewer1}', 'v1@afrixa.test'),
    ('${U.viewer2}', 'v2@afrixa.test'),
    ('${U.viewer3}', 'v3@afrixa.test');

  INSERT INTO public.profiles (user_id, username, is_private) VALUES
    ('${U.creator}', 'createur', false),
    ('${U.supporter}', 'soutien', false),
    ('${U.stranger}', 'inconnu', false),
    ('${U.viewer1}', 'v1', false),
    ('${U.viewer2}', 'v2', false),
    ('${U.viewer3}', 'v3', false);
`);

await as('service_role');
await db.exec(`
  INSERT INTO public.videos (id, user_id, title, is_published, moderation_status, cloudflare_status, privacy)
  VALUES ('${VIDEO}', '${U.creator}', 'Video monétisable', true, 'approved', 'ready', 'public');

  INSERT INTO public.coin_balances (user_id, balance, lifetime_earned, lifetime_spent)
  VALUES ('${U.supporter}', 1000, 0, 0);

  INSERT INTO public.creator_wallet (user_id, balance, pending, total_earned)
  VALUES ('${U.creator}', 0, 0, 0);
`);

const wallet = async () => adminOne('SELECT balance, pending FROM public.creator_wallet WHERE user_id = $1', [U.creator]);
const coinBalance = async (userId) => (await adminOne('SELECT balance FROM public.coin_balances WHERE user_id = $1', [userId]))?.balance;

// --- 1. Reglages serveur ---------------------------------------------------
await as('anon');
check('Les reglages monetaires sont lisibles', (await rows('SELECT min_withdrawal_fcfa FROM public.monetization_settings')).length === 1);

await as('authenticated', U.creator);
await expectError(
  'Un client ne peut pas modifier les reglages monetaires',
  () => db.query('UPDATE public.monetization_settings SET tip_fcfa_per_coin = 999'),
  /permission|policy|row-level/i,
);

// --- 2. Pourboires --------------------------------------------------------
await as('authenticated', U.supporter);
const tip = await one(
  'SELECT public.send_tip($1, $2, $3) AS result',
  [VIDEO, 100, 'tip-key-1'],
).then((row) => row.result);
check('Un pourboire debite les coins du spectateur', Number(tip.sender_balance) === 900, JSON.stringify(tip));
check('Le createur recoit la valeur FCFA du pourboire', Number(tip.fcfa_earned) === 500 && (await wallet()).balance === 500);
check(
  'Le gain pourboire est confirme',
  (await adminOne("SELECT status, amount FROM public.creator_earnings WHERE user_id = $1 AND type = 'tip_received'", [U.creator]))?.status === 'confirmed',
);
check(
  'Les deux lignes comptables du pourboire existent',
  (await adminOne("SELECT count(*)::int AS c FROM public.financial_ledger WHERE operation IN ('tip_sent', 'tip_received')")).c === 2,
);
check('Le solde du spectateur est a jour', (await coinBalance(U.supporter)) === 900);

const duplicateTip = await one(
  'SELECT public.send_tip($1, $2, $3) AS result',
  [VIDEO, 100, 'tip-key-1'],
).then((row) => row.result);
check(
  'Un pourboire rejoue ne debite pas deux fois',
  duplicateTip.duplicate === true && (await coinBalance(U.supporter)) === 900,
  JSON.stringify(duplicateTip),
);

await expectError(
  'Un pourboire trop faible est refuse',
  () => db.query('SELECT public.send_tip($1, $2, $3)', [VIDEO, 5, 'tip-key-min']),
  /minimum/i,
);

await as('authenticated', U.creator);
await expectError(
  'Un createur ne peut pas se soutenir',
  () => db.query('SELECT public.send_tip($1, $2, $3)', [VIDEO, 10, 'tip-key-self']),
  /soutenir soi-meme/i,
);

await as('authenticated', U.stranger);
await expectError(
  'Un solde insuffisant bloque le pourboire',
  () => db.query('SELECT public.send_tip($1, $2, $3)', [VIDEO, 10, 'tip-key-poor']),
  /Solde de coins insuffisant/i,
);

await as('authenticated', U.supporter);
for (let index = 0; index < 9; index += 1) {
  await db.query('SELECT public.send_tip($1, $2, $3)', [VIDEO, 10, `tip-burst-${index}`]);
}
await expectError(
  'Les rafales de pourboires sont limitees',
  () => db.query('SELECT public.send_tip($1, $2, $3)', [VIDEO, 10, 'tip-burst-11']),
  /Trop de pourboires/i,
);

// --- 3. Bonus de vues -----------------------------------------------------
await as('service_role');
await db.query('UPDATE public.monetization_settings SET view_bonus_fcfa_per_1000 = 10000 WHERE id = 1');
await db.exec(`
  INSERT INTO public.video_watch_history (user_id, video_id, watch_duration, last_watched_at) VALUES
    ('${U.viewer1}', '${VIDEO}', 42, now()),
    ('${U.viewer2}', '${VIDEO}', 12, now()),
    ('${U.viewer3}', '${VIDEO}', 8, now()),
    ('${U.creator}', '${VIDEO}', 300, now()),
    ('${U.stranger}', '${VIDEO}', 1, now());
`);

await as('authenticated', U.creator);
await expectError(
  'Un client ne peut pas calculer les bonus de vues',
  () => db.query('SELECT public.accrue_view_earnings(current_date, current_date)'),
  /permission|reserve au serveur/i,
);

await as('service_role');
const accrual = await one('SELECT public.accrue_view_earnings(current_date, current_date) AS result').then((row) => row.result);
check(
  'Les vues eligibles sont converties en gain',
  Number(accrual.processed) === 1 && Number(accrual.amount) === 30,
  JSON.stringify(accrual),
);
check('Le gain de vues est en attente de validation', (await wallet()).pending === 30);
check(
  'Les vues du createur et les vues trop courtes sont exclues',
  (await adminOne('SELECT eligible_views FROM public.creator_earning_periods WHERE user_id = $1', [U.creator]))?.eligible_views === 3,
);

const accrualAgain = await one('SELECT public.accrue_view_earnings(current_date, current_date) AS result').then((row) => row.result);
check('Une periode deja calculee ne verse rien deux fois', Number(accrualAgain.processed) === 0, JSON.stringify(accrualAgain));

const pendingEarning = await adminOne("SELECT id FROM public.creator_earnings WHERE user_id = $1 AND type = 'views_bonus' AND status = 'pending'", [U.creator]);
await expectError(
  'Un client ne peut pas valider ses gains',
  async () => {
    await as('authenticated', U.creator);
    await db.query('SELECT public.approve_creator_earning($1)', [pendingEarning.id]);
  },
  /permission denied/i,
);

await as('service_role');
const approved = await one('SELECT public.approve_creator_earning($1) AS result', [pendingEarning.id]).then((row) => row.result);
check('Valider un gain le rend disponible', approved.duplicate === false && (await wallet()).pending === 0 && (await wallet()).balance === 980, JSON.stringify(approved));

const approvedAgain = await one('SELECT public.approve_creator_earning($1) AS result', [pendingEarning.id]).then((row) => row.result);
check('Valider deux fois ne credite pas deux fois', approvedAgain.duplicate === true && (await wallet()).balance === 980);

// --- 4. Revenus par periode -----------------------------------------------
await as('authenticated', U.creator);
const revenue = await rows('SELECT * FROM public.get_my_revenue(date_trunc(\'month\', current_date)::date, current_date)');
const revenueTotal = revenue.reduce((sum, row) => sum + Number(row.total), 0);
check('Les revenus sont filtres par periode', revenueTotal === 980, JSON.stringify(revenue));
check(
  'Les revenus sont regroupes par type',
  revenue.some((row) => row.type === 'tip_received') && revenue.some((row) => row.type === 'views_bonus'),
);

await as('authenticated', U.stranger);
check('Un utilisateur ne voit pas les revenus des autres', (await rows('SELECT * FROM public.get_my_revenue(current_date - 30, current_date)')).length === 0);

// --- 5. Retraits ----------------------------------------------------------
await as('authenticated', U.creator);
await expectError(
  'Un retrait sous le minimum est refuse',
  () => db.query('SELECT public.request_my_withdrawal($1, $2, $3, $4)', [4000, 'wave_ci', '0700000000', 'wd-min']),
  /minimum/i,
);

await as('service_role');
await db.query('UPDATE public.creator_wallet SET balance = 20000 WHERE user_id = $1', [U.creator]);

await as('authenticated', U.creator);
const withdrawal = await one(
  'SELECT public.request_my_withdrawal($1, $2, $3, $4) AS result',
  [6000, 'wave_ci', '0700000000', 'wd-key-1'],
).then((row) => row.result);
check('Une demande de retrait reserve le montant', Number(withdrawal.balance) === 14000 && withdrawal.status === 'demande', JSON.stringify(withdrawal));

const payout = await adminOne('SELECT id, status, payout_reference, order_id FROM public.seller_payouts WHERE seller_id = $1', [U.creator]);
check('Le retrait est enregistre avec une reference', payout?.status === 'demande' && Boolean(payout?.payout_reference) && payout?.order_id === null);

check(
  'Le journal comptable trace la demande de retrait',
  (await adminOne("SELECT count(*)::int AS c FROM public.financial_ledger WHERE operation = 'withdrawal_request' AND user_id = $1", [U.creator])).c === 1,
);

await expectError(
  'Un second retrait simultane est refuse',
  () => db.query('SELECT public.request_my_withdrawal($1, $2, $3, $4)', [5000, 'wave_ci', '0700000000', 'wd-key-2']),
  /deja en cours/i,
);

await expectError(
  'Un client ne peut pas annuler un retrait',
  () => db.query('SELECT public.fail_creator_withdrawal($1, $2)', [payout.id, 'test']),
  /permission denied/i,
);

await as('service_role');
const failed = await one('SELECT public.fail_creator_withdrawal($1, $2) AS result', [payout.id, 'provider_failed']).then((row) => row.result);
check('Un retrait echoue restitue le solde', Number(failed.balance) === 20000 && (await wallet()).balance === 20000, JSON.stringify(failed));
check(
  'Le remboursement de retrait est trace',
  (await adminOne("SELECT count(*)::int AS c FROM public.financial_ledger WHERE operation = 'adjustment' AND reference_id = $1", [payout.id])).c === 1,
);

// Limite quotidienne : chaque nouvelle demande est traitee puis echoue, ce qui
// laisse le solde intact mais compte pour la journee.
for (const key of ['wd-key-3', 'wd-key-4']) {
  await as('authenticated', U.creator);
  await db.query('SELECT public.request_my_withdrawal($1, $2, $3, $4)', [5000, 'wave_ci', '0700000000', key]);
  await as('service_role');
  const latest = await adminOne("SELECT id FROM public.seller_payouts WHERE seller_id = $1 AND status = 'demande' ORDER BY created_at DESC LIMIT 1", [U.creator]);
  await db.query('SELECT public.fail_creator_withdrawal($1, $2)', [latest.id, 'test_rollback']);
}
await as('authenticated', U.creator);
await expectError(
  'La limite quotidienne de retraits est appliquee',
  () => db.query('SELECT public.request_my_withdrawal($1, $2, $3, $4)', [5000, 'wave_ci', '0700000000', 'wd-key-5']),
  /Limite quotidienne/i,
);

const history = await rows('SELECT * FROM public.get_my_withdrawals(20)');
check('Le createur voit son historique de retraits', history.length === 3, String(history.length));
check('Les numeros de retrait sont masques', history.every((row) => row.phone_masked.includes('***')));

await as('authenticated', U.stranger);
check('Un utilisateur ne voit pas les retraits des autres', (await rows('SELECT * FROM public.get_my_withdrawals(20)')).length === 0);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
