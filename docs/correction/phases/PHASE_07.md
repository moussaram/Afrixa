# PHASE 07 — MARKETPLACE, BOUTIQUES ET COMMANDES

**Priorité :** élevée.  
**Prérequis :** phases 01 à 06.

## Objectif
Remplacer les catalogues fictifs et rendre catalogue, boutique, stock, achat, livraison, suivi, avis et litiges cohérents.

## Chantiers
- brancher marketplace et recherche produits sur `products` ;
- compléter CRUD produit, images, catégories, disponibilité et vendeur ;
- formaliser groupe d'achat : membres, seuils, date limite, prix, annulation et remboursement ; vérifier d'abord le schéma existant ;
- garantir réservation/décrément stock atomique ;
- relier checkout à une commande unique ;
- raccorder Orders/OrderDetail à la DB ;
- implémenter transitions autorisées, timeline, avis éligibles et litiges ;
- décider l'intégration livraison : Yango deep link ou API partenaire, statuts et preuve de livraison.

## Tests
produit inactif, stock insuffisant, commandes concurrentes, vendeur achetant son produit, prix modifié client, livraison, confirmation acheteur, litige, avis dupliqué.

## Critères de sortie
Catalogue réel, commande persistée, stock cohérent, statut serveur et parcours d'achat testés sans mocks de production.
