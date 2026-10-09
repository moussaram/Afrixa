# Afrixa

Afrixa est une application mobile-first de social commerce pour l'Afrique francophone. Elle combine un feed de videos courtes, une marketplace communautaire, la messagerie, le live commerce et les paiements Mobile Money en FCFA via Flutterwave.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Supabase Auth, PostgreSQL, Realtime, Row Level Security, Edge Functions
- Paiement: Flutterwave
- Video cible: Cloudflare Stream
- Live cible: Agora
- Notifications cible: Firebase Cloud Messaging
- SMS/OTP cible: Twilio

## Demarrage local

```sh
npm install
npm run dev
```

L'application demarre par defaut sur:

```txt
http://localhost:8080/
```

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run preview
```

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs locales.

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Les clés privées ne doivent jamais être ajoutées au `.env` Vite, au bundle client ou préfixées par `VITE_`. Configure les secrets dans Supabase Edge Functions (Dashboard > Edge Functions > Secrets, ou CLI):

```txt
SUPABASE_SERVICE_ROLE_KEY
FLUTTERWAVE_SECRET_KEY
FLW_WEBHOOK_SECRET
```

Pour Flutterwave, configure `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY` et `FLW_WEBHOOK_SECRET` dans les secrets Edge Functions. Le webhook Flutterwave doit pointer vers `https://<project-ref>.supabase.co/functions/v1/flutterwave-webhook` et utiliser le même secret hash. Active les événements `charge.completed` et `transfer.completed`.

Les migrations du dossier `supabase/migrations` doivent être appliquées au projet Supabase avant de déployer les Edge Functions correspondantes. La migration de sécurité des paiements verrouille les montants issus des produits et réserve les modifications d'état financier aux fonctions serveur.

Twilio peut être utilisé comme fournisseur SMS d'OTP de Supabase Auth, mais il n'est pas appelé directement depuis le frontend. Les intégrations Cloudflare Stream, Agora, Firebase et Google décrites dans le document de travail ne sont pas encore présentes dans le dépôt et nécessitent leurs comptes et secrets avant activation. Google Cloud Storage est facultatif : Supabase Storage reste le stockage média existant.

## Regles projet

- TypeScript pour tout le code applicatif.
- Les appels API externes sensibles passent par des Edge Functions Supabase.
- Les cles secretes ne doivent jamais etre exposees avec le prefixe `VITE_`.
- Les tables Supabase doivent avoir RLS active.
- L'interface utilisateur reste en francais.
- Les prix affiches dans le produit sont en FCFA.

## Priorites fonctionnelles

1. Authentification Supabase complete, incluant OAuth Google.
2. Upload et lecture video via Cloudflare Stream.
3. Feed video connecte a Supabase.
4. Paiements Flutterwave en mode test.
5. Notifications push via FCM.
