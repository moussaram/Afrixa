import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
let current = { role: 'postgres', sub: null };
let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) passed += 1;
  else failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const as = async (role, sub = null) => {
  await db.exec('RESET ROLE;');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role, sub })]);
  await db.exec('SET ROLE ' + role + ';');
  current = { role, sub };
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const adminOne = async (sql, params = []) => {
  const previous = current;
  await db.exec('RESET ROLE;');
  const result = await one(sql, params);
  await as(previous.role, previous.sub);
  return result;
};
const expectError = async (name, fn, pattern) => {
  try {
    await fn();
    check(name, false, 'Aucune erreur');
  } catch (error) {
    check(name, pattern.test(String(error?.message ?? error)), String(error?.message ?? error));
  }
};

try {
  await db.exec(read('.sqlcheck/stub-phase3-finance.sql'));
  await db.exec(read('supabase/migrations/20261113150000_phase3_financial_checkout_hardening.sql'));
  await db.exec(read('.sqlcheck/stub-phase4-marketplace.sql'));
  await db.exec(read('supabase/migrations/20261113160000_phase4_marketplace_commerce.sql'));

  const buyer = '11111111-1111-4111-8111-111111111111';
  const seller = '22222222-2222-4222-8222-222222222222';
  const variantProduct = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const variantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const fallbackProduct = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const groupProduct = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const cleanupProduct = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  await db.exec('RESET ROLE;');
  await db.exec(`
    INSERT INTO auth.users(id,email) VALUES
      ('${buyer}','buyer@afrixa.test'), ('${seller}','seller@afrixa.test');
    INSERT INTO public.products(id,seller_id,name,images,price,promo_price,stock,is_active)
      VALUES
        ('${variantProduct}','${seller}','Produit avec variantes',ARRAY['https://cdn.test/variant.jpg'],5000,6000,20,true),
        ('${fallbackProduct}','${seller}','Promo invalide',ARRAY['https://cdn.test/fallback.jpg'],5000,6000,5,true),
        ('${groupProduct}','${seller}','Produit groupe',ARRAY['https://cdn.test/group.jpg'],5000,4000,10,true),
        ('${cleanupProduct}','${seller}','Produit cleanup',ARRAY['https://cdn.test/cleanup.jpg'],3000,NULL,2,true);
    UPDATE public.products SET is_group_buy=true WHERE id='${groupProduct}';
    INSERT INTO public.product_variants(id,product_id,name,price,stock)
      VALUES ('${variantId}','${variantProduct}','Taille M',4500,5);
  `);

  await as('authenticated', seller);
  const sellerProduct = await one(
    'SELECT public.create_shop_product_with_variant($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS id',
    ['Boutique atomique','Produit test','Mode',7000,0,'Cotonou','Bénin',['https://cdn.test/new.jpg'],'Bleu',null,4],
  );
  const sellerProductStock = await adminOne('SELECT stock FROM public.products WHERE id=$1',[sellerProduct.id]);
  const sellerVariant = await adminOne('SELECT name,stock FROM public.product_variants WHERE product_id=$1',[sellerProduct.id]);
  check('La boutique crée produit et première variante atomiquement',
    typeof sellerProduct?.id === 'string' && sellerProductStock?.stock === 4
      && sellerVariant?.name === 'Bleu' && sellerVariant?.stock === 4);
  await expectError('Une variante invalide bloque la création du produit', () =>
    db.query('SELECT public.create_shop_product_with_variant($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['Produit invalide',null,'Mode',7000,0,null,null,[],'Rouge',null,-1]),
    /Informations variante invalides/i);
  const sellerVariantId = await adminOne('SELECT id FROM public.product_variants WHERE product_id=$1',[sellerProduct.id]);
  await one(
    'SELECT public.update_shop_product_with_variant($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    [sellerProduct.id,'Boutique atomique modifiée','Produit test','Mode',7500,6,'Cotonou','Bénin',
      ['https://cdn.test/new.jpg'],sellerVariantId.id,'Bleu clair',7500,6],
  );
  const updatedShopProduct = await adminOne('SELECT name,stock FROM public.products WHERE id=$1',[sellerProduct.id]);
  const updatedShopVariant = await adminOne('SELECT name,price,stock FROM public.product_variants WHERE id=$1',[sellerVariantId.id]);
  check('Le vendeur peut modifier son produit et sa variante atomiquement',
    updatedShopProduct?.name === 'Boutique atomique modifiée' && updatedShopProduct?.stock === 6
      && updatedShopVariant?.name === 'Bleu clair' && updatedShopVariant?.price === 7500 && updatedShopVariant?.stock === 6);

  await as('authenticated', buyer);
  await expectError('Un autre utilisateur ne peut pas modifier la boutique', () =>
    db.query('SELECT public.update_shop_product_with_variant($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [sellerProduct.id,'Intrusion',null,'Mode',1,1,null,null,[],sellerVariantId.id,'Bleu',1,1]),
    /Produit introuvable/i);

  await as('authenticated', buyer);
  const variantCheckout = await one(
    'SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result',
    [variantProduct,2,'mtn_open','97000000','Cotonou, Bénin',null,6.37,2.39,variantId,'phase4-variant-key'],
  ).then(row => row.result);
  const variantOrder = await adminOne('SELECT * FROM public.orders WHERE id=$1',[variantCheckout.order_id]);
  const variantStock = await adminOne('SELECT stock FROM public.product_variants WHERE id=$1',[variantId]);
  const productStock = await adminOne('SELECT stock FROM public.products WHERE id=$1',[variantProduct]);
  check('Le checkout variante utilise le prix de la variante', variantOrder?.unit_price === 4500 && variantOrder?.total_price === 9000 && variantOrder?.variant_name === 'Taille M');
  check('Le stock de variante est réservé atomiquement', variantOrder?.stock_reservation_status === 'reserved' && variantStock?.stock === 3 && productStock?.stock === 20);
  check('La référence FedaPay reste liée à la commande', Boolean(variantCheckout.order_ref && variantOrder?.payment_reference === variantCheckout.order_ref));

  await expectError('Un client ne peut pas créer une commande hors checkout sécurisé', () =>
    db.query(`INSERT INTO public.orders(
      buyer_id,seller_id,product_id,product_name,quantity,unit_price,total_price,
      commission_rate,commission_amount,seller_amount,payment_operator
    ) VALUES ($1,$2,$3,'commande directe',1,1,1,0,0,1,'mtn_open')`,[buyer,seller,variantProduct]),
    /secure checkout/i);

  await expectError('Les anciens opérateurs non FedaPay sont refusés', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [fallbackProduct,1,'orange_money','97000000','Cotonou, Bénin',null,null,null,null,'bad-operator']),
    /commande invalides/i);

  await expectError('Les achats groupés restent désactivés', () =>
    db.query('SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [groupProduct,1,'mtn_open','97000000','Cotonou, Bénin',null,null,null,null,'group-buy-key']),
    /achats groupes sont temporairement indisponibles/i);

  const fallbackCheckout = await one(
    'SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result',
    [fallbackProduct,1,'moov','97000000','Cotonou, Bénin',null,null,null,null,'fallback-price-key'],
  ).then(row => row.result);
  const fallbackOrder = await adminOne('SELECT unit_price FROM public.orders WHERE id=$1',[fallbackCheckout.order_id]);
  check('Un prix promotionnel supérieur au prix normal est ignoré', fallbackOrder?.unit_price === 5000);

  const cart1 = await one('SELECT public.add_cart_item($1,1,$2) AS result',[variantProduct,variantId]);
  const cart2 = await one('SELECT public.add_cart_item($1,1,$2) AS result',[variantProduct,variantId]);
  check('Le panier regroupe une même variante et augmente la quantité', cart1?.result?.quantity === 1 && cart2?.result?.quantity === 2);

  await expectError('Un vendeur ne peut pas falsifier le compteur de ventes', () =>
    db.query("UPDATE public.products SET sales_count=999 WHERE id=$1",[variantProduct]),
    /managed by verified payments/i);

  await as('service_role');
  await db.query("UPDATE public.payment_transactions SET status='successful' WHERE order_id=$1",[variantCheckout.order_id]);
  await db.query("UPDATE public.orders SET status='payee' WHERE id=$1",[variantCheckout.order_id]);
  const sale1 = await one('SELECT public.record_product_sale($1) AS result',[variantCheckout.order_id]);
  const sale2 = await one('SELECT public.record_product_sale($1) AS result',[variantCheckout.order_id]);
  const saleCount = await adminOne('SELECT sales_count FROM public.products WHERE id=$1',[variantProduct]);
  check('Les ventes produits sont comptées une seule fois', sale1?.result?.duplicate === false && sale2?.result?.duplicate === true && saleCount?.sales_count === 2);

  await db.exec('RESET ROLE;');
  await db.query("UPDATE public.orders SET status='livree' WHERE id=$1",[variantCheckout.order_id]);
  await as('authenticated', buyer);
  await db.query(
    'INSERT INTO public.reviews(order_id,buyer_id,seller_id,rating,comment) VALUES ($1,$2,$3,5,$4)',
    [variantCheckout.order_id,buyer,seller,'Très bon produit'],
  );
  await as('anon');
  const privateReviews = await one('SELECT count(*)::integer AS count FROM public.reviews');
  const rating = await one('SELECT * FROM public.get_product_rating_summary($1)',[[variantProduct]]);
  check('Les avis individuels restent privés pour les visiteurs', privateReviews?.count === 0);
  check('La note publique est calculée sans exposer les commandes privées', rating?.average_rating === '5.0' || Number(rating?.average_rating) === 5);

  await as('authenticated', buyer);
  const cleanupCheckout = await one(
    'SELECT public.create_order_payment_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result',
    [cleanupProduct,1,'mtn_open','97000000','Cotonou, Bénin',null,null,null,null,'cleanup-key'],
  ).then(row => row.result);
  await db.exec('RESET ROLE;');
  await db.query("UPDATE public.orders SET created_at=now()-interval '2 hours' WHERE id=$1",[cleanupCheckout.order_id]);
  await as('service_role');
  const cleaned = await one("SELECT public.cleanup_expired_checkout_reservations(interval '30 minutes') AS count");
  const cleanupState = await adminOne('SELECT status,stock_reservation_status FROM public.orders WHERE id=$1',[cleanupCheckout.order_id]);
  const cleanupStock = await adminOne('SELECT stock FROM public.products WHERE id=$1',[cleanupProduct]);
  check('Le nettoyage annule les checkouts expirés et restitue le stock',
    cleaned?.count === 1 && cleanupState?.status === 'annulee'
      && cleanupState?.stock_reservation_status === 'released' && cleanupStock?.stock === 2);

  console.log(`\\nPhase 4 : ${passed} vérifications réussies, ${failed} échec(s).`);
  if (failed > 0) throw new Error('Phase 4 SQL checks failed');
} catch (error) {
  console.error('PHASE 4 SQL HARNESS ERROR:', error);
  throw error;
} finally {
  await db.close();
}
