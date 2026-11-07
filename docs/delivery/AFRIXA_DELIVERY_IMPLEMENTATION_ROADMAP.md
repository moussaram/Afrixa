# Afrixa Delivery — roadmap d'implémentation P0 à P10

**Statut :** plan futur, aucune phase d'implémentation commencée.

## P0 — Audit du système de livraison existant

Objectif :
- confirmer l'état du dépôt, du schéma distant et des parcours réels ;
- compléter les vérifications de panier, boutique, adresses, notifications et RLS ;
- obtenir les réponses fournisseurs manquantes.

Prérequis :
- accès dépôt et branche validés ;
- accès Supabase staging en lecture ;
- identité staging confirmée ;
- documentation OuiGoo complète ;
- contact Yango B2B.

Fichiers :
- sources existantes identifiées dans AFRIXA_DELIVERY_CURRENT_STATE.md ;
- migrations orders/products/coordinates/payment.

Risques :
- différence entre dépôt et schéma distant ;
- mock UI confondu avec fonctionnement réel.

Tests :
- audit statique, schéma, RLS, parcours staging.

Acceptation :
- inventaire confirmé, écarts classés, décisions prises.

## P1 — Architecture centrale Afrixa Delivery

Objectif : définir contrat provider-agnostic, machine à états et séparation order/payment/fulfillment/delivery.

Prérequis : P0 accepté, décision panier et commandes multi-vendeur.

Fichiers futurs indicatifs :
- src/lib/delivery/
- services backend dédiés
- documentation d'architecture.

Risques : couplage fournisseur, transitions incohérentes.

Tests : tests unitaires des contrats, états et normalisation.

Acceptation : les providers sont remplaçables sans changer le checkout métier.

## P2 — Gestion des paramètres et prestataires

Objectif : registre de providers, activation par pays/zone, capacités et secrets serveur.

Prérequis : P1 et validation de sécurité.

Fichiers futurs indicatifs :
- migrations Supabase dédiées ;
- Edge Functions de gestion ;
- interface admin.

Risques : fuite de secrets, activation d'une zone non couverte.

Tests : permissions admin, secrets, configuration et feature flags.

Acceptation : aucun provider indisponible n'est présenté au client.

## P3 — Livraison organisée par le vendeur

Objectif : configurer points de collecte, zones, tarifs et workflow de remise.

Prérequis : P1/P2, décisions de preuve de livraison et de litige.

Fichiers futurs indicatifs :
- espace boutique ;
- services de devis ;
- Edge Functions ;
- tables de configuration.

Risques : fraude vendeur, mauvais tarif, adresse non desservie.

Tests : devis, RLS, workflow et preuve.

Acceptation : vendeur configure et exécute uniquement ses propres livraisons.

## P4 — Intégration OuiGoo

Objectif : implémenter l'adaptateur officiel.

Prérequis :
- compte marchand Afrixa ;
- clé API sécurisée ;
- documentation complète des endpoints ;
- environnement de test ;
- couverture Cotonou/zones ;
- signature webhook confirmée.

Fichiers futurs :
- adaptateur OuiGoo ;
- Edge Functions ;
- tests de contrat et webhook.

Risques : double création, tarif non confirmé, webhook falsifié.

Tests : quote, create, tracking, cancel si supporté, webhook, retry.

Acceptation : flux de test bout en bout validé sans facturation réelle.

## P5 — Faisabilité puis intégration Yango conditionnelle

Objectif : activer Yango uniquement si l'API officielle B2B est accessible au Bénin et à Cotonou.

Prérequis :
- confirmation écrite ;
- contrat ;
- accès technique ;
- docs ;
- sandbox ;
- tarifs et zones.

Si aucun accès n'est obtenu, la phase se termine par une décision documentée « non activable », sans code d'intégration.

Tests : mêmes tests que OuiGoo, uniquement avec accès officiel.

Acceptation : couverture, prix, création, suivi et annulation vérifiés.

## P6 — Interface client et choix du transporteur

Objectif : afficher les méthodes disponibles et les frais confirmés.

Prérequis : P2/P3 et au moins un provider opérationnel.

Fichiers futurs :
- checkout ;
- cartes de livraison ;
- détail commande.

Risques : afficher un prix obsolète, choisir un provider indisponible.

Tests : UI, calcul total, devis expiré, accessibilité.

Acceptation : prix et mode exacts avant paiement.

## P7 — Suivi, notifications et événements

Objectif : synchroniser les états et notifier client/vendeur.

Prérequis : modèle delivery_events, webhook et stratégie polling.

Fichiers futurs :
- webhook handlers ;
- workers ;
- useNotifications ;
- OrderDetail.

Risques : événements doublons, désordre des statuts.

Tests : idempotence, rejeu, ordre d'événements, notification unique.

Acceptation : timeline fiable et notifications alignées.

## P8 — Administration et gestion des erreurs

Objectif : diagnostiquer fournisseurs, erreurs, événements et litiges.

Prérequis : journalisation, rôles admin et règles de réconciliation.

Fichiers futurs :
- dashboard admin ;
- fonctions de réconciliation ;
- vues d'audit.

Risques : accès admin trop large, secrets visibles.

Tests : RBAC, journaux, actions administratives.

Acceptation : l'équipe peut diagnostiquer sans accéder aux clés.

## P9 — Sécurité, tests et validation staging

Objectif : audit complet de bout en bout.

Prérequis : P1-P8 selon providers activés.

Tests :
- unitaires ;
- intégration sandbox ;
- RLS ;
- sécurité ;
- E2E ;
- charge et résilience ;
- sauvegarde/rollback.

Acceptation : tous les critères critiques PASS, aucune vulnérabilité bloquante.

## P10 — Préparation au déploiement

Objectif : préparer une mise en production contrôlée.

Prérequis :
- validation propriétaire ;
- contrats fournisseurs ;
- couverture réelle ;
- monitoring ;
- support et procédures incident ;
- plan de rollback.

Aucun déploiement n'est inclus dans cette roadmap documentaire.

Acceptation : checklist de release signée, activation progressive par zone, retour arrière prêt.

## Dépendances transversales

- décision du modèle multi-vendeur ;
- politique de paiement et remboursement ;
- gestion d'adresse et géocodage ;
- protection des données personnelles ;
- conditions commerciales transporteurs ;
- disponibilité de l'équipe support ;
- politique de litige et preuve de livraison.
