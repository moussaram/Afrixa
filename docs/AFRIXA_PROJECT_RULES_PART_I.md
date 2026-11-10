# Afrixa — Partie I : règles générales du projet

Version : 1.0  
Date : 10 novembre 2026  
Statut : règles de référence pour toute évolution d'Afrixa

## 1. Objectif et périmètre

Afrixa est une plateforme mobile-first de social commerce. Elle regroupe notamment le réseau social, les vidéos et publications, les profils, les interactions, la messagerie, les lives, les outils créateurs, les publicités, les boutiques, les produits, les commandes, les paiements et la livraison.

Ces règles s'appliquent à tout le dépôt : frontend, fonctions serveur, schéma PostgreSQL/Supabase, migrations, intégrations externes, tests, documentation, CI et application mobile.

## 2. Principes non négociables

1. **Pas de fausse fonctionnalité en production.** Une action affichée comme disponible doit exécuter un vrai parcours connecté au serveur. Les mocks et fixtures sont réservés aux tests, storiesbook ou démonstrations explicitement signalées.
2. **Le serveur fait autorité.** Le navigateur ne décide jamais seul d'un prix, d'un rôle, d'un statut de commande, d'un paiement confirmé, d'un solde, d'un gain, d'une commission, d'un stock ou d'un droit d'accès.
3. **Sécurité par défaut.** Toute nouvelle table exposée par l'API doit avoir RLS activé et des politiques minimales. Tout endpoint sensible authentifie l'utilisateur et vérifie son autorisation sur la ressource concernée.
4. **Aucune régression silencieuse.** Une modification doit préserver les parcours existants non concernés et être accompagnée de tests pertinents.
5. **Staging avant production.** Toute migration, intégration de paiement, livraison, stockage, authentification ou fonctionnalité financière doit être validée sur un environnement de test avant activation en production.
6. **Pas d'affirmation sans preuve.** Un élément est « implémenté », « testé », « validé staging » ou « en production » uniquement si les preuves correspondantes existent. Un fichier de migration commité n'est pas une migration appliquée.
7. **Aucun secret dans Git.** Les clés privées, tokens, mots de passe, clés webhook et credentials restent dans les gestionnaires de secrets des environnements concernés.

## 3. Architecture et responsabilités

- **Frontend React/TypeScript :** affichage, navigation, validation ergonomique et appels API. Il ne détient aucune autorité métier ou financière.
- **Supabase Auth :** identité et sessions. Ne jamais inventer un système parallèle de mots de passe ou d'OTP.
- **PostgreSQL :** source de vérité pour les données, contraintes, transactions, statuts, relations et journaux.
- **RLS :** contrôle d'accès au niveau des lignes, complémentaire aux vérifications serveur ; elle ne doit pas être remplacée par un simple masquage UI.
- **Edge Functions :** opérations privilégiées, appels fournisseurs, webhooks, tâches nécessitant une clé serveur et orchestration de workflows.
- **Services externes :** ils sont encapsulés derrière des adaptateurs serveur. Leur disponibilité, contrat, territoire, authentification et documentation doivent être confirmés avant activation.
- **Types partagés :** les types applicatifs doivent refléter le schéma réel. Après une modification du schéma, régénérer ou mettre à jour les types et supprimer les casts temporaires devenus inutiles.

## 4. Règles de sécurité et confidentialité

- Appliquer le principe du moindre privilège aux rôles, politiques RLS, fonctions, clés et accès administrateur.
- Vérifier l'identité, la propriété de la ressource, sa visibilité, son état et les règles métier sur le serveur pour chaque mutation sensible.
- Les profils publics doivent passer par une projection publique explicitement limitée ; ne jamais exposer directement les champs privés d'un profil.
- Les contenus privés, abonnés uniquement, bloqués, supprimés, en attente de modération ou non publiés ne doivent pas être accessibles via une route alternative, une URL média ou une requête directe.
- Les médias privés utilisent des URLs ou jetons temporaires. Les fichiers numériques achetés restent dans un stockage privé et nécessitent un droit d'accès vérifié à chaque téléchargement.
- Limiter les tentatives et volumes pour les actions abusables : OTP, connexion, commentaires, messages, uploads, partages, cadeaux, paiements et endpoints publics.
- Valider et normaliser les entrées côté serveur. Ne jamais faire confiance aux champs de rôle, prix, montant, statut ou identifiant vendeur envoyés par le client.
- Journaliser les opérations sensibles sans écrire de secrets, mots de passe, OTP, données de carte ou contenu privé non nécessaire dans les logs.
- Les actions d'administration doivent être réservées à des rôles vérifiés et conserver une trace d'audit.

