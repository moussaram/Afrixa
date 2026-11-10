# Afrixa — définition de terminé (Definition of Done)

Une tâche n'est pas terminée simplement parce que le code compile ou que l'interface semble correcte.

## Critères communs

- [ ] Le comportement attendu et les cas limites sont documentés.
- [ ] La correction est réalisée dans la bonne couche (client, serveur, base, fournisseur).
- [ ] Les contrôles d'identité, de propriété, de rôle et de confidentialité sont appliqués côté serveur.
- [ ] Les états de chargement, erreur, vide, succès et absence d'accès sont traités.
- [ ] Aucun mock ou chiffre fictif n'est utilisé dans un parcours présenté comme réel.
- [ ] Les types, migrations, documentation et configurations sont synchronisés.
- [ ] Les tests pertinents couvrent succès, échec, doublon, accès interdit et interruption lorsque cela s'applique.
- [ ] Les logs ne contiennent ni secrets ni données personnelles inutiles.
- [ ] Le diff est relu et ne contient pas de changements sans rapport.
- [ ] Le statut communiqué correspond exactement aux preuves disponibles.

## Critères supplémentaires : données et sécurité

- [ ] RLS activé et testé avec au moins deux utilisateurs non privilégiés et les rôles nécessaires.
- [ ] Les lectures directes et indirectes respectent la visibilité, les blocages et les suppressions.
- [ ] Les mutations sont autorisées côté serveur et protégées contre les doublons.
- [ ] Les migrations sont reproductibles et disposent d'une stratégie de sauvegarde/retour.
- [ ] Les médias et documents privés ne sont pas accessibles par URL permanente publique.

## Critères supplémentaires : argent et commandes

- [ ] Prix, frais, commissions, taxes éventuelles et total sont recalculés côté serveur.
- [ ] Stock, commande et intention de paiement sont cohérents et atomiques.
- [ ] Le paiement n'est confirmé qu'après preuve serveur fiable.
- [ ] Les webhooks sont authentifiés, idempotents et rejouables sans double effet.
- [ ] Les remboursements, annulations, litiges et mouvements de fonds ont des transitions contrôlées.
- [ ] Chaque mouvement financier possède une référence traçable et une écriture d'audit.
- [ ] Aucun solde n'est modifiable directement depuis le navigateur.

## Critères supplémentaires : services externes

- [ ] Le fournisseur, le territoire, le contrat, la documentation et les endpoints sont confirmés.
- [ ] Les secrets sont configurés hors du dépôt.
- [ ] Les scénarios de succès, échec, timeout, retry et webhook sont testés en sandbox.
- [ ] La fonctionnalité reste désactivée si une dépendance essentielle n'est pas configurée.
- [ ] Les limites du fournisseur sont clairement documentées.

## Niveaux de validation

| Niveau | Preuve requise |
|---|---|
| Implémenté | Code et documentation présents dans la branche |
| CI validée | Résultats réussis du workflow sur le SHA exact |
| Staging validé | Tests réels sur staging, comptes/rôles distincts et résultats consignés |
| Production validée | Déploiement autorisé et vérification après déploiement |

## Rapport de clôture obligatoire

Chaque tranche doit rapporter : branche, commit, fichiers touchés, tests réellement exécutés, résultats, migrations non appliquées, dépendances externes, risques restants et liens PR/CI. Ne jamais marquer « validé » si la preuve manque.
