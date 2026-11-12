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
await db.exec(read('.sqlcheck/stub-phase8.sql'));
await db.exec(`
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS prenom text,
    ADD COLUMN IF NOT EXISTS nom text;
`);
await db.exec(read('supabase/migrations/20261025100000_phase8_afrixa_ads.sql'));

const U = {
  advertiser: '11111111-1111-4111-8111-111111111111',
  viewer: '22222222-2222-4222-8222-222222222222',
  other: '33333333-3333-4333-8333-333333333333',
  admin: '44444444-4444-4444-8444-444444444444',
};

await db.exec('RESET ROLE;');
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${U.advertiser}', 'advertiser@afrixa.test'),
    ('${U.viewer}', 'viewer@afrixa.test'),
    ('${U.other}', 'other@afrixa.test'),
    ('${U.admin}', 'admin@afrixa.test');

  INSERT INTO public.profiles (user_id, username, prenom, nom, is_private) VALUES
    ('${U.advertiser}', 'annonceur', 'Awa', 'Traore', false),
    ('${U.viewer}', 'spectateur', 'Koffi', 'Mensah', false),
    ('${U.other}', 'autre', 'Aminata', 'Diallo', false),
    ('${U.admin}', 'moderateur', 'Afrixa', 'Moderation', false);

  INSERT INTO public.platform_admins (user_id) VALUES ('${U.admin}');
