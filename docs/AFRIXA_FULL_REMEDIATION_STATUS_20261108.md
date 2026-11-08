# Afrixa — suivi de remédiation globale

Date : 8 novembre 2026  
Référence fonctionnelle : `Audit_Afrixa_Insuffisances.docx` (audit statique du 4 novembre 2026)  
Branche : `fix/afrixa-full-remediation-20261108`  
Base : `fix/afrixa-audit-remediation-20261108`

## Portée de cette tranche

Cette branche conserve les corrections antérieures de la PR #5 et ajoute une première tranche de remédiation frontend. Elle ne prétend pas clôturer toutes les insuffisances de l'audit.

### Corrections de code effectuées dans cette tranche

- `src/pages/Orders.tsx` : suppression des commandes fictives ; lecture des commandes de l'utilisateur authentifié depuis Supabase, filtre par acheteur, états de chargement/erreur/vide et actualisation.
- `src/pages/OrderDetail.tsx` : suppression de la commande et de la chronologie fictives ; lecture de la commande uniquement pour son acheteur authentifié ; lecture des événements depuis `order_timeline`. Les actions sensibles ne fabriquent plus de changements de statut côté navigateur.
- `src/pages/SellerSales.tsx` : suppression des ventes, chiffres et changements de statut fictifs ; lecture des commandes du vendeur authentifié et calcul des indicateurs à partir des commandes récupérées. Les changements de statut attendent un workflow serveur autorisé.
- `src/pages/MyShop.tsx` : suppression du fallback vers les produits fictifs et des statistiques codées en dur ; produits et indicateurs chargés depuis les tables `products` et `orders` du vendeur authentifié ; suppression de produit filtrée par `seller_id` ; publication locale non authentifiée supprimée.
- `.github/workflows/ci.yml` : ajout d'un workflow GitHub Actions pour installer les dépendances, lancer ESLint et construire l'application sur Node.js 24.12.0.

## Vérifications

- Les modifications ont été écrites sur cette branche GitHub.
- Aucun secret, identifiant fournisseur ou environnement de production n'a été lu ou modifié.
- Aucune migration n'a été appliquée à Supabase.
- Aucun build, lint, test RLS, test FedaPay, test Cloudflare, test Agora ou test navigateur n'a été exécuté dans cet environnement.
- Le workflow CI nouvellement ajouté doit être exécuté par GitHub après push ; son résultat n'est pas présumé.

## Travaux encore ouverts selon le document source

### Backend, paiements et sécurité
- Compléter les opérations serveur atomiques pour commandes, paiement, remboursements, contestations, commissions et versements.
- Mettre en place un ledger financier immuable, l'idempotence bout en bout et les tests de concurrence.
- Valider les migrations et politiques RLS sur un projet Supabase de staging avec des rôles et comptes distincts.
- Compléter la réservation/libération atomique des stocks et l'historique des statuts.
- Compléter la file de notifications, retries, déduplication, suivi de livraison et nettoyage des tokens invalides.
- Compléter les webhooks et tâches de maintenance Cloudflare Stream, quotas, suppression des médias orphelins et reprise des uploads.
- Valider les interruptions, reconnexions, coanimateurs, expulsions, confidentialité et modération des lives Agora.
- Construire le centre de modération, la file de signalements, les sanctions graduelles, les appels et la supervision.
- Compléter le moteur de recherche, les recommandations personnalisées, les tendances, la diversité et l'évaluation de qualité.
- Renforcer indexation, contraintes, nettoyage, sauvegardes/restauration, monitoring, alertes, rate limits et tâches différées.
- Ajouter des tests automatisés métier, d'intégration, RLS, charge et résilience.

### Frontend restant
- Flux vidéo réel et personnalisé avec pagination, suivi de visionnage, reprises et gestion des médias indisponibles.
- Découverte réelle (utilisateurs, vidéos, hashtags, tendances, filtres, historique, pagination).
- Profils, vidéos publiées/aimées/enregistrées, statistiques, abonnements et activités connectés aux vraies données.
- Stories, notifications, studio créateur et onboarding sans données fictives.
- Vérification fonctionnelle complète de l'éditeur vidéo, audio, droits musicaux, brouillons, reprise d'upload et compression.
- Marketplace public, boutiques, produits physiques/numériques, commandes, détails, stocks et livraison intégrés de bout en bout.

## Conditions de clôture

Une insuffisance ne sera déclarée corrigée qu'après :
1. implémentation du parcours complet ;
2. tests automatisés pertinents ;
3. validation des autorisations et de la sécurité ;
4. exécution réussie du build/lint/CI ;
5. tests d'intégration en staging lorsque des services externes sont concernés ;
6. preuves consignées sans secrets.

Les éléments nécessitant des accès ou décisions du propriétaire (identifiants API, comptes sandbox/production, secrets, activation des services, règles commerciales, politique de remboursement, configuration Supabase) resteront marqués bloqués jusqu'à leur fourniture et validation.
