# PHASE 08 — PAIEMENTS, ESCROW, WALLETS ET COINS

**Priorité :** critique financière.  
**Prérequis :** phases 01, 02 et 07.

## Objectif
Construire une comptabilité interne vérifiable pour commandes, commissions, versements, Coins, gifts, tips et remboursements.

## Chantiers
- choisir un ledger canonique et définir devise, signe, états, écritures immuables ;
- supprimer les écritures directes client des soldes ;
- rendre checkout, transaction, commission et ordre atomiques ;
- utiliser idempotency keys et contraintes uniques provider/order/event ;
- valider signatures webhook et relire l'objet provider ;
- gérer les callbacks en double, retards, annulations et rapprochements ;
- activer les payouts uniquement après habilitation FedaPay et tests sandbox ;
- définir escrow, release, échec payout, retry et réconciliation manuelle ;
- brancher achats coins, cadeaux et tips avec débit/crédit transactionnels ;
- définir refunds, chargebacks, litiges et audit trail.

## Tests
montant/devise incorrects, webhook forgé, webhook dupliqué, callback hors ordre, retry, deux retraits concurrents, solde négatif, double achat, double cadeau, remboursement partiel.

## Critères de sortie
Aucun solde n'est modifiable par le client ; chaque FCFA/coin est traçable ; sandbox et rapprochement passent.
