# AFRIXA — AUDIT DE SÉCURITÉ

**Périmètre :** analyse statique du code main, migrations SQL, policies RLS et Edge Functions.  
**Échelle :** critique = exposition/altération directe de données sensibles ou d'argent ; élevée = contournement de règles d'accès/métier ; moyenne = abus/fiabilité/privacy limitée ; faible = durcissement.

## 1. Résumé des risques

| ID | Gravité | Domaine | Constat vérifié | Impact potentiel | Priorité |
|---|---|---|---|---|---|
| SEC-01 | critique | PII/profils | policy SELECT `profiles` avec `USING (true)` ; table contient naissance, téléphone et vérifications | lecture publique de données personnelles | immédiate |
| SEC-02 | critique | portefeuille créateur | `creator_wallet_owner_all` autorise FOR ALL au propriétaire | modification directe de balance/pending/total_earned | immédiate |
| SEC-03 | critique | Afrixa Coins | `afrixa_coins_owner_all` autorise FOR ALL au propriétaire | altération directe du solde de coins | immédiate |
| SEC-04 | critique | paiement UI | `AfrixaPaySheet.handlePay` utilise setTimeout, référence aléatoire et toast « Paiement confirmé » | faux reçu/confirmation sans paiement ni commande réelle | immédiate |
| SEC-05 | critique | publication vidéo | policies owner INSERT/UPDATE ne forcent pas `is_published=false` ni `moderation_status=pending` | publication directe pouvant contourner upload/modération | immédiate |
| SEC-05 | élevée/critique | Edge privilégiées | `calculate-scores` et `cleanup-stories` utilisent service-role sans contrôle explicite dans le handler | invocation par un utilisateur disposant d'un JWT accepté par la passerelle, déclenchement d'opérations globales | immédiate |
| SEC-05 | élevée | messagerie | policy UPDATE conversations vérifie participant mais ne verrouille pas les colonnes participant_1/2 | possibilité de modifier l'autre participant tout en restant dans la conversation | élevée |
| SEC-05 | élevée | confidentialité | `who_can_message`, blocs et restrictions ne sont pas appliqués uniformément ; `getOrCreateConversation` crée directement une conversation | messages non désirés malgré préférences/blocage | élevée |
| SEC-05 | élevée | ledger financier | plusieurs tables de soldes/transactions et INSERT directs avec champs financiers contrôlés par client | faux achats, faux revenus, divergence de soldes | immédiate |
| SEC-05 | élevée | stock | trigger checkout vérifie stock sous FOR SHARE, mais aucun décrément/réservation atomique du stock n'est constaté | survente en cas de commandes concurrentes | élevée |
| SEC-05 | élevée | payout | payout est désactivé par défaut et helper frontend non appelé par le parcours commande | vendeur non payé automatiquement ; soldes UI non fiables | élevée |
| SEC-05 | élevée | admin/modération | aucune RBAC admin/route admin identifiée ; sanctions et signalements sans console de traitement | absence de réponse aux abus et privilèges admin non définis | élevée |
| SEC-05 | moyenne | rate limiting | Edge/RPC existent mais hook `useSecurityModeration` non consommé par les parcours principaux | contrôles de fréquence contournables | élevée |
| SEC-05 | moyenne | blocage | table et fonction block existent, mais filtres non systématiques dans feed/messages/search | blocage incomplet | moyenne |
| SEC-05 | moyenne | présence | SELECT public sur `user_presence` | exposition présence/last_seen | moyenne |
| SEC-05 | moyenne | typing | policy `typing_indicators FOR ALL` ne lie pas clairement user_id à auth.uid() | usurpation d'indicateur de frappe dans une conversation | moyenne |
| SEC-05 | moyenne | types | 50 tables migrées absentes des types générés main | erreurs runtime, contournements any, dérive schéma/code | élevée |
| SEC-05 | moyenne | webhook/atomicité | transactions, commandes et splits changés par plusieurs appels ; split check-then-insert sans unicité transaction_id | états partiels ou doublons sous concurrence | élevée |
| SEC-05 | faible/moyenne | logs | plusieurs console.error peuvent contenir objets d'erreur provider/DB | risque d'informations techniques dans logs ; vérifier filtrage | moyenne |

## 2. Détails des constats critiques

### SEC-01 — Profil public et données personnelles

