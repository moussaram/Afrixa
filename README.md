# Afrixa

Afrixa est une application mobile-first de social commerce pour l'Afrique francophone : vidéos, marketplace communautaire, messagerie, live commerce et paiements.

## Stack

- Frontend : React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- Backend : Supabase Auth, PostgreSQL, Realtime, Row Level Security et Edge Functions
- Paiements locaux en XOF : FedaPay (checkout hébergé)
- Paiements diaspora : Stripe, à intégrer
- Vidéo, live et notifications : Cloudflare Stream, Agora et Firebase, à intégrer

## Démarrage local

```sh
npm install
npm run dev
```

L'application démarre par défaut sur `http://localhost:8080/`.

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les variables `VITE_SUPABASE_*`. Ne jamais mettre de clé secrète dans le frontend ou dans une variable préfixée par `VITE_`.

Configurer dans les secrets Supabase Edge Functions :

```text
FEDAPAY_API_BASE_URL=https://sandbox-api.fedapay.com
FEDAPAY_SECRET_KEY=...
FEDAPAY_WEBHOOK_SECRET=...
AFRIXA_PUBLIC_URL=https://<domaine-public-de-l-app>
FEDAPAY_PAYOUTS_ENABLED=false
```

Pour la production, utiliser l'URL API FedaPay de production fournie pour le compte marchand. Configurer le webhook FedaPay vers `https://<project-ref>.supabase.co/functions/v1/fedapay-webhook` et définir le secret de signature correspondant dans `FEDAPAY_WEBHOOK_SECRET`. La fonction vérifie la signature et relit la transaction côté serveur.

Les versements aux vendeurs restent désactivés tant que FedaPay n'a pas activé l'API Payout pour le compte marchand. Après activation et configuration des moyens de versement propres à chaque vendeur, définir `FEDAPAY_PAYOUTS_ENABLED=true`.

Appliquer les migrations de `supabase/migrations` avant de déployer les Edge Functions. Le checkout doit être créé et vérifié côté serveur ; le navigateur ne constitue pas une preuve de paiement.

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run preview
```

## Règles de projet

- TypeScript pour le code applicatif.
- Les appels API externes sensibles passent par les Edge Functions Supabase.
- Les clés secrètes ne sont jamais exposées dans le client.
- Les tables Supabase utilisent RLS.
- L'interface reste en français et les prix locaux sont affichés en FCFA.
