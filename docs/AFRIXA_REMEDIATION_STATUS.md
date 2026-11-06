# Afrixa — état des corrections

Date de suivi : 6 novembre 2026

Cette note distingue les changements réellement poussés des travaux qui restent à effectuer. Elle ne vaut pas validation de production.

## Base et méthode

- Dépôt : `moussaram/Afrixa`
- Branche de travail : `fix/afrixa-p1-p8-20261106`
- Branche principale laissée intacte.
- Audit statique initial : `docs/AUDIT_INITIAL_AFRIXA.md`
- Les migrations ne sont pas appliquées à un projet Supabase réel depuis cet environnement.
- Les secrets et valeurs d'environnement ne sont ni lus ni publiés.

## Corrections poussées sur cette branche

### P1 — Paiements et commandes : partiel

- Le parcours de paiement du composant `AfrixaPaySheet`, utilisé par l'écran d'achat groupé de démonstration, ne peut plus fabriquer un numéro de commande aléatoire ni afficher une confirmation après un délai.
- Le composant affiche maintenant explicitement que le paiement est indisponible depuis cet écran et qu'aucun débit n'est effectué.
- Le parcours FedaPay existant de `AfrixaPayment` et les Edge Functions existantes n'ont pas été remplacés.
- Reste à traiter : centraliser complètement la création des commandes/transactions côté serveur, vérifier l'idempotence de bout en bout et exécuter les tests avec un compte FedaPay de test.

### P3 — Interactions sociales : partiel

- Likes vidéo, sauvegardes et abonnements utilisent maintenant les tables réelles `video_likes`, `video_saves` et `follows`.
- Les états utilisateur sont relus depuis Supabase à l'ouverture du hook.
- Les écritures utilisent les clés uniques existantes et l'interface revient à l'état précédent en cas d'erreur.
- Une migration ajoute la synchronisation des compteurs `videos.likes_count` et `videos.saves_count` avec les relations réelles.
- Les définitions TypeScript des trois tables ont été ajoutées au fichier de types générés.
- Reste à traiter : tests multi-comptes, tests de concurrence, intégration des états sociaux dans toutes les pages et vérification sur Supabase de test.

## Priorités non clôturées

| Priorité | Statut | Motif |
|---|---|---|
| P0 | Partielle | Audit statique documenté ; installation des dépendances/build/lint non terminés. |
| P1 | Partielle | Le faux succès de l'achat groupé est neutralisé ; parcours serveur et tests financiers à compléter. |
| P2 | Non traitée intégralement | Matrice RLS complète, vérification des Edge Functions et tests d'accès à effectuer. |
| P3 | Partielle | Persistance ajoutée ; tests et intégration/hydratation dans toutes les pages à vérifier. |
| P4 | Non traitée | Les pages et flux contenant des données de démonstration doivent être remplacés page par page. |
| P5 | Non traitée | Stocks, commandes, achats groupés et transactions atomiques à auditer/corriger. |
| P6 | Non traitée | Messagerie, Realtime, notifications et médias à vérifier. |
| P7 | Non traitée | Live, modération et intégrations externes à tester. |
| P8 | Non traitée | Suite de tests, validation complète, documentation et déploiement contrôlé. |

## Vérifications exécutées

- `npm run` : scripts présents recensés.
- `npm ci --ignore-scripts --no-audit --no-fund` : interrompu par expiration du délai ; plusieurs dépendances Firebase déclarent Node.js `>=24.12.0`, alors que l'environnement dispose de Node.js `22.16.0`.
- `tsc -b --pretty false` : échec avant analyse du projet, car les dépendances/types déclarés ne sont pas installés (types React, Node et autres manquants).
- `npm run build` et `npm run lint` : non exécutables correctement tant que l'installation n'est pas complète.
- Aucun test Supabase, FedaPay, RLS, Realtime, Android ou production n'a été prétendu réussi.

## Décision de livraison

Cette branche contient des corrections ciblées et réversibles, mais **elle ne doit pas être fusionnée ni déployée comme une livraison complète Afrixa**. Les priorités P0 à P8 ne sont pas toutes terminées. Les migrations doivent d'abord être relues et appliquées sur un environnement Supabase de test, puis les tests correspondants doivent réussir.
