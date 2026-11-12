# AFRIXA — RAPPORT DE TESTS DE RÉFÉRENCE

**Date :** 7 novembre 2026  
**Référence :** main `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70`.  
**Nature :** tests de disponibilité des outils et analyse statique ; pas une certification fonctionnelle.

## 1. Environnement local

- Node : `v22.16.0`.
- npm : `10.9.2`.
- Archive de travail sans dossier Git.
- Dépendances installées incomplètes : exécutables Vite et ESLint absents.

## 2. Commandes exécutées

| Commande | Résultat réel | Interprétation |
|---|---|---|
| `npm run build` | échec : `sh: 1: vite: not found` | build non exécuté, pas une preuve d'erreur source |
| `npm run lint` | échec : `sh: 1: eslint: not found` | lint non exécuté |
| `npm run` | scripts listés ; aucun `test` | pas de commande de tests déclarée |
| inventaire GitHub main | 363 blobs, arbre non tronqué | inventaire des fichiers |
| inventaire SQL | 22 migrations, 68 tables distinctes | analyse statique du schéma versionné |
| inventaire Edge | 13 fonctions | analyse statique des endpoints |
| types Supabase | 18 tables | écart de couverture avec migrations |

## 3. Tests non exécutés

- Tests unitaires frontend.
- Tests de composants et interactions.
- Tests d'intégration Supabase/PostgREST/Realtime.
- Tests RLS avec anon, utilisateur A, utilisateur B, propriétaire, vendeur, acheteur, modérateur et admin.
- Tests Edge Functions.
- Tests migrations sur base vierge et base existante.
- Tests FedaPay sandbox et webhooks signés/rejoués.
- Tests Cloudflare TUS et modération.
- Tests Agora host/audience.
- Tests FCM et service worker.
- Tests Android Capacitor et PWA.
- Tests charge, concurrence stock, paiements, coins et payout.
- Scan SAST, dépendances, secrets et vulnérabilités.

## 4. Scénarios prioritaires à créer

1. Lecture profil : anon ne peut jamais lire téléphone/date de naissance.
2. Finance : un utilisateur ne peut pas augmenter son propre solde, revenu ou achat coins.
3. Notification : utilisateur A ne peut pas créer une notification arbitraire pour B.
4. Vidéo : aucun client ne peut publier une vidéo non modérée.
5. Edge privilégiée : appel sans rôle/secret de tâche est refusé.
6. Chat : participant ne peut pas remplacer l'autre participant ni lire une conversation tierce.
7. Stock : deux commandes concurrentes ne peuvent pas dépasser le stock.
8. Paiement : webhook dupliqué ne double pas la commande, le split ou le crédit.
9. Payout : retry et webhook rejoué ne déclenchent pas un double versement.
10. Coins : achat, cadeau, remboursement et retrait laissent un ledger équilibré.
11. Follows : compte privé, blocage et unfollow respectés.
12. Upload : owner only, taille/MIME validés, modération avant publication.

## 5. Limites

Aucun résultat de test métier positif ou négatif ne peut être déclaré ici. L'accès à Supabase de production, aux secrets et aux comptes sandbox n'était pas disponible. Le build/lint a échoué faute d'exécutables locaux, pas à cause d'une erreur TypeScript/ESLint démontrée.

## 6. Critères de sortie future

Le rapport devra inclure commande, commit exact, environnement, nombre de tests passés/échoués/ignorés, logs expurgés, et lien CI. Les secrets, tokens et données personnelles doivent être masqués.
