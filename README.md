# Afrixa

Afrixa est une application mobile-first de social commerce pour l'Afrique francophone : vidéos, marketplace communautaire, messagerie, live commerce et paiements.

## Stack

- Frontend : React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- Backend : Supabase Auth, PostgreSQL, Realtime, Row Level Security et Edge Functions
- Paiements locaux en XOF : FedaPay (checkout hébergé)
- Paiements diaspora : Stripe, à intégrer
- Vidéo : upload TUS et lecture HLS via Cloudflare Stream
- Notifications Web : Firebase Cloud Messaging
- Adresses de livraison : Google Places Autocomplete (nouveau)
- Modération d'images : Google Cloud Vision SafeSearch
- Live : Agora, à intégrer

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

## Vérification SMS (Supabase Auth + Twilio)

L'inscription et la récupération par téléphone utilisent les OTP générés et vérifiés par Supabase Auth. Configurez le fournisseur SMS Twilio dans Supabase Dashboard → Authentication → Providers → Phone ; les identifiants Twilio restent dans cette configuration serveur et ne vont jamais dans les variables `VITE_*`. Activez la confirmation des numéros, définissez les limites d'envoi et activez CAPTCHA pour limiter les abus. Le code n'implémente pas de table OTP parallèle.

## Vidéos (Cloudflare Stream)

L'upload utilise un lien TUS à usage unique créé par une Edge Function authentifiée. Les vidéos de 500 Mo maximum sont envoyées par blocs directement à Cloudflare ; le token API Cloudflare reste côté serveur. Appliquer la migration `20261010100000_cloudflare_stream.sql`, déployer `create-cloudflare-upload`, `complete-cloudflare-upload` et `delete-cloudflare-upload`, puis configurer `CF_STREAM_ACCOUNT_ID`, `CF_STREAM_API_TOKEN` (permission Stream Write) et `CF_STREAM_CUSTOMER_CODE` dans les secrets Edge Functions. La vidéo reste non publiée jusqu'à la fin du traitement et à la modération.

## Notifications push (Firebase Cloud Messaging)

Le client web s'inscrit aux notifications FCM via Firebase Installation IDs (FID), enregistrés dans `user_fcm_tokens`. L'activation se fait à la demande de l'utilisateur dans Paramètres et requiert HTTPS ainsi qu'un navigateur compatible.

Les paramètres `VITE_FIREBASE_*` du `.env` sont la configuration publique de l'application Web Firebase. Ne jamais placer de clé privée de compte de service Firebase ou de clé serveur FCM dans le frontend. Activer l'API Firebase Cloud Messaging HTTP v1 et accorder au compte de service le rôle Firebase Cloud Messaging API Admin. Ajouter `FIREBASE_PROJECT_ID`, le JSON de compte de service dans `FIREBASE_SERVICE_ACCOUNT_JSON` et un secret aléatoire dans `FCM_WEBHOOK_SECRET` aux secrets Edge Functions.

Pour envoyer les notifications déjà créées par l'application, configurer une Database Webhook Supabase sur `public.notifications`, événement `INSERT`, vers `https://<project-ref>.supabase.co/functions/v1/send-push-notification`. Ajouter l'en-tête `x-afrixa-webhook-secret` avec la même valeur que `FCM_WEBHOOK_SECRET`. Cette fonction utilise FCM HTTP v1 côté serveur et supprime les installations FCM expirées.

## Adresses (Google Maps Platform)

Définir `VITE_GOOGLE_MAPS_API_KEY` avec une clé de navigateur restreinte par référent HTTP, activer Maps JavaScript API et Places API (New), et configurer la facturation Google Maps Platform. L'autocomplétion est limitée aux pays d'Afrique de l'Ouest/Centrale utilisés ici ; la saisie manuelle reste disponible si Google Maps est absent ou inaccessible. Appliquer la migration `20261010120000_order_delivery_coordinates.sql` pour enregistrer latitude et longitude des adresses sélectionnées.

## Modération d'images (Google Cloud Vision)

Configurer `GOOGLE_VISION_API_KEY` uniquement dans les secrets des Edge Functions et activer Cloud Vision API côté Google Cloud. Déployer `moderate-image`. La sélection d'une couverture de live est vérifiée côté serveur (fichier limité à 5 Mo) : les résultats évidents sont bloqués et les cas ambigus refusés avec demande de revue, car le projet n'a pas encore de file d'examen humain. En cas d'indisponibilité du service, l'image n'est pas acceptée. Réutiliser `moderateImage` avant toute future publication d'image de profil, produit ou story.

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
