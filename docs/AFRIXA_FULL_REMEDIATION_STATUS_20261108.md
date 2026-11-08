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

### Nouvelle tranche : flux social et intégrité financière

- `src/pages/Index.tsx` : le fil « Pour toi » et « Abonnements » lit désormais les vidéos publiées dans Supabase, charge les profils auteurs, gère les états d'erreur/vide et propose une pagination par lots de 20. Les données de démonstration ne sont plus utilisées dans le fil principal.
- `src/components/video/VideoCard.tsx` : les contrôles d'abonnement comparent maintenant l'auteur à l'utilisateur réellement authentifié, et non au compte fictif de démonstration.
- `src/pages/Discover.tsx` : les comptes, vidéos et tendances sont maintenant issus des données publiées dans Supabase ; les défis non alimentés par un vrai backend ne présentent plus de faux prix ni de faux nombres de participants.
- Le typage Supabase versionné ne contient pas encore la table `videos` malgré ses migrations : le code isole temporairement ce décalage par un cast local explicite. La génération complète des types depuis le schéma réel reste à effectuer et à vérifier.
- `supabase/migrations/20261108120000_secure_checkout_financial_ledger.sql` : ajoute une validation serveur des commandes (propriétaire, produit actif, vendeur, prix, commission, stock réservé dans la même transaction), bloque les modifications directes des statuts et montants, supprime des politiques d'écriture client sur les commissions/événements de commande/paiements, protège les soldes Afrixa Coins et crée un journal financier immuable et idempotent.

Cette migration est préparée dans le dépôt mais **n'a pas été appliquée** à Supabase. Les fonctions Edge de confirmation de paiement, remboursement, libération de stock et versement doivent être raccordées à ces règles avant activation en staging.

### Tranches supplémentaires : commerce, livraison, modération et profils

- `src/pages/MyShop.tsx` : formulaire vendeur connecté aux vrais produits, sélection physique/numérique, téléversement d'image, téléversement privé du fichier numérique, édition, archivage et configuration du point de retrait, de la zone et du tarif de livraison vendeur.
- `src/components/payment/AfrixaPayment.tsx` : le checkout physique demande un devis de livraison serveur valide avant paiement ; le checkout numérique ne demande pas d'adresse physique. Les frais de livraison sont intégrés au montant serveur de la commande.
- `supabase/migrations/20261108140000_products_digital_assets_and_entitlements.sql` : types de produits, variantes et stock, fichiers numériques privés, droits d'accès et journal des téléchargements.
- `supabase/migrations/20261108150000_afrixa_delivery_engine.sql` : points de retrait, zones et tarifs vendeurs, devis expirables, snapshots de livraison, événements et transitions atomiques côté serveur.
- `supabase/migrations/20261108160000_atomic_order_payment_intents.sql` : création automatique de l'intention FedaPay dans la même transaction SQL que la commande ; le navigateur ne crée plus une seconde ligne de paiement.
- `supabase/functions/create-digital-upload`, `complete-digital-upload` et `download-digital-product` : téléversement signé, vérification de type et empreinte, droits d'accès après paiement et URL privée de téléchargement à durée courte.
- `src/pages/DigitalLibrary.tsx` : bibliothèque réelle des achats numériques.
- `supabase/functions/seller-delivery-transition` et `confirm-order-delivery` : progression de livraison vendeur et confirmation par l'acheteur ; `release-escrow` exige désormais cette confirmation avant le versement.
- `supabase/migrations/20261108170000_secure_marketplace_moderation.sql` et `moderate-marketplace-content` : publication des produits et vidéos verrouillée derrière une décision d'administration journalisée.
- `supabase/migrations/20261108180000_stories_moderation_and_views.sql` : stories temporaires soumises à validation et comptage des vues côté base.
- `src/pages/AdminModeration.tsx` : file de modération des produits, vidéos et stories.
- `src/components/stories/StoriesRail.tsx` : stories réelles et création de stories texte, avec affichage public seulement après approbation.
- `src/pages/Profile.tsx` et `src/pages/UserProfile.tsx` : profils, abonnements, vidéos et statistiques chargés depuis Supabase.
- `src/components/profile-menu/ActivityCenter.tsx` et `supabase/migrations/20261108190000_social_activity_notifications.sql` : activités, commentaires, mentions J'aime et notifications générées par les interactions réelles.
- `src/integrations/supabase/types.ts` : ajout des définitions manquantes utilisées par les nouveaux parcours et suppression de plusieurs casts `any` sur les tokens FCM.

### Limites d'intégration externe qui restent explicites

