# Afrixa — Vérification entreprise / boutique (niveau 3)

## Offre
- Tarif proposé : **5 000 FCFA (XOF) pour 365 jours**.
- Renouvellement manuel ; pas de prélèvement automatique.
- Les frais couvrent l'instruction du dossier et ne garantissent pas l'approbation.
- L'offre est distincte de la vérification d'identité niveau 2 (2 000 FCFA / 365 jours).
- Un complément demandé par l'équipe peut être transmis sans second paiement pendant la période active.

## Dossiers
- Entreprise : nom légal, nom public, pays, RCCM/registre ou équivalent, IFU/identifiant fiscal si applicable, adresse, téléphone, site facultatif, preuve d'enregistrement et preuve de représentation/autorisation.
- Boutique : nom légal ou identité du propriétaire, nom public de boutique, pays, adresse, téléphone, lien de boutique facultatif, preuve d'activité/immatriculation si disponible et preuve de contrôle de la boutique.
- 1 à 4 justificatifs, JPEG/PNG/PDF, 10 Mo maximum chacun. Ne pas demander de selfie ni de biométrie.
- Consentement explicite ; pièces privées ; suppression cible 90 jours après décision finale.

## Décision
- Badge entreprise/boutique uniquement après validation humaine par un examinateur autorisé et tant que l'abonnement est actif.
- États : payment_pending, active, submitted, under_review, needs_information, approved, rejected, expired, revoked.
- Le paiement ne déclenche jamais l'approbation.
- Révocation réservée au superviseur.
- Le statut identité (niveau 2) reste indépendant.

## Sécurité / déploiement
- Bucket privé, RLS, service role uniquement pour écritures métier, URL signées 120 secondes, journalisation des consultations/décisions.
- Provisionner explicitement les UUID Auth des examinateurs dans business_verification_reviewers.
- Migration et Edge Function à valider sur staging ; ne pas appliquer en production sans contrôle du schéma réel.
- Job de purge à planifier avant ouverture publique ; jusque-là purge manuelle.
- Les justificatifs et numéros d'enregistrement ne sont jamais exposés sur le profil public.
