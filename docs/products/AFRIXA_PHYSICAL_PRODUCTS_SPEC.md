# Spécification — produits physiques Afrixa

## 1. Objectif et état actuel

Étendre le catalogue products existant sans casser les flux sociaux, Group Buy ou FedaPay. L'existant est partiel : MyShop sait insérer un produit simple; catalogue public, upload, édition, commandes UI et inventaire complet ne sont pas démontrés.

## 2. Modèle cible

Réutiliser public.products après audit/backfill, avec un type explicite physical/digital. Pour les produits physiques : vendeur, nom, description, catégorie, prix/devise, statut de publication/modération, galerie média, SKU, localisation d'expédition et métadonnées facultatives de poids/dimensions.
Les variantes concrètes (taille, couleur, modèle, capacité) doivent avoir leur propre SKU, prix éventuel, statut et quantité. Ne pas maintenir un stock produit et un stock variante contradictoires. Stock illimité doit être explicite.

## 3. Formulaire vendeur cible

1. Informations : nom, description, catégorie/sous-catégorie, prix, devise, prix promotionnel avec règle de cohérence.
2. Médias : photos multiples, couverture, ordre, vidéo facultative si coûts/limites validés. Upload contrôlé et aperçu.
3. Inventaire : suivi de stock ou illimité; variantes et combinaisons explicites; SKU unique selon portée définie.
4. Logistique : ville/pays du vendeur, poids/dimensions facultatifs, délai indicatif. Adresse client au checkout physique.
5. Publication : brouillon, validations serveur, revue/modération si requise, publication seulement si champs obligatoires valides.

Les champs existants delivery_delay et delivery_fee doivent être audités avant réutilisation; aucun calcul transporteur ne fait partie de cette mission.

## 4. Cycle de vie

- Créer : vendeur dérivé de la session, jamais confiance au seller_id du navigateur.
- Modifier : formulaire prérempli; conserver les snapshots des commandes passées.
- Désactiver : retirer du catalogue sans effacer l'historique.
- Archiver : bloquer les nouveaux achats, conserver les ventes.
- Supprimer : suppression logique par défaut; suppression physique seulement si aucun historique/obligation ne dépend du produit et après nettoyage média contrôlé.

## 5. Gestion du stock

Source de vérité transactionnelle côté serveur. À la création du checkout, fonction SQL atomique vérifie produit/variante, prix, statut et disponibilité puis réserve la quantité. La réservation a expiration et états reserved/committed/released. Paiement approuvé consomme la réservation une seule fois; échec, annulation ou expiration la libère une seule fois.
Utiliser une mise à jour conditionnelle du stock ou un verrouillage transactionnel garantissant available >= requested. Le verrou FOR SHARE actuel vérifie la disponibilité mais ne la décrémente pas et ne constitue pas une réservation durable.

Cas à traiter : stock nul, quantité excessive, variante supprimée, prix modifié pendant panier, paiement abandonné, annulation après paiement, retour physique après inspection, Group Buy et règles de taux de commission existantes.

## 6. Commande physique

Le modèle orders actuel contient un seul produit. Pour panier multi-produits, prévoir order_items avec snapshots (nom, image, prix, quantité, variante, SKU, vendeur). Décider si une commande regroupe un vendeur ou si une commande parent contient des sous-commandes vendeur.

Parcours cible :
1. Client consulte produit actif.
2. Sélectionne variante et quantité.
3. Ajoute au panier; panier ne réserve pas le stock.
4. Renseigne adresse de livraison.
5. Backend revalide produit, vendeur, prix, variante, quantité, devise et adresse.
6. Transaction DB crée commande/lignes et réservation.
7. Backend crée le checkout FedaPay à partir des valeurs serveur.
8. Webhook signé ou vérification serveur confirme le paiement; le retour navigateur n'est pas une preuve.
9. Stock réservé consommé une fois; commande devient payée.
10. Vendeur voit la commande payée et prépare.
11. Statut préparation/expédition suit une machine d'état autorisée.
12. Client confirme réception ou ouvre litige selon politique.

Aucun transporteur, API de livraison ou frais automatisés n'est inclus.

## 7. Interfaces à adapter

- Marketplace : catalogue réel paginé, filtres, catégories backend, erreurs et états vides.
- Fiche produit : images, variantes, disponibilité, quantité, prix serveur et ajout panier.
- MyShop : formulaire physique, upload, édition, stock, archivage.
- Vendeur : commandes réelles et transitions autorisées serveur.
- Client : panier, commandes et détail réels.
- Admin : modération et catégories avec autorisation backend.

## 8. Critères d'acceptation

- Vendeur A ne peut modifier/consulter les données privées du vendeur B.
- Brouillon/inactif non achetable; actif visible.
- Prix et seller_id sont dérivés serveur.
- SKU et variantes respectent unicité.
- Deux achats simultanés ne peuvent consommer la dernière unité deux fois.
- Échec/expiration libère la réservation de façon idempotente.
- Commandes historiques gardent snapshots exacts.
- Aucun faux succès et aucune action UI non persistée.
