import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
let pass = 0;
let fail = 0;
let currentRole = { role: 'postgres', sub: null };
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  if (ok) pass += 1; else fail += 1;
};
const as = async (role, sub = null) => {
  await db.exec('RESET ROLE;');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role, sub })]);
  await db.exec(`SET ROLE ${role};`);
  currentRole = { role, sub };
};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await rows(sql, params))[0] ?? null;
const adminOne = async (sql, params = []) => {
  const previous = currentRole;
  await db.exec('RESET ROLE;');
  const result = await one(sql, params);
  await as(previous.role, previous.sub);
  return result;
};
const expectError = async (name, fn, pattern) => {
  try { await fn(); check(name, false, 'Aucune erreur'); }
  catch (error) { check(name, pattern.test(String(error?.message ?? error)), String(error?.message ?? error)); }
};

try {
  await db.exec(read('.sqlcheck/stub-phase3-finance.sql'));
  await db.exec(read('supabase/migrations/20261113150000_phase3_financial_checkout_hardening.sql'));

  const buyer = '11111111-1111-4111-8111-111111111111';
  const seller = '22222222-2222-4222-8222-222222222222';
  const groupSeller = '33333333-3333-4333-8333-333333333333';
  const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const groupProduct = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const stockProduct = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  await db.exec('RESET ROLE;');
  await db.exec(`
    INSERT INTO auth.users(id,email) VALUES
      ('${buyer}','buyer@test.afrixa'),('${seller}','seller@test.afrixa'),('${groupSeller}','group@test.afrixa');
    INSERT INTO public.products(id,seller_id,name,images,price,promo_price,stock,is_active)
      VALUES ('${product}','${seller}','Produit promo',ARRAY['https://cdn.test/p.jpg'],10000,8000,20,true);
    INSERT INTO public.products(id,seller_id,name,price,stock,is_active,is_group_buy)
      VALUES ('${groupProduct}','${groupSeller}','Produit group buy',5000,20,true,true);
    INSERT INTO public.products(id,seller_id,name,price,stock,is_active)
      VALUES ('${stockProduct}','${seller}','Stock faible',9000,1,true);
    INSERT INTO public.creator_wallet(user_id,balance,pending,total_earned)
      VALUES ('${buyer}',20000,0,20000);
  `);

  await as('authenticated', buyer);
  const created = await one(
    'SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',
    [product, 2, 'mtn_open', '97000000', 'Cotonou, Benin', null, 6.37, 2.39, 'checkout-key-1'],
  ).then((row) => row.result);
  const order = await adminOne('SELECT * FROM public.orders WHERE id=$1', [created.order_id]);
  const tx = await adminOne('SELECT * FROM public.payment_transactions WHERE order_id=$1', [created.order_id]);
  check('Le checkout calcule le prix promo depuis la base', order?.unit_price === 8000 && order?.total_price === 16000);
  check('La commission et le net vendeur sont calcules côté serveur', order?.commission_amount === 800 && order?.seller_amount === 15200 && order?.commission_rate === 0.05);
  check('La transaction est créée dans la même opération', tx?.amount === 16000 && tx?.fedapay_ref === order?.payment_reference);
  check('La référence retournée correspond à la commande', created.order_ref === order?.payment_reference);
  check('Le checkout conserve l opérateur FedaPay valide', order?.payment_operator === 'mtn_open');

  const replay = await one(
    'SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',
    [product, 2, 'mtn_open', '97000000', 'Cotonou, Benin', null, 6.37, 2.39, 'checkout-key-1'],
  ).then((row) => row.result);
  check('Une relance du checkout est idempotente', replay.reused === true && replay.order_id === created.order_id);
  check('Une relance ne crée pas de deuxième commande ni transaction',
    (await adminOne('SELECT count(*)::int AS n FROM public.orders')).n === 1
      && (await adminOne('SELECT count(*)::int AS n FROM public.payment_transactions')).n === 1);

  await expectError('Un opérateur non FedaPay est refusé', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [product,1,'orange_money','97000000','Cotonou',null,null,null,'checkout-invalid-operator']),
    /Parametres de commande invalides/i);
  await expectError('Les achats groupés ne passent pas par le checkout classique', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [groupProduct,1,'mtn_open','97000000','Cotonou',null,null,null,'checkout-group-buy']),
    /achats groupes.*indisponibles/i);
  await expectError('Un stock insuffisant bloque la commande', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [stockProduct,2,'mtn_open','97000000','Cotonou',null,null,null,'checkout-stock']),
    /Stock insuffisant/i);
  await expectError('Un vendeur ne peut pas acheter son propre produit', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [product,1,'mtn_open','97000000','Cotonou',null,null,null,'checkout-self']),
    /propre produit/i);

  // A direct authenticated insert is still normalized by the database trigger.
  const direct = await db.query(`
    INSERT INTO public.orders(
      buyer_id,seller_id,product_id,product_name,quantity,unit_price,total_price,
      commission_rate,commission_amount,seller_amount,payment_operator
    ) VALUES ($1,$2,$3,'prix falsifié',1,1,1,0,0,1,'moov')
    RETURNING id
  `, [buyer, groupSeller, product]);
  const normalized = await adminOne('SELECT * FROM public.orders WHERE id=$1', [direct.rows[0].id]);
  check('Le trigger remplace les montants et le vendeur fournis par le client',
    normalized?.seller_id === seller && normalized?.product_name === 'Produit promo'
      && normalized?.unit_price === 8000 && normalized?.total_price === 8000
      && normalized?.commission_amount === 400 && normalized?.seller_amount === 7600
      && normalized?.payment_reference?.startsWith('AFR-'));
  await expectError('Un client ne peut pas modifier le montant après création', () =>
    db.query('UPDATE public.orders SET total_price=1 WHERE id=$1', [direct.rows[0].id]),
    /Checkout and escrow fields cannot be changed/i);

  const withdrawal = await one(
    'SELECT public.request_my_withdrawal($1,$2,$3,$4) AS result',
    [6000,'mtn_open','97000000','withdrawal-key-1'],
  ).then((row) => row.result);
  check('Le retrait réserve le solde et retourne une demande', withdrawal.status === 'demande' && withdrawal.balance === 14000);
  check('Le retrait reçoit une référence unique', Boolean((await adminOne('SELECT payout_reference FROM public.seller_payouts WHERE id=$1',[withdrawal.payout_id]))?.payout_reference));
  const withdrawalReplay = await one(
    'SELECT public.request_my_withdrawal($1,$2,$3,$4) AS result',
    [6000,'mtn_open','97000000','withdrawal-key-1'],
  ).then((row) => row.result);
  check('Une relance de retrait ne débite pas deux fois', withdrawalReplay.duplicate === true
    && (await adminOne('SELECT balance FROM public.creator_wallet WHERE user_id=$1',[buyer])).balance === 14000);
  await expectError('Un deuxième retrait est bloqué tant que le premier est en cours', () =>
    db.query('SELECT public.request_my_withdrawal($1,$2,$3,$4)', [5000,'mtn_open','97000000','withdrawal-key-2']),
    /deja en cours/i);

  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
  }
  console.log(`\\n${pass} vérifications réussies, ${fail} échec(s).`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (error) {
  console.error('HARNESS ERROR:', error?.message ?? error);
  if (error?.code) console.error('HARNESS CODE:', error.code);
  if (error?.query) console.error('HARNESS QUERY:', String(error.query).slice(0, 500));
  process.exitCode = 1;
} finally {
  await db.close();
}
