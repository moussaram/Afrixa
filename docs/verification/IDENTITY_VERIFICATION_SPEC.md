# Afrixa — Spécification finale de la vérification d’identité (niveau 2)

## Décision commerciale
- Offre unique : **2 000 FCFA (XOF) pour 12 mois**.
- Durée technique : 365 jours à compter de la confirmation serveur du paiement.
- Renouvellement : manuel, sans prélèvement automatique.
- L’offre est indépendante des abonnements Premium, créateur et vendeur.
- Le paiement finance l’instruction du dossier et ne garantit jamais l’approbation.
- Une demande rejetée ne reçoit aucun badge. Un complément demandé par l’équipe peut être transmis pendant la période payée sans second paiement.
- Aucun remboursement n’est déclenché automatiquement en cas de refus. Les remboursements pour double paiement ou incident technique doivent être traités par le support après vérification.
- À l’expiration, le badge est désactivé. L’historique de décision reste conservé.

## Parcours utilisateur
1. L’utilisateur ouvre « Identité vérifiée » depuis son profil.
2. Il lit le tarif, les pièces acceptées, la durée et les conditions.
3. Il lance le paiement FedaPay en XOF.
4. Le serveur relit la transaction chez FedaPay et vérifie l’identifiant, le montant, la devise et le propriétaire avant d’activer l’abonnement.
5. L’utilisateur soumet son nom légal, le pays émetteur, le type de pièce et le fichier justificatif.
6. Le fichier est envoyé dans le bucket privé identity-verification-documents, sous un chemin contenant son identifiant utilisateur.
7. L’équipe Afrixa examine le dossier dans une interface réservée aux agents explicitement habilités.
8. L’équipe peut approuver, refuser ou demander un complément. Chaque action est journalisée.
9. Le badge bleu n’apparaît qu’après approbation et tant que l’abonnement est actif.

## Documents acceptés
- Carte nationale d’identité.
- Passeport.
- Titre de séjour.
Formats acceptés : JPEG, PNG, PDF. Taille maximale : 10 Mo par fichier. Ne pas demander de selfie ni de reconnaissance faciale dans cette version. L’interface doit rappeler à l’utilisateur de ne transmettre que les informations nécessaires et de masquer les informations non pertinentes lorsqu’il peut le faire sans invalider le justificatif.

## Sécurité et confidentialité
- Les justificatifs sont stockés dans un bucket privé.
- Aucun document, numéro de pièce ou nom légal n’est publié sur le profil public.
- Les clients ne peuvent pas insérer, modifier ou approuver directement les enregistrements métier.
- Les écritures passent par les fonctions serveur avec service role.
- Les examinateurs sont une liste blanche gérée côté serveur dans public.identity_verification_reviewers.
- Les agents ne reçoivent que des URL signées à durée courte pour consulter un document.
- Chaque décision et chaque consultation de document sont journalisées.
- Le badge public est contrôlé par le serveur et lié à l’expiration de l’abonnement.
- Les rôles administratifs ne doivent jamais être déterminés à partir de user_metadata modifiable par l’utilisateur.

## États
payment_pending, active, submitted, under_review, needs_information, approved, rejected, expired, revoked.
Le paiement ne change jamais l’état de la demande en approved. Seul un examinateur habilité peut prendre une décision.

## Provisionnement des examinateurs
Après application de la migration sur le projet Supabase confirmé, un administrateur du projet doit ajouter les UUID Auth des agents Afrixa autorisés dans public.identity_verification_reviewers via un canal serveur sécurisé. Ne jamais exposer la clé service role dans le navigateur ni dans le dépôt.

## Déploiement et contrôles obligatoires
La migration de ce dépôt doit d’abord être appliquée à un environnement de staging. Vérifier :
- RLS sur toutes les tables ;
- refus de lecture croisée entre deux utilisateurs ;
- refus de lecture anonyme et d’accès public aux fichiers ;
- téléversement limité au dossier de l’utilisateur ;
- rejet d’un paiement falsifié, d’un mauvais montant, d’une mauvaise devise ou d’une transaction appartenant à un autre compte ;
- idempotence des retours de paiement ;
- impossibilité pour un utilisateur de modifier son statut de vérification ;
- impossibilité pour un agent non provisionné d’accéder à la file ;
- expiration et révocation du badge ;
- build, lint et tests de non-régression.

## Périmètre exclu
La vérification entreprise/boutique (niveau 3) n’est pas comprise dans cette livraison. Elle aura ses propres justificatifs commerciaux, son propre tarif et son propre processus d’examen.