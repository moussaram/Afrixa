# Afrixa Delivery — audit et exigences de sécurité

## 1. Menaces principales

- vol ou fuite de clés API transporteur ;
- création répétée d'expéditions facturables ;
- faux statut « livré » envoyé par le navigateur ou un vendeur ;
- faux webhook ou rejeu d'un événement ancien ;
- modification frauduleuse des frais ;
- accès croisé aux adresses et livraisons d'autres clients ;
- vendeur consultant les commandes d'un autre vendeur ;
- fuite de coordonnées GPS et numéros de téléphone ;
- faux lien de suivi ou URL malveillante ;
- déni de service via répétition de requêtes ;
- incohérence de paiement et livraison ;
- journalisation excessive de données personnelles.

## 2. Secrets et authentification

- Toutes les clés OuiGoo/Yango résident dans le gestionnaire de secrets serveur.
- Aucune clé dans le bundle frontend, les variables VITE_*, le dépôt ou les logs.
- Séparer clés test et production.
- Rotation et révocation documentées.
- Permissions minimales par clé.
- Accès admin aux secrets indirect : statut de configuration seulement.

## 3. Autorisation

- Le client lit uniquement ses commandes et expéditions.
- Le vendeur agit uniquement sur les fulfillments qui lui appartiennent.
- Les transitions fournisseur sont écrites par un backend de confiance.
- Les webhooks ne sont jamais traités comme une session utilisateur.
- Les actions admin sont réservées à un rôle serveur explicite et audité.
- Les contrôles sont répétés côté backend même si l'interface masque les boutons.

## 4. Validation des devis et montants

- Le backend récupère ou calcule les tarifs.
- Le client ne peut pas imposer shipping_fee.
- Le devis possède un identifiant, une expiration et un snapshot d'entrée.
- Le total est calculé côté serveur.
- Le montant payé est comparé au montant de la commande et du devis.
- Les changements de prix nécessitent une nouvelle confirmation client.
- Les valeurs monétaires utilisent des entiers en unité mineure et une devise explicite.

## 5. Idempotence

Chaque opération de création doit avoir une clé idempotente interne stable.

- Unicité provider + clé.
- Même commande et même tentative logique ne doivent pas créer deux colis.
- En cas de timeout ambigu, consulter le provider par référence avant de réessayer.
- Conserver les tentatives et réponses sans secrets.
- Verrouiller les transitions concurrentes.

## 6. Webhooks

- Vérifier signature sur corps brut avant parsing si le protocole l'exige.
- Vérifier timestamp et fenêtre anti-rejeu si fournis.
- Comparer les signatures en temps constant.
- Vérifier identifiant et origine de l'événement.
- Dédupliquer par event ID.
- Refuser les événements invalides.
- Répondre rapidement et traiter de façon fiable.
- Ne pas faire confiance à une URL, un statut ou un montant fournis sans validation.
- Prévoir un polling de réconciliation si webhook absent.

La méthode exacte de signature OuiGoo doit être récupérée dans la documentation détaillée. Pour Yango, elle dépend du contrat et de la documentation remis au partenaire. Ne pas inventer un algorithme.

## 7. Protection des données

- Transmettre uniquement nom/contact/adresse/instructions nécessaires.
- Limiter l'accès aux coordonnées GPS.
- Éviter les adresses complètes dans les logs.
- Masquer les téléphones.
- Définir durée de rétention et suppression.
- Documenter les rôles de responsable/sous-traitant et les conditions du fournisseur.
- Obtenir les accords nécessaires pour transférer les données aux prestataires.
- Stocker les preuves dans un bucket privé avec accès temporaire.

## 8. États et preuves

- Le frontend ne peut pas écrire directement un statut final.
- Le vendeur peut déclarer une remise, mais cette déclaration doit être distinguée d'une confirmation vérifiée.
- La livraison finale exige un événement fournisseur fiable ou une preuve approuvée.
- Les litiges suspendent les actions incompatibles.
- Les changements d'état sont historisés et non effaçables par les participants.

## 9. Disponibilité et résilience

- timeout par appel ;
- retry exponentiel avec jitter sur erreurs temporaires ;
- pas de retry automatique sur erreur métier ;
- circuit breaker par provider ;
- file de reprise ;
- alertes sur backlog ;
- réconciliation périodique ;
- limites de débit par utilisateur et fournisseur.

## 10. Contrôles avant mise en production

- audit RLS ;
- tests d'accès croisés ;
- tests de falsification des frais ;
- tests de rejeu webhook ;
- tests d'idempotence concurrente ;
- tests de timeout ambigu ;
- scan de secrets ;
- tests de rétention et suppression ;
- revue des permissions admin ;
- validation juridique des données transmises.

## 11. Risques bloquants

Ne pas activer un fournisseur si :
- la clé n'est pas sécurisée ;
- l'authenticité des webhooks ne peut pas être vérifiée et aucun polling fiable n'existe ;
- l'idempotence de création n'est pas assurée ;
- les tarifs ne sont pas confirmés ;
- la couverture géographique n'est pas confirmée ;
- la protection des données personnelles n'est pas validée.
