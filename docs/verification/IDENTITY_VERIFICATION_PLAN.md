# Afrixa — Plan d’implémentation de la vérification d’identité (niveau 2)

## Décision produit confirmée

La vérification d’identité est un service **payant avec son propre abonnement**, indépendant des abonnements Afrixa ordinaires (Premium, créateur, vendeur, etc.).

- La demande est volontaire et initiée par le titulaire du compte.
- L’utilisateur doit disposer d’un abonnement de vérification d’identité actif pour déposer/soumettre son dossier.
- Le paiement donne accès à l’examen, **pas à une approbation automatique**.
- L’équipe Afrixa examine les justificatifs et décide d’approuver ou de refuser.
- Le badge bleu n’est affiché qu’après une décision d’approbation valide.
- Le nombre d’abonnés, la popularité, le téléphone confirmé ou l’e-mail confirmé ne donnent jamais le badge bleu.
- La vérification professionnelle (entreprise/boutique, niveau 3) sera conçue séparément et ne doit pas être mélangée à cette première livraison.

## Constat technique préalable

Dans `src/pages/UserProfile.tsx`, une coche bleue est actuellement affichée à partir de 50 000 abonnés. Cette logique confond popularité et authenticité et devra être supprimée au profit d’un statut de vérification d’identité issu d’une source serveur fiable.

Le projet dispose déjà :
- d’une authentification Supabase ;
- d’un profil public et d’un profil personnel ;
- d’un contrôle d’accès administrateur via `is_platform_admin()` utilisé par la modération ;
- d’une intégration de paiement FedaPay, notamment un retour client et une fonction webhook configurée.

Ces éléments doivent être réutilisés après audit des fonctions serveur et des politiques existantes, sans supposer que le retour navigateur constitue une preuve de paiement.

## Parcours utilisateur cible

1. Depuis son profil ou Paramètres, l’utilisateur ouvre « Vérification du profil » puis « Identité vérifiée ».
2. Il consulte les avantages, les critères, le tarif et les conditions de l’abonnement dédié.
3. Il choisit une durée disponible (mensuelle/annuelle uniquement si ces offres sont effectivement configurées) et paie via le parcours de paiement Afrixa.
4. Le serveur confirme le paiement auprès de FedaPay ou via un webhook authentifié et idempotent.
5. Après confirmation, l’utilisateur peut remplir sa demande et téléverser les justificatifs acceptés.
6. La demande est soumise à l’équipe Afrixa et passe dans la file d’examen.
7. Un examinateur autorisé consulte les documents dans un espace privé, vérifie la concordance avec le compte et consigne sa décision.
8. En cas d’approbation, le serveur active le statut vérifié et le badge bleu apparaît sur le profil.
9. En cas de refus, aucun badge n’est accordé ; l’utilisateur reçoit un motif non sensible et les règles de nouvelle soumission.
10. À l’expiration ou à la résiliation de l’abonnement, le droit d’afficher le badge est recalculé selon la politique commerciale validée. Le statut historique de la décision est conservé pour audit.

## États métier à implémenter

- `not_subscribed` : aucun abonnement de vérification actif.
- `payment_pending` : paiement en cours de confirmation.
- `eligible_to_apply` : paiement confirmé, demande non encore soumise.
- `submitted` : dossier envoyé.
- `under_review` : dossier pris en charge par l’équipe.
- `approved` : identité approuvée.
- `rejected` : demande refusée avec motif.
- `needs_information` : complément requis, sans nouvelle facturation pendant la période d’abonnement.
- `expired` : abonnement expiré et badge désactivé selon la politique retenue.
- `revoked` : vérification retirée à la suite d’une fraude, d’une usurpation ou d’une décision de conformité.

Les transitions doivent être contrôlées côté serveur. Le client ne peut ni changer l’état, ni s’attribuer un badge, ni déclarer un paiement confirmé.

## Données et sécurité

### Tables proposées (noms à confirmer après inspection du schéma réel)

- `identity_verification_plans` : offres, durée, prix XOF, activation commerciale. Prix configurables ; aucun montant ne doit être inventé ou codé en dur avant validation.
- `identity_verification_subscriptions` : utilisateur, offre, statut, période, référence de paiement FedaPay, dates et annulation.
- `identity_verification_requests` : utilisateur, statut, identité déclarée minimale, type de pièce, pays émetteur, dates, décision et motif.
- `identity_verification_documents` : métadonnées et chemins Storage privés, jamais les fichiers eux-mêmes dans une colonne publique.
- `identity_verification_reviews` : examinateur, décision, motif, notes internes, horodatage et historique immuable.

### Règles de sécurité obligatoires

