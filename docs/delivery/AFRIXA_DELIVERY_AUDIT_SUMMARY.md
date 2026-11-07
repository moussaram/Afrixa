# Afrixa Delivery — synthèse de l'audit et décisions

## 1. Résumé exécutif

L'audit statique du snapshot main examiné montre que la livraison Afrixa est actuellement partielle et dispersée.

- Des champs de livraison existent dans products et orders.
- Les coordonnées client peuvent être enregistrées.
- Le parcours de paiement FedaPay existe dans AfrixaPayment.
- Un ancien parcours Yango existe sous forme de lien externe et d'interface prototype.
- Les écrans commandes et ventes consultés utilisent des données mock et des mutations locales.
- Aucun adaptateur OuiGoo ou API Yango B2B n'a été identifié dans les sources recherchées.
- Aucun moteur central de livraison, entité d'expédition, journal d'événements fournisseur ou système d'idempotence logistique n'a été identifié dans les migrations consultées.

Ce constat est statique. Il ne prouve pas l'état du Supabase distant ou des intégrations externes non présentes dans le dépôt.

## 2. Faisabilité OuiGoo

La documentation officielle confirme une API REST HTTPS, JSON, Bearer API key, création de shipments, tarification, suivi, objets Delivery/Driver, productReference et webhooks signés. Le site officiel mentionne le Bénin et l'intégration marchande par API.

**Conclusion : faisabilité favorable sous réserve d'onboarding marchand et de validation de la documentation détaillée.**

Les endpoints précis, champs obligatoires, signatures, statuts, annulations et sandbox doivent encore être confirmés. Ne pas coder sur la seule page d'introduction.

## 3. Faisabilité Yango

Yango Delivery for Business existe dans certains marchés et propose suivi et intégration professionnelle. La page officielle globale consultée liste en Afrique Côte d'Ivoire, Ghana, Sénégal et Zambie, mais pas le Bénin. Le contrat de livraison consulté couvre la Côte d'Ivoire et la zone Abidjan. Le portail Yango Partners Bénin concerne les partenaires de flotte, pas la preuve d'une API de livraison colis pour Afrixa.

**Conclusion : disponibilité Bénin/Cotonou non confirmée. Yango doit rester conditionnel et désactivé jusqu'à réponse officielle et accès partenaire.**

Ne pas utiliser l'API de demande de trajet pour remplacer une API de livraison.

## 4. Livraison par le vendeur

C'est le mode de secours indispensable et le plus indépendant des fournisseurs externes. Il doit reposer sur une configuration vendeur structurée, des zones et tarifs, des adresses de collecte et un workflow vérifiable.

## 5. Architecture recommandée

Créer Afrixa Delivery comme service central :
- Provider Registry ;
- Quote Service ;
- Delivery Orchestrator ;
- adaptateur OuiGoo ;
- adaptateur Yango conditionnel ;
- Seller Delivery ;
- événements et suivi ;
- notifications ;
- administration et réconciliation.

Les commandes, paiements et livraisons doivent conserver des statuts séparés.

## 6. Évolutions majeures à prévoir

1. Clarifier panier multi-vendeur et commandes parent/sous-commandes.
2. Modéliser les points de collecte vendeur.
3. Ajouter les devis et snapshots de frais.
4. Ajouter les entités deliveries et delivery_events.
5. Ajouter les tentatives, webhooks et preuves.
6. Définir RLS et transitions serveur.
7. Intégrer notifications sur événements.
8. Construire les interfaces client, vendeur et admin.

Les tables proposées sont candidates et ne sont pas créées.

## 7. Risques prioritaires

- prix et délai Yango codés en dur ;
- ancien parcours de paiement simulé ;
- frais de livraison non inclus dans le total du parcours AfrixaPayment consulté ;
- commande actuelle mono-produit ;
- adresse de collecte vendeur non structurée dans les parcours audités ;
- UI commandes/vendeur en mock ;
- absence de suivi fournisseur persistant ;
- absence de modèle d'idempotence et de webhooks dans le dépôt examiné.

## 8. Décisions du propriétaire requises

1. Le checkout doit-il permettre panier multi-vendeur dès le premier lancement ?
2. Une commande globale est-elle payée en une transaction ou divisée par vendeur ?
3. Afrixa supporte-t-il un seul colis par vendeur ou plusieurs colis ?
4. Le coût de livraison est-il payé par le client, le vendeur ou subventionné ?
5. Le vendeur peut-il définir un seuil de gratuité ?
6. Une livraison fournisseur est-elle créée uniquement après paiement confirmé ?
7. Quelle preuve est exigée pour marquer « livré » ?
8. Quelle politique en cas de client absent, refus, retour ou colis endommagé ?
9. Quelles villes et quels pays constituent le lancement initial ?
10. Afrixa possède-t-il déjà un compte marchand OuiGoo et un accès API ?
11. Yango doit-il être poursuivi comme partenariat conditionnel malgré l'absence de preuve de couverture Bénin ?

## 9. Ordre de réalisation recommandé

- P0 audit complémentaire et décisions.
- P1 architecture et contrat de données.
- P2 registre providers/configuration.
- P3 Seller Delivery.
- P4 OuiGoo après documentation et sandbox.
- P5 Yango seulement si autorisé et disponible.
- P6 checkout client.
- P7 suivi et notifications.
- P8 administration.
- P9 sécurité et validation staging.
- P10 préparation release.

## 10. État des livrables

Les documents associés sont :
1. AFRIXA_DELIVERY_CURRENT_STATE.md
2. AFRIXA_OUIGOO_INTEGRATION_SPEC.md
3. AFRIXA_YANGO_INTEGRATION_FEASIBILITY.md
4. AFRIXA_SELLER_DELIVERY_SPEC.md
5. AFRIXA_DELIVERY_ENGINE_ARCHITECTURE.md
6. AFRIXA_DELIVERY_DATABASE_PLAN.md
7. AFRIXA_DELIVERY_UI_UX_PLAN.md
8. AFRIXA_DELIVERY_SECURITY_AUDIT.md
9. AFRIXA_DELIVERY_TEST_PLAN.md
10. AFRIXA_DELIVERY_IMPLEMENTATION_ROADMAP.md
11. AFRIXA_DELIVERY_AUDIT_SUMMARY.md

## 11. Limites de l'audit

- Aucun accès Supabase distant n'a été utilisé.
- Aucun test navigateur, paiement ou transporteur n'a été exécuté.
- Aucune clé API n'a été demandée ou manipulée.
- Aucune migration n'a été créée.
- Aucun fichier source n'a été modifié.
- Aucune intégration n'a été développée.
- Les pages détaillées OuiGoo shipments/deliveries/drivers n'ont pas pu être consultées via l'outil de recherche ; leurs détails doivent être confirmés avant P4.

## 12. Décision recommandée

Valider d'abord les spécifications et les décisions de commande multi-vendeur. Démarrer ensuite P0 complémentaire avec vérification du schéma Staging et confirmation contractuelle OuiGoo. Construire Seller Delivery et le moteur central avant de brancher les providers externes.

Ne pas activer Yango au Bénin tant que la disponibilité et l'accès API officiels ne sont pas confirmés.
