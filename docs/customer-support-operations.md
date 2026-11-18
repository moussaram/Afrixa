# Exploitation du support Afrixa

## Ce qui est raccordé
- Un ticket peut référencer un litige existant de `public.disputes` via `help_messages.related_dispute_id`.
- La base refuse un lien vers un litige dont le demandeur n'est ni acheteur ni vendeur. Si une commande est aussi référencée, elle doit correspondre au litige.
- Les pièces jointes sont prévues dans un bucket privé `support-attachments`, limité à 10 Mio et aux images JPEG/PNG/WebP et PDF.
- Le chemin de stockage attendu est `support/<user_id>/<ticket_id>/<uuid>.<ext>`.
- La lecture est réservée au propriétaire du ticket et aux administrateurs de la plateforme. Les téléchargements doivent passer par des URL signées de courte durée, jamais par une URL publique.
- Le lien vers un litige ne crée pas de litige, ne modifie pas son statut, ne décide pas d'un remboursement et ne libère/bloque pas les fonds.

## Procédure litige marketplace
1. Vérifier l'identité du demandeur et son rôle sur la commande.
2. Rechercher la commande et le litige existant. Ne jamais créer un second litige pour contourner les règles d'éligibilité.
3. Vérifier la transaction dans `payment_transactions` et les preuves de livraison dans le suivi de commande.
4. Conserver les éléments fournis dans le ticket et relier le ticket au litige existant.
5. Demander les éléments contradictoires au vendeur et à l'acheteur via les parcours déjà autorisés.
6. Faire examiner le dossier par un administrateur habilité. La décision et toute opération de remboursement/escrow doivent utiliser les fonctions financières dédiées et auditées; le support ne doit jamais modifier directement `escrow_released`, les soldes ou les transactions.
7. Notifier les parties et consigner la décision dans le mécanisme de litige existant.

## Priorités de traitement (règles internes proposées)
- Urgente : menace crédible, compte compromis en cours, fraude financière active ou risque immédiat pour un utilisateur. Escalade immédiate vers le responsable sécurité/paiements.
- Élevée : paiement débité sans confirmation, doublon, commande payée bloquée, suspicion crédible d'escroquerie ou risque de perte de preuve.
- Normale : livraison, produit non conforme, remboursement déjà engagé, demandes de compte ou de contenu.
- Faible : question générale, suggestion et demande d'information non bloquante.

Ces priorités organisent la file; elles ne constituent pas un engagement de délai de réponse. Aucun SLA public ne doit être affiché avant validation des effectifs, horaires et astreintes.

## Pièces jointes : règles d'exploitation
- Accepter uniquement JPEG, PNG, WebP et PDF, 10 Mio maximum par fichier.
- Vérifier le type réel du fichier côté serveur lors du futur parcours d'analyse; le MIME déclaré par le navigateur ne suffit pas.
- Ne jamais envoyer de justificatif d'identité, carte bancaire complète, mot de passe, OTP ou PIN dans un ticket ordinaire.
- Les fichiers sont privés. Générer des URL signées temporaires uniquement après contrôle des droits.
- Une analyse antivirus n'est pas incluse dans cette livraison. Avant d'autoriser l'ouverture automatique de fichiers, ajouter un scanner côté serveur, un statut de quarantaine et une procédure de suppression. En attendant, les pièces jointes doivent être examinées manuellement par le personnel autorisé.

## Canaux externes
WhatsApp Business et e-mail transactionnel ne sont pas activés : aucun numéro officiel, domaine d'envoi vérifié, fournisseur, identifiant ni secret serveur n'a été fourni. Ne pas afficher de faux contact ni simuler l'envoi. À l'intégration, utiliser uniquement des secrets côté serveur, des webhooks signés, une politique anti-spam et des journaux sans données sensibles.

## Validation avant activation
- Appliquer les migrations d'abord sur un environnement de staging isolé.
- Tester RLS avec le propriétaire, un autre utilisateur, le vendeur/acheteur du litige et un administrateur.
- Tester upload, lecture, URL signée, refus des MIME non autorisés et dépassement de taille.
- Vérifier que l'accès direct au bucket reste privé.
- Exécuter les tests de build et lint via GitHub Actions.
- Effectuer un test fonctionnel de litige avec transaction sandbox, sans utiliser de vrais remboursements.
- La migration doit être appliquée à la production seulement après validation staging, revue des politiques et sauvegarde vérifiée.