## 5. Règles financières, marketplace et créateurs

- Tous les montants sont recalculés côté serveur à partir de données fiables. Le serveur vérifie devise, prix, remises, taxes éventuelles, frais, commissions et total.
- Les opérations financières utilisent des transactions atomiques et des clés d'idempotence lorsque des répétitions sont possibles.
- Un retour navigateur ou une capture d'écran ne prouve jamais un paiement. Seule une vérification serveur fiable (webhook signé et/ou interrogation du fournisseur) peut confirmer le paiement.
- Les soldes, coins, cadeaux, tips, commissions, revenus créateurs, remboursements, retraits et versements sont alimentés par des opérations serveur traçables ; aucun client ne peut écrire directement un solde.
- Le ledger financier doit être append-only autant que possible : les corrections sont représentées par des écritures compensatoires, pas par la réécriture de l'historique.
- Les commandes, réservations de stock, paiements, remboursements, livraisons et libérations de fonds doivent avoir des transitions explicites et contrôlées.
- Un produit numérique n'est accessible qu'après paiement confirmé et validation de sécurité du fichier. Aucun antivirus non configuré ne doit être présenté comme opérationnel.
- Un fournisseur de livraison ou de paiement reste désactivé tant que l'accès, le contrat, le territoire, les endpoints et les scénarios de test ne sont pas confirmés.

## 6. Règles social, contenus et créateurs

- Les compteurs visibles (likes, commentaires, partages, abonnés, vues, cadeaux) doivent provenir de données canoniques ou d'agrégats maintenus côté serveur.
- Les actions sociales doivent être idempotentes ou protégées contre les doublons, respecter les blocages et préférences de confidentialité, et ne pas notifier l'auteur de sa propre action sauf règle produit explicite.
- Les contenus doivent suivre un cycle de vie explicite : brouillon, téléversement, traitement, modération, publication, retrait ou suppression.
- Les vues monétisables, récompenses, défis et éligibilités créateurs doivent être calculés à partir de règles serveur documentées, avec protections anti-fraude.
- Un live doit contrôler les permissions de l'hôte, co-hôtes et spectateurs ; chat, cadeaux et transactions doivent être persistants et contrôlés côté serveur.
- Une animation de cadeau ou un compteur local n'est pas une transaction financière.

## 7. Qualité du code et conventions

- Utiliser TypeScript et des types explicites aux frontières API, Supabase et fournisseurs.
- Éviter `any`, les casts non justifiés, les duplications de logique métier et les composants surchargés. Toute exception temporaire doit être localisée, commentée et suivie d'une tâche de suppression.
- Centraliser les règles métier et les accès aux données dans des services/hooks adaptés plutôt que de les dupliquer dans plusieurs composants.
- Gérer systématiquement les états chargement, erreur, vide, succès, absence de permission et indisponibilité réseau.
- Les mutations UI doivent afficher un résultat confirmé par le serveur ; en cas d'échec, rétablir l'état cohérent et informer clairement l'utilisateur.
- Respecter les conventions existantes de nommage et de structure avant d'introduire un nouveau pattern.
- Ne pas ajouter de dépendance sans nécessité démontrée ; vérifier maintenance, licence, taille et sécurité.

**Dette technique connue :** la configuration TypeScript actuelle n'active pas encore le mode strict et autorise notamment `noImplicitAny: false`. Cette règle n'est pas modifiée brutalement dans cette tranche afin d'éviter une vague de corrections non maîtrisée. Le durcissement TypeScript doit être traité progressivement, par lots testés, jusqu'à activation de `strict`.

## 8. UX, accessibilité et internationalisation

- L'interface doit rester utilisable sur mobile, tablette et ordinateur, y compris sur des connexions lentes.
- Prévoir navigation clavier, labels accessibles, contrastes suffisants, focus visible et messages d'erreur compréhensibles.
- Ne pas communiquer uniquement par la couleur ou une animation.
- Centraliser les textes destinés aux utilisateurs et préparer la cohérence des langues. Le français est la langue par défaut du produit.
- Afficher les devises, formats de date, fuseaux horaires et nombres sans ambiguïté. Ne pas supposer qu'une devise ou un opérateur est disponible dans tous les pays.