La policy de lecture de `profiles` est publique. La table stocke des données qui ne devraient pas toutes être accessibles à tout visiteur. Les écrans qui ne sélectionnent que quelques colonnes ne constituent pas une protection côté API.

**Validation requise :** requêtes REST avec rôle anon/authenticated sur les champs sensibles, inspection des grants et policies en production.  
**Correction future :** séparer champs publics/privés ou appliquer des grants/policies de colonnes et un modèle de profil public minimal.

### SEC-02/03/10 — Argent et coins modifiables par le propriétaire

Le propriétaire d'un wallet n'est pas une autorité de crédit. Les policies `FOR ALL` sur `creator_wallet` et `afrixa_coins` permettent au client propriétaire de modifier les champs de solde. D'autres tables autorisent l'insertion directe de lignes `creator_earnings`, `coin_purchases`, `transactions`, `gift_transactions` ou memberships sans preuve serveur de paiement/débit.

**Correction future :** ledger append-only, mutations par fonctions serveur, interdiction d'écrire les montants/statuts depuis le client, idempotency keys et réconciliation.

### SEC-04 — Fausse confirmation de paiement

`AfrixaPaySheet` affiche une commande confirmée après trois secondes sans appeler le hook FedaPay ni créer une commande. La référence est générée avec Math.random. Le composant est utilisé dans le parcours group-buy mock. Ce flux peut tromper l'utilisateur sur la réalité de son achat.

**Correction future :** remplacer le parcours par un checkout réel ou bloquer explicitement le paiement tant que le produit n'est pas connecté ; ne jamais afficher succès sans confirmation provider.

## 3. Vérification complémentaire et correction du constat

Le constat initial relatif à la policy `System can insert notifications` a été invalidé après relecture de toute la chaîne de migrations : la migration `20260411220556_26795bd8-27d7-4ee6-a493-6eee0ebc92e4.sql` exécute explicitement `DROP POLICY "System can insert notifications"` puis crée `Users can insert their own notifications` avec `WITH CHECK (auth.uid() = user_id)`. Cette policy ouverte ne doit donc pas être comptée comme un risque persistant dans le schéma versionné `main`. Le test négatif A-vers-B reste pertinent pour confirmer le comportement du schéma réellement déployé.

## 4. Contrôles positifs observés

- Les fonctions FedaPay checkout/verify authentifient l'utilisateur et vérifient l'appartenance acheteur/commande.
- Le webhook FedaPay vérifie une signature sur le corps brut puis relit la transaction auprès du fournisseur.
- Les fonctions Cloudflare authentifient l'utilisateur et vérifient la propriété de la vidéo.
- `get-agora-token` vérifie l'utilisateur, la session, le rôle publisher/audience et les règles followers/private.
- `enforce_order_checkout_integrity` dérive prix/vendeur/commission du produit et bloque les modifications client des champs financiers.
- `enforce_payment_transaction_integrity` réserve les updates transaction au service-role.
- `enforce_dispute_integrity` limite l'ouverture au buyer éligible et les modifications aux preuves.
- `enforce_creator_program_integrity` calcule les niveaux depuis le nombre de followers.
- Le README interdit les secrets serveur dans les variables VITE.

Ces contrôles sont des protections de code, pas la preuve qu'ils sont déployés ou testés en production.

## 5. Autres domaines à auditer par tests

- RLS des messages, photos et médias signés.
- Accès à stories, lives privés, vidéos followers et produits désactivés.
- Utilisation de comptes bloqués, suspendus ou bannis.
- CORS, limites de payload, validation MIME réelle et SSRF dans URL média.
- Fuite de données par logs et analytics.
- Contrôles d'authentification, OTP, CAPTCHA, session revocation et rotation.
- Race conditions paiement, payout, stock, coins, cadeaux et memberships.
- Séparation des rôles administrateur, support, modérateur, vendeur et créateur.

## 6. Conditions minimales avant production

Aucune mise en production de flux financiers tant que :
1. les soldes ne sont pas modifiables directement par l'utilisateur ;
2. les transactions et paiements sont idempotents et réconciliables ;
3. les webhooks sont signés et testés en rejeu ;
4. les politiques RLS cross-user sont testées ;
5. les profils privés et données personnelles sont protégés ;
6. les actions de modération et rôles admin sont autorisés côté serveur ;
7. build, lint, tests automatiques et tests sandbox passent.

**Limite :** audit statique. Pas de test d'intrusion, requête sur base de production, scan de dépendances ou test provider réel réalisé.
