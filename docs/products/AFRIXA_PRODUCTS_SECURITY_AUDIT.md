# Audit sécurité — produits et commandes Afrixa

Audit statique des migrations et sources versionnées. Aucun accès production, test d'intrusion ou test RLS distant.

## 1. Risques prioritaires

| Risque | Preuve | Impact | Priorité |
|---|---|---|---|
| Faux succès paiement | AfrixaPaySheet.tsx sur main : timer puis toast succès | Faux ordre payé | P0 |
| Survente | trigger enforces_order_checkout_integrity vérifie stock FOR SHARE sans décrément | Plusieurs commandes peuvent réclamer les mêmes unités | P0 |
| Commandes UI fictives | Orders.tsx, OrderDetail.tsx, SellerSales.tsx | Statuts et ventes trompeurs | P0 |
| Pas de stockage numérique | aucune bucket/policy/entitlement identifiée | Fuite si futur système s'appuie sur URL publique | P0 |
| Catalogue mock | MarketplaceContent.tsx | Catalogue non représentatif des produits persistés | P1 |
| Upload produit absent | MyShop.tsx bloc photo décoratif | Aucune validation média réelle | P1 |
| Édition absente | bouton crayon sans handler | Gestion vendeur incomplète | P1 |
| Idempotence à vérifier | webhook/verify lisent puis insèrent split | Courses et doublons possibles sans contrainte unique | P1 |

## 2. Protections présentes dans le dépôt

- RLS products : insertion et modifications par propriétaire.
- Trigger commande : buyer authentifié, produit actif, auto-achat refusé, prix/nom/image/commission recalculés, stock vérifié.
- Trigger transaction : updates serveur seulement; transaction liée à commande de l'acheteur; montant/devise/commission recalculés.
- create-fedapay-payment authentifie l'utilisateur, vérifie propriété et état payable, puis crée checkout côté serveur.
- verify-fedapay-payment relit transaction FedaPay et compare identifiant, approved, montant, devise, commande et acheteur.
- fedapay-webhook valide signature HMAC et relit l'objet fournisseur avant transition.
- dispute_integrity restreint l'ouverture et la modification des litiges.

Ces éléments ne prouvent pas que les migrations sont appliquées ni que les secrets/webhooks sont configurés.

## 3. Contrôles futurs obligatoires

### Stock et commande
Réservation atomique, expiration, consommation/libération idempotente, machine d'état serveur, protection des commandes simultanées.

### Fichiers numériques
Bucket privé; pas de listing ni accès public; vérification entitlement à chaque download; URL signée courte durée/proxy; no-store; journalisation; quotas et révocation; validation MIME réel/taille/hash/malware/archives.

### Autorisations
Tests RLS cross-seller; empêcher seller_id/type/status modération de changer par update direct; mouvements stock via fonction serveur; snapshots de commande immuables; prix/stock/type jamais fiables depuis le navigateur.

### Paiement
Unifier le checkout et neutraliser tout faux succès; idempotency key; contraintes uniques paiement et split; machine d'état monotone; rapprochement refund/chargeback; concurrence webhook et verify testée.

### Upload média
Quarantaine, noms aléatoires, quotas, taille, MIME par signature, extension cohérente, modération, nettoyage orphelins.

## 4. Scénarios de tests sécurité

1. Vendeur A tente lire/modifier/supprimer le produit B.
2. Client anonyme ne voit que produits publiés/actifs.
3. Falsification prix, vendeur, commission, stock, quantité, type, devise.
4. Deux achats simultanés de la dernière unité.
5. Paiement pending/failed/cancelled et callback falsifié.
6. Webhook valide répété et simultané à verify.
7. Client A tente télécharger le fichier de B par UUID/path.
8. Entitlement révoqué, URL expirée, quota dépassé.
9. MIME falsifié, extension incohérente, fichier trop volumineux, archive malformée.
10. Refund/chargeback après délivrance.
11. Modification directe de seller_id/type/modération.
12. Recherche de secrets dans bundle client.

## 5. Limites

Aucun test RLS, SQL, concurrence, upload, download, FedaPay ou Storage n'a été exécuté. Les risques ci-dessus sont des constats statiques à confirmer, pas une déclaration de compromission production.