## 9. Données, migrations et compatibilité

- Toute évolution de schéma passe par une migration SQL versionnée, relue et reproductible.
- Une migration doit être sûre à rejouer lorsque cela est possible, expliciter ses préconditions et ne pas supprimer de données sans stratégie de sauvegarde et de retour arrière.
- Ne jamais appliquer une migration distante ou modifier des données de production dans le cadre d'une correction ordinaire sans autorisation explicite.
- Préférer les migrations additives et les déploiements compatibles : ajouter, migrer les données, basculer le code, puis retirer l'ancien schéma dans une étape ultérieure.
- Ajouter les index, contraintes, clés étrangères et valeurs par défaut nécessaires ; vérifier les plans de requête pour les parcours volumineux.
- Documenter les changements qui exigent une action manuelle (secrets, activation fournisseur, configuration dashboard, backfill, tâche admin).

## 10. Tests et critères de validation

Chaque changement doit choisir les tests adaptés parmi :
- tests unitaires de fonctions métier ;
- tests de composants et hooks ;
- tests d'intégration API/Edge Functions/PostgreSQL ;
- tests RLS avec plusieurs utilisateurs et rôles ;
- tests de concurrence, idempotence et transitions d'état ;
- tests end-to-end des parcours acheteur, vendeur, créateur, spectateur et administrateur ;
- tests de build, lint, accessibilité, responsive et régression.

Pour les parcours sensibles, couvrir au minimum le succès, l'échec, le doublon, l'utilisateur non autorisé, l'état expiré et l'interruption réseau.

## 11. Observabilité et exploitation

- Les erreurs doivent être exploitables : contexte technique suffisant, identifiant de corrélation, horodatage et statut du workflow.
- Ne pas exposer de données personnelles ou de secrets dans les logs.
- Prévoir retries bornés, backoff, idempotence et file d'échec pour les traitements asynchrones.
- Surveiller paiements, webhooks, uploads, notifications, livraisons, lives et tâches financières.
- Toute opération manuelle de reprise doit être documentée et auditable.

## 12. Gestion Git et livraison

- Ne pas travailler directement sur `main`.
- Une tâche cohérente = une branche dédiée et un périmètre clairement décrit.
- Avant de coder : lire les fichiers concernés, vérifier les branches/PR existantes, identifier les dépendances et noter les risques.
- Ne pas écraser ou réécrire le travail d'une autre branche. Réutiliser la chaîne de branches existante si elle constitue la base de la correction.
- Après chaque tranche : lancer les vérifications disponibles, examiner le diff, documenter les limites, committer et pousser sur la branche de travail.
- Ouvrir une PR en brouillon si la validation staging ou une dépendance externe manque.
- Ne jamais fusionner dans `main`, déployer en production ou modifier les secrets sans autorisation explicite.

## 13. Statuts officiels d'une fonctionnalité

Employer les statuts suivants dans les rapports :
- **À analyser** : comportement et code pas encore suffisamment inspectés.
- **À faire** : insuffisance confirmée, correction non commencée.
- **En cours** : correction en développement.
- **Implémenté** : code présent, mais validation pas nécessairement terminée.
- **CI validée** : lint/build/tests automatisés concernés réussis sur le commit identifié.
- **Staging validé** : scénarios réels vérifiés sur un environnement de staging avec preuves.
- **Production validée** : déployé et vérifié en production avec autorisation.
- **Bloqué** : dépend d'un accès, d'une décision, d'un fournisseur ou d'une action du propriétaire.
- **Non applicable** : hors périmètre, avec justification.

Ne jamais confondre « implémenté » et « validé ».

## 14. Références de travail

Les règles détaillées par domaine et les procédures de contribution sont maintenues dans :
- `CONTRIBUTING.md` ;
- `docs/AFRIXA_DEFINITION_OF_DONE.md` ;
- les audits et plans spécialisés sous `docs/` ;
- les tests et scénarios sous `docs/testing/`.

Toute dérogation à ces règles doit être explicitement justifiée dans la PR et accompagnée d'une mesure compensatoire.
