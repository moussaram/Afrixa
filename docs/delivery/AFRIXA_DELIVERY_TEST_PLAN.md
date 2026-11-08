# Afrixa Delivery — plan de tests

## 1. Principes

Tous les tests d'intégration fournisseur doivent utiliser un environnement de test officiel ou un compte expressément autorisé. Aucun test ne doit créer une livraison facturable réelle sans autorisation.

Les tests unitaires peuvent utiliser des adaptateurs simulés, mais leurs résultats ne prouvent pas la disponibilité d'un fournisseur.

## 2. Tests unitaires

### Tarification
- tarif fixe vendeur ;
- tarif par zone ;
- livraison gratuite sous seuil ;
- devise ;
- devis expiré ;
- montant négatif refusé ;
- total produits + frais correct.

### Normalisation
- mapping des statuts fournisseur ;
- statuts inconnus ;
- champs facultatifs absents ;
- payload malformé ;
- timezone UTC.

### Machine à états
- transitions valides ;
- transitions interdites ;
- événement ancien ;
- doublon ;
- livraison livrée ne revient pas en transit sans correction administrative auditée.

### Idempotence
- double clic checkout ;
- retry après timeout ;
- événements dupliqués ;
- deux workers concurrents.

## 3. Tests d'intégration

Avec OuiGoo sandbox ou environnement de test autorisé :
- authentification ;
- disponibilité zone ;
- calcul du tarif ;
- création shipment ;
- conservation de productReference ;
- lecture delivery/run ;
- suivi ;
- annulation si supportée ;
- webhook signé ;
- webhook invalide ;
- répétition du webhook.

Pour Yango : aucun test tant que l'accès B2B et le périmètre Bénin ne sont pas confirmés.

Pour Seller Delivery :
- sauvegarde configuration ;
- devis par zone ;
- création d'expédition interne ;
- actions vendeur ;
- confirmation client/code OTP.

## 4. Tests de sécurité

- utilisateur A lit sa livraison ;
- utilisateur A tente de lire la livraison de B ;
- vendeur A modifie la livraison du vendeur B ;
- client modifie les frais dans le navigateur ;
- client force un statut delivered ;
- faux webhook ;
- signature invalide ;
- webhook rejoué ;
- URL de preuve consultée par non-participant ;
- accès aux coordonnées GPS ;
- accès admin non autorisé.

## 5. Tests de bout en bout

1. panier physique mono-vendeur, devis, paiement sandbox, livraison.
2. panier multi-vendeur, plusieurs devis, paiement et expéditions.
3. fournisseur indisponible, bascule vers Seller Delivery.
4. livraison vendeur, preuve et confirmation.
5. retard, incident, litige.
6. annulation avant création.
7. échec fournisseur après paiement.
8. retour/remboursement selon règles approuvées.

## 6. Cas limites obligatoires

| Cas | Résultat attendu |
|---|---|
| Mode indisponible | Option non sélectionnable |
| Adresse invalide | Devis refusé |
| Paiement non confirmé | Pas de création selon politique validée |
| API timeout avant réponse | Recherche de référence avant retry |
| Réponse API invalide | État non confirmé, incident enregistré |
| Webhook dupliqué | Une seule transition |
| Webhook ancien | Rejet ou mise en quarantaine |
| Livraison annulée | Statut distinct, frais appliqués selon contrat |
| Vendeur désactivé | Commandes engagées conservées |
| Multi-vendeur | Une fulfillment par vendeur |
| Preuve manquante | Pas de statut final automatique |
| Litige ouvert | Transitions sensibles bloquées |

## 7. Tests de performance et résilience

- latence devis ;
- timeout ;
- débit fournisseur ;
- burst de webhooks ;
- backlog ;
- indisponibilité prolongée ;
- reprise après panne ;
- concurrence sur une même expédition.

## 8. Critères de sortie

- tous les tests critiques PASS ;
- aucune fuite de secrets ;
- aucun accès RLS croisé ;
- aucune double expédition ;
- frais identiques entre devis, commande et paiement ;
- transitions d'état conformes ;
- événements audités ;
- rollback documenté ;
- tests fournisseur réalisés uniquement dans un environnement autorisé.

Les tests ne sont pas exécutés dans le cadre de cet audit documentaire.
