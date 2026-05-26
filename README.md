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

Les secrets serveur restent dans les secrets Supabase Edge Functions, jamais dans le frontend:

```txt
SUPABASE_SERVICE_ROLE_KEY
FLUTTERWAVE_SECRET_KEY
FLW_WEBHOOK_SECRET
```

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