- **OuiGoo** : les chemins d'API de création de course, tarification, suivi, annulation et les schémas de payload n'ont pas été suffisamment vérifiés pour envoyer des commandes réelles. Aucun endpoint n'a été inventé.
- **Yango** : l'accès à une API partenaire de livraison utilisable au Bénin n'a pas été confirmé. Le fournisseur reste désactivé ; une clé seule ne suffit pas si le service et le contrat ne couvrent pas le territoire.
- **Analyse antivirus** : les fichiers numériques sont vérifiés structurellement et leur empreinte est calculée, mais aucun moteur antivirus n'est configuré. Les fichiers portent explicitement `scan_status = not_configured` ; il ne faut pas présenter cela comme une analyse antivirus réussie.
- **Variantes** : les tables et contraintes de variantes existent, mais le sélecteur de variantes et la réservation du stock par variante ne sont pas encore raccordés au parcours de paiement.
- **Suivi de visionnage** : l'historique individuel de visionnage reste non implémenté ; l'interface l'indique au lieu d'afficher de fausses données.

## Vérifications

- Les changements sont poussés sur la branche GitHub de la PR #6.
- Un passage CI antérieur a confirmé lint et build sur un commit précédent ; les derniers ajouts doivent encore être validés par le run déclenché sur le dernier commit de la branche.
- Les migrations SQL sont des fichiers versionnés uniquement : **aucune n'a été appliquée à Supabase** et aucune base de staging n'a été interrogée.
- Aucun test RLS, concurrence de stock, test d'intégration FedaPay, test de webhook, test Cloudflare, test Agora ou test navigateur n'est déclaré exécuté.
- Aucun secret, jeton ou identifiant de production n'a été lu, demandé ou écrit dans le dépôt.
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


## Mise à jour finale de la tranche commerce et livraison

- Les commandes physiques calculent maintenant leurs montants et réservent le stock dans la transaction SQL ; les échecs de paiement qui annulent une commande libèrent la réservation et inscrivent un mouvement d'inventaire.
- La création d'une commande crée une intention de paiement FedaPay en base ; le navigateur demande ensuite la session de paiement hébergée à l'Edge Function existante.
- Les événements de commande sont inscrits dans `order_timeline` pour le suivi acheteur, y compris la création, les étapes vendeur, la livraison signalée et la confirmation de réception.
- Les commandes numériques obtiennent leur droit d'accès uniquement après confirmation du paiement par FedaPay. Les liens de téléchargement restent privés, temporaires et soumis à une vérification d'entitlement.
- **Sécurité des fichiers numériques :** le téléversement signé et la vérification de type/empreinte sont implémentés, mais les fichiers restent en quarantaine (`scan_status = pending`) jusqu'à l'intégration d'un moteur d'analyse antivirus privé. Le checkout et le téléchargement exigent un résultat `clean`. Aucun fichier n'est rendu téléchargeable sans cette validation.
- Les migrations SQL restent préparées dans GitHub ; elles ne sont pas exécutées sur le projet Supabase distant. Le workflow CI doit être confirmé sur le dernier SHA après le dernier commit.

## Vérification des intégrations de livraison externes

- OuiGoo confirme publiquement une API REST et un compte Business requis. Le connecteur WordPress officiel identifie l'hôte API `api.business.ouigoo.co`, mais les schémas d'authentification, de devis, de création d'expédition, d'annulation et de webhooks nécessaires à une intégration Afrixa directe n'ont pas été établis à partir d'une documentation API complète. Le fournisseur reste désactivé ; aucune route n'est devinée.
- Yango dispose d'un portail partenaire au Bénin, mais cela ne confirme pas à lui seul un accès à une API de livraison B2B pour Afrixa. Le contrat de livraison public retrouvé concerne la Côte d'Ivoire et précise une zone de service centrée sur Abidjan. Le fournisseur reste désactivé tant que Yango ne confirme pas par écrit la couverture, le contrat et l'accès API pour le Bénin.
- Les fournisseurs OuiGoo et Yango sont donc enregistrés dans le système, mais ne peuvent pas recevoir de vraies commandes avant validation contractuelle et technique. Une clé API seule ne remplace pas la documentation des endpoints ni la confirmation de couverture.

## Limites qui nécessitent encore une intervention du propriétaire

1. Fournir/activer les accès API officiels et sandbox nécessaires (FedaPay, OuiGoo, Yango si contrat Bénin, antivirus privé, Cloudflare, Agora, Firebase/FCM et Google Maps/Vision selon les fonctions activées).
2. Appliquer les migrations dans un projet Supabase de staging après sauvegarde vérifiée, puis tester RLS avec comptes acheteur/vendeur/admin.
3. Configurer les secrets Edge Functions depuis les consoles officielles ; aucun secret ne doit être placé dans le dépôt ou dans une variable `VITE_*`.
4. Exécuter les scénarios de paiement réel en sandbox, de webhook signé, d'échec/annulation, de livraison, de remboursement et de versement ; conserver les preuves de test.
5. Effectuer une sauvegarde/restauration testée, les contrôles de charge/résilience et la validation mobile/navigateur avant mise en production.

Ces points sont des dépendances d'accès, d'exploitation et de validation. Ils ne sont pas déclarés terminés par la seule présence du code dans la branche.