- Documents stockés dans un bucket Supabase **privé**, sans URL publique permanente.
- Téléversement et lecture strictement limités au propriétaire pour ses propres documents et aux examinateurs habilités.
- Accès administratif validé côté serveur par rôle/permission, jamais par un simple booléen fourni par le navigateur ou par `user_metadata`.
- RLS activée sur toutes les tables exposées ; politiques d’ownership explicites.
- Les décisions et changements de statut passent par des fonctions serveur contrôlées.
- Ne jamais exposer de numéro complet de pièce, de date de naissance ou de justificatif dans le profil public, les logs ou les notifications.
- URL signées à durée courte pour l’examen des documents ; journaliser les consultations administratives.
- Limiter les formats, tailles, nombres de fichiers et vérifier le type réel du fichier.
- Prévoir une politique de conservation/suppression des justificatifs après la durée légalement et opérationnellement nécessaire.
- Ne pas imposer de selfie ou de reconnaissance faciale avant validation explicite de la politique de collecte et de protection des données.
- Paiements vérifiés côté serveur, montants/devise/référence/utilisateur contrôlés, webhook idempotent ; aucun badge ni accès accordé sur la seule page de retour FedaPay.

## Espace équipe Afrixa

Créer une file distincte de la modération de contenu, réservée aux agents autorisés :
- liste filtrable des demandes soumises, en examen, en attente de complément, approuvées et refusées ;
- fiche de demande avec documents servis via URL signée courte ;
- comparaison des informations déclarées et des justificatifs ;
- actions « Prendre en charge », « Demander un complément », « Approuver », « Refuser », « Révoquer » ;
- motif obligatoire pour refus/révocation ;
- journal des décisions et de l’agent ;
- aucune action directe depuis le navigateur sur le champ de badge.

## Affichage dans Afrixa

- Profil public : badge bleu uniquement si `identity_verified = true` dérivé d’un statut approuvé et d’un abonnement donnant encore droit au badge.
- Infobulle/texte explicatif : « Identité vérifiée par l’équipe Afrixa ».
- Profil personnel : état de l’abonnement, état de la demande, date d’expiration, actions disponibles.
- Paramètres : entrée « Vérification du profil ».
- Les badges de niveau créateur/Spotlight restent des distinctions de popularité et ne doivent jamais ressembler au badge d’identité vérifiée.

## Phasage de réalisation

### Phase 0 — Audit (avant migration)
- Cartographier le schéma réel de `profiles`, les rôles administrateurs, les migrations, Storage et les fonctions FedaPay.
- Repérer toutes les occurrences du badge bleu et des règles de popularité.
- Vérifier les politiques RLS existantes et les conventions de migration du dépôt.
- Définir les types de justificatifs autorisés, la tarification et la règle exacte de renouvellement/expiration.

### Phase 1 — Fondations sécurisées
- Migration SQL versionnée pour offres, abonnements, demandes, documents, avis et journal d’audit.
- Bucket privé et politiques Storage.
- Fonctions serveur de création de demande, contrôle d’éligibilité, transitions et décision.
- Intégration du paiement dédié, sans toucher aux abonnements ordinaires.

### Phase 2 — Parcours utilisateur
- Page « Identité vérifiée », offres, paiement, formulaire, téléversement, suivi et notifications.
- Gestion des erreurs, reprise d’upload et prévention des demandes dupliquées.

### Phase 3 — Espace examinateur
- File de traitement sécurisée et décisions auditées.
- Permissions strictes et journal des accès aux pièces.

### Phase 4 — Badge et non-régression
- Remplacer la coche basée sur les abonnés par le statut serveur approuvé.
- Vérifier les profils publics, recherche, commentaires, vidéos et autres surfaces affichant un badge.
- Tests multi-comptes, RLS, accès Storage, paiement falsifié, webhook rejoué, expiration, refus, révocation et renouvellement.

## Points commerciaux à valider avant activation des paiements

Le montant de l’abonnement, ses durées (mensuel/annuel), le renouvellement automatique ou manuel, le remboursement en cas de refus, la politique de nouvelle soumission et la règle du badge après expiration ne sont pas encore fixés dans les décisions produit disponibles. Ils doivent rester configurables et non activés en production jusqu’à validation.

## Critères d’acceptation

- Un utilisateur non abonné ne peut pas soumettre une demande.
- Un paiement non confirmé par le serveur ne débloque rien.
- Un paiement confirmé n’attribue jamais automatiquement le badge.
- Un utilisateur ne peut lire que ses propres documents.
- Un utilisateur non habilité ne peut accéder ni aux documents ni aux décisions administratives.
- Un utilisateur ne peut modifier aucun champ de vérification via le client.
- Seule une approbation serveur valide peut activer le badge bleu.
- La popularité et le nombre d’abonnés n’influencent jamais l’identité vérifiée.
- L’expiration, la révocation et les événements de paiement sont correctement reflétés.
- La vérification entreprise/boutique reste une fonctionnalité distincte, à développer dans une phase ultérieure.
