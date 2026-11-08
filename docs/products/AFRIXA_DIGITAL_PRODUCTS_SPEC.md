# Spécification — produits numériques Afrixa

## 1. État actuel

Aucun produit numérique, fichier payant, bucket privé, entitlement, bibliothèque Mes achats numériques ou historique de téléchargement n'a été identifié. Cloudflare Stream dans le dépôt concerne les vidéos sociales et ne doit pas être assimilé à un stockage générique de produits.

## 2. Contenus et formulaire

Formats commerciaux possibles : PDF/e-book, documents, vidéos/cours, logiciels, scripts/code, templates, audio, images et archives.
Formulaire dédié : nom, description, catégorie, prix/devise, couverture publique, fichier principal, aperçu facultatif, version/changelog, statut de publication et déclaration de droits de distribution.
La taille, le MIME réel, l'extension, le hash SHA-256 et l'état d'analyse sont calculés côté serveur. Le navigateur ne fait que déclarer des valeurs indicatives.

## 3. Stockage et upload sécurisé

Séparer :
- couvertures et aperçus explicitement publics;
- fichiers payants dans un bucket privé non listable, sans accès anonyme/direct client.

Flux upload :
1. Vendeur authentifié demande une session pour son propre produit.
2. Backend vérifie propriétaire, rôle, statut, quota, taille et formats.
3. Backend génère un chemin non devinable dans une zone temporaire/quarantaine.
4. Client téléverse sans secret de service.
5. Backend valide taille réelle, signature MIME, extension, hash, malware si service choisi, archives dangereuses et limites de décompression.
6. Fichier validé est promu vers stockage privé et attaché à une version.
7. Upload interrompu/orphelin nettoyé par tâche serveur.

Les plafonds de taille et formats doivent être décidés après vérification des limites du plan Storage, du réseau mobile et des coûts; ne pas inventer de limite arbitraire.

## 4. Modèle de données cible proposé

- digital_product_assets : produit, vendeur, bucket/chemin privé, taille, MIME, hash, analyse, type, version.
- digital_product_versions : version publiée, changelog, statut, asset principal.
- digital_entitlements : client, produit, commande/lignes, version accordée, état, origine et dates.
- digital_download_events : entitlement, client, asset/version, date, résultat et identifiant de requête.
- digital_download_tokens facultatif : token opaque, hashé, expiration et nombre d'utilisations.

Ce sont des propositions à comparer au schéma distant avant migration.

## 5. Délivrance après paiement

1. Webhook signé ou vérification serveur relit la transaction FedaPay.
2. Vérifie identifiant, référence, commande, acheteur, montant, devise et statut approved.
3. Transaction SQL idempotente marque paiement/commande et crée entitlement.
4. Contrainte unique empêche double délivrance.
5. Mes achats numériques liste uniquement les droits actifs.
6. Download endpoint vérifie l'utilisateur, entitlement, remboursement/litige, version et quota.
7. Backend émet URL signée de courte durée ou proxy; jamais URL publique permanente.
8. Événement téléchargement écrit côté serveur.

Un callback navigateur ou un état pending/failed/cancelled ne doit jamais créer un droit d'accès.

## 6. Remboursement, versions et quotas

Décisions commerciales requises : remboursement total/partiel, rétractation selon juridiction et contenu, chargeback, révocation immédiate ou après litige, accès aux mises à jour futures, quota de téléchargement et durée d'accès.
Modèle recommandé : entitlement active/suspended/revoked/expired; l'événement de remboursement applique une politique serveur idempotente. Garder les traces d'achat et téléchargement.

## 7. RLS et sécurité

Vendeur gère les métadonnées de ses propres produits; aucun accès au fichier acheté par autrui. Client lit ses propres entitlements/événements sans pouvoir les créer ou changer leur état. Insert/update d'entitlements et journal downloads réservés au service role. RLS des métadonnées ne remplace pas le contrôle d'accès Storage. Secrets uniquement côté Edge Functions.

## 8. Critères d'acceptation

- Aucun entitlement pour paiement pending/failed/cancelled/non vérifié.
- Acheteur A ne peut télécharger les fichiers de B en changeant UUID/path.
- URL expirée ou révoquée refusée.
- Fichier payant jamais accessible via URL publique permanente.
- MIME, extension, taille et quota validés côté serveur.
- Webhooks rejoués sans double droit.
- Remboursement/chargeback applique la politique décidée et laisse un historique.
- Version achetée identifiable sans altérer les achats précédents.