`);

const createCampaign = async (interests = [], budget = 5000) => {
  await as('authenticated', U.advertiser);
  const result = await one(
    'SELECT public.create_ad_campaign($1, $2, $3, $4, $5, $6, $7, $8) AS campaign',
    [
      'Campagne Afrixa', 'Description de campagne', 'https://cdn.afrixa.test/visuel.jpg',
      'Découvrir', 'https://afrixa.com/promo', budget, 7, interests,
    ],
  );
  return result.campaign;
};

const payAndActivate = async (campaignId, transactionId) => {
  await as('service_role');
  await db.query('SELECT public.attach_ad_campaign_transaction($1, $2, $3)', [campaignId, transactionId, null]);
  return one('SELECT public.activate_ad_campaign($1, $2) AS result', [campaignId, transactionId]);
};

// --- 1. Tarifs et creation ------------------------------------------------
await as('anon');
const pricing = await one('SELECT cpc_fcfa, min_budget_fcfa FROM public.ad_pricing');
check('Les tarifs publicitaires sont lisibles', pricing?.cpc_fcfa === 50 && pricing?.min_budget_fcfa === 5000, JSON.stringify(pricing));

await as('authenticated', U.advertiser);
await expectError(
  'Un budget sous le minimum est refuse',
  () => db.query(
    'SELECT public.create_ad_campaign($1, $2, $3, $4, $5, $6, $7, $8)',
    ['Trop petit', null, 'https://cdn.afrixa.test/a.jpg', 'Voir', 'https://afrixa.com', 4000, 7, []],
  ),
  /budget minimum/i,
);

await expectError(
  'Un visuel non https est refuse',
  () => db.query(
    'SELECT public.create_ad_campaign($1, $2, $3, $4, $5, $6, $7, $8)',
    ['Visuel', null, 'http://cdn.afrixa.test/a.jpg', 'Voir', 'https://afrixa.com', 5000, 7, []],
  ),
  /https/i,
);

const campaignA = await createCampaign([], 5000);
check(
  'Une campagne est creee en attente de paiement',
  campaignA.status === 'pending' && campaignA.budget === 5000 && campaignA.cpc === 50,
  JSON.stringify(campaignA),
);
check(
  'L annonceur est enregistre',
  (await adminOne('SELECT advertiser_id, advertiser_name FROM public.ad_campaigns WHERE id = $1', [campaignA.campaign_id]))?.advertiser_id === U.advertiser,
);

await expectError(
  'Un client ne peut pas modifier les compteurs de campagne',
  () => db.query('UPDATE public.ad_campaigns SET impressions = 99999 WHERE id = $1', [campaignA.campaign_id]),
  /Afrixa Ads|permission|policy/i,
);

// --- 2. Paiement et activation -------------------------------------------
await as('authenticated', U.advertiser);
await expectError(
  'Un client ne peut pas activer sa campagne sans paiement',
  () => db.query('SELECT public.activate_ad_campaign($1, $2)', [campaignA.campaign_id, '123456']),
  /permission denied/i,
);

await as('service_role');
await db.query('SELECT public.attach_ad_campaign_transaction($1, $2, $3)', [campaignA.campaign_id, '123456', null]);
await expectError(
  'Un client ne peut pas rattacher une transaction',
  async () => {
    await as('authenticated', U.advertiser);
    await db.query('SELECT public.attach_ad_campaign_transaction($1, $2, $3)', [campaignA.campaign_id, '999999', null]);
  },
  /permission denied/i,
);

await as('service_role');
const activated = await one('SELECT public.activate_ad_campaign($1, $2) AS result', [campaignA.campaign_id, '123456']).then((row) => row.result);
check('Le paiement confirme active la campagne', activated.duplicate === false && activated.status === 'active');
check(
  'La campagne active est approuvee et datee',
  (await adminOne('SELECT status, moderation_status, paid_at, ends_at FROM public.ad_campaigns WHERE id = $1', [campaignA.campaign_id]))?.moderation_status === 'approved'
    && Boolean((await adminOne('SELECT ends_at FROM public.ad_campaigns WHERE id = $1', [campaignA.campaign_id]))?.ends_at),
);
const activatedAgain = await one('SELECT public.activate_ad_campaign($1, $2) AS result', [campaignA.campaign_id, '123456']).then((row) => row.result);
check('Une activation rejouee est sans effet', activatedAgain.duplicate === true);

await as('authenticated', U.advertiser);
check('L annonceur voit ses campagnes', (await rows('SELECT * FROM public.get_my_ad_campaigns()')).length === 1);
await as('authenticated', U.other);
check('Un autre utilisateur ne voit pas ces campagnes', (await rows('SELECT * FROM public.get_my_ad_campaigns()')).length === 0);

// --- 3. Diffusion et ciblage ---------------------------------------------
await as('authenticated', U.advertiser);
check('L annonceur ne recoit pas sa propre publicite', (await rows('SELECT * FROM public.get_feed_ad()')).length === 0);

await as('authenticated', U.viewer);
const served = await one('SELECT * FROM public.get_feed_ad()');
check('Une campagne active est servie dans le fil', served?.campaign_id === campaignA.campaign_id, JSON.stringify(served));

// Campagne ciblee sur un centre d interet.
const campaignC = await createCampaign(['Sport'], 6000);
await payAndActivate(campaignC.campaign_id, '222222');
await as('service_role');
await db.query("UPDATE public.ad_campaigns SET status = 'paused' WHERE id = $1", [campaignA.campaign_id]);

await as('authenticated', U.viewer);
check('Une campagne ciblee ignore un profil sans interet', (await rows('SELECT * FROM public.get_feed_ad()')).length === 0);
await db.exec('RESET ROLE;');
await db.query("INSERT INTO public.user_interests (user_id, categories) VALUES ($1, ARRAY['Sport'])", [U.viewer]);
await as('authenticated', U.viewer);
const targeted = await one('SELECT * FROM public.get_feed_ad()');
check('Une campagne ciblee atteint le bon centre d interet', targeted?.campaign_id === campaignC.campaign_id, JSON.stringify(targeted));

// --- 4. Impressions et clics ---------------------------------------------
const impression = await one(
  'SELECT public.record_ad_impression($1) AS result',
  [campaignC.campaign_id],
).then((row) => row.result);
check('Une impression est enregistree', impression.duplicate === false && Boolean(impression.impression_id));
check(
  'Le compteur d impressions suit',
  (await adminOne('SELECT impressions FROM public.ad_campaigns WHERE id = $1', [campaignC.campaign_id]))?.impressions === 1,
);

const duplicateImpression = await one(
  'SELECT public.record_ad_impression($1) AS result',
  [campaignC.campaign_id],
).then((row) => row.result);
check('Une seconde impression immediate est bloquee', duplicateImpression.duplicate === true);

const click = await one(
  'SELECT public.record_ad_click($1) AS result',
  [impression.impression_id],
).then((row) => row.result);
check('Un clic debite le CPC du budget', Number(click.charged_fcfa) === 50 && Number(click.spent_fcfa) === 50, JSON.stringify(click));
check(
  'Les compteurs de clic et de depense sont a jour',
  (await adminOne('SELECT clicks, spent FROM public.ad_campaigns WHERE id = $1', [campaignC.campaign_id]))?.clicks === 1,
);
check(
  'L impression est marquee cliquee',
  (await adminOne('SELECT clicked FROM public.ad_impressions WHERE id = $1', [impression.impression_id]))?.clicked === true,
);

await expectError(
  'Un meme clic ne peut pas etre facture deux fois',
  () => db.query('SELECT public.record_ad_click($1)', [impression.impression_id]),
  /deja ete enregistre/i,
);

await as('authenticated', U.other);
await expectError(
  'Un autre utilisateur ne peut pas cliquer sur cette impression',
  () => db.query('SELECT public.record_ad_click($1)', [impression.impression_id]),
  /introuvable/i,
);

await expectError(
  'Un client ne peut pas inserer une impression',
  () => db.query('INSERT INTO public.ad_impressions (campaign_id, user_id) VALUES ($1, $2)', [campaignC.campaign_id, U.other]),
  /permission|policy/i,
);

// Budget epuise : le clic suivant est refuse.
await as('service_role');
await db.query('UPDATE public.ad_campaigns SET budget = 80 WHERE id = $1', [campaignC.campaign_id]);
await as('authenticated', U.other);
const otherImpression = await one(
  'SELECT public.record_ad_impression($1) AS result',
  [campaignC.campaign_id],
).then((row) => row.result);
await expectError(
  'Un clic au-dela du budget est refuse',
  () => db.query('SELECT public.record_ad_click($1)', [otherImpression.impression_id]),
  /Budget de campagne epuise/i,
);

await as('service_role');
await db.query('UPDATE public.ad_campaigns SET budget = 100 WHERE id = $1', [campaignC.campaign_id]);
await as('authenticated', U.other);
await db.query('SELECT public.record_ad_click($1)', [otherImpression.impression_id]);
check(
  'La campagne se termine quand le budget est consomme',
  (await adminOne('SELECT status, spent FROM public.ad_campaigns WHERE id = $1', [campaignC.campaign_id]))?.status === 'completed',
);

// --- 5. Pause, statistiques et moderation --------------------------------
await as('authenticated', U.other);
await expectError(
  'Un non-annonceur ne peut pas mettre en pause',
  () => db.query('SELECT public.pause_ad_campaign($1)', [campaignA.campaign_id]),
  /introuvable/i,
);

await as('authenticated', U.advertiser);
await db.query('SELECT public.resume_ad_campaign($1)', [campaignA.campaign_id]);
await db.query('SELECT public.pause_ad_campaign($1)', [campaignA.campaign_id]);
check(
  'L annonceur met sa campagne en pause',
  (await adminOne('SELECT status FROM public.ad_campaigns WHERE id = $1', [campaignA.campaign_id]))?.status === 'paused',
);
await db.query('SELECT public.resume_ad_campaign($1)', [campaignA.campaign_id]);
check(
  'L annonceur reprend sa campagne',
  (await adminOne('SELECT status FROM public.ad_campaigns WHERE id = $1', [campaignA.campaign_id]))?.status === 'active',
);

const stats = await rows('SELECT * FROM public.get_my_ad_campaign_stats($1, 14)', [campaignC.campaign_id]);
check('Les statistiques quotidiennes sont reelles', stats.length >= 1 && Number(stats[0].clicks) === 2, JSON.stringify(stats));

await as('authenticated', U.other);
await expectError(
  'Les statistiques sont reservees a l annonceur',
  () => db.query('SELECT * FROM public.get_my_ad_campaign_stats($1, 14)', [campaignC.campaign_id]),
  /introuvable/i,
);

await expectError(
  'Un utilisateur ne peut pas modérer les campagnes',
  () => db.query("SELECT public.review_ad_campaign($1, 'rejected', 'test')", [campaignA.campaign_id]),
  /moderation/i,
);

const campaignD = await createCampaign([], 7000);
await as('authenticated', U.admin);
const reviewed = await one(
  "SELECT public.review_ad_campaign($1, 'rejected', 'Visuel non conforme') AS result",
  [campaignD.campaign_id],
).then((row) => row.result);
check('Un moderateur peut refuser une campagne', reviewed.moderation_status === 'rejected');
check(
  'Une campagne refusee est retiree',
  (await adminOne('SELECT status, rejection_reason FROM public.ad_campaigns WHERE id = $1', [campaignD.campaign_id]))?.status === 'rejected',
);

await as('authenticated', U.viewer);
await expectError(
  'Une campagne refusee ne diffuse plus',
  () => db.query('SELECT public.record_ad_impression($1)', [campaignD.campaign_id]),
  /inactive/i,
);

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok || !result.detail ? '' : ` -> ${result.detail}`}`);
}
console.log(`\n${pass} verifications reussies, ${fail} echec(s).`);
await db.close();
process.exitCode = fail === 0 ? 0 : 1;
