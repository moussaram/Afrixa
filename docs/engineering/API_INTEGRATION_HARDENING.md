# Audit et durcissement des intégrations API Afrixa

Date : 18 novembre 2026  
Branche : `feat/api-integration-hardening-20261118`

## Objectif

Centraliser les règles de fiabilité des appels serveur aux fournisseurs sans changer les fournisseurs choisis, exposer de secrets dans le navigateur, ni répéter aveuglément des opérations financières ou des envois de notifications.

## Cartographie confirmée dans le dépôt

| Domaine | Intégration | État observé | Traitement |
|---|---|---|---|
| Backend | Supabase Auth, PostgREST, RPC, Realtime, Edge Functions | Utilisé dans toute l'application | Conserver l'authentification utilisateur, les contrôles RLS et les RPC atomiques ; auditer les erreurs et les volumes par domaine |
| Paiement | FedaPay | Edge Functions de création, vérification, webhook ; paiement XOF | Clé secrète uniquement côté Edge Functions ; vérification serveur du montant, devise, référence et statut ; aucune répétition automatique de POST de paiement |
| Vidéo | Cloudflare Stream + TUS | Création d'upload, transfert TUS, vérification et suppression | Conserver l'upload TUS ; réessayer uniquement les lectures GET ; ne pas répéter la création d'upload ou les suppressions sans idempotence |
| Live | Agora RTC | SDK navigateur + Edge Function de génération de token | Certificat uniquement côté serveur ; jetons limités à la session et au rôle ; renouvellement avant expiration |
| Modération image | Google Cloud Vision SafeSearch | Appel serveur depuis `moderate-image` | Secret serveur ; timeout et retries bornés car l'analyse est sans effet de bord ; échec fermé, jamais approuvé par défaut |
| Push | Firebase Cloud Messaging HTTP v1 | Jeton OAuth de compte de service puis envoi par installation | Compte de service serveur ; timeout ; pas de retry aveugle sur `messages:send` pour éviter les notifications dupliquées ; supprimer les tokens invalides |
| Analytics | Firebase Analytics | SDK client, activation après consentement | Conserver le consentement explicite ; ne pas envoyer d'événements avant accord |
| Adresses | Google Maps Places Autocomplete | Chargement du SDK navigateur et recherche d'adresse | Clé publique limitée par domaines et APIs autorisées ; chargement unique, timeout et nettoyage corrects |
| Livraison | Yango | Lien profond Maps/Yango uniquement, pas d'API B2B constatée | Ne pas présenter comme une intégration API de réservation/livraison |
| Livraison | OuiGoo/Wigo | Pas d'appel API constaté dans le dépôt | Contrat, accès, endpoints, sandbox et webhooks à obtenir avant activation |
| Assistant IA | Akili | Pas de fournisseur IA ni de service Akili repéré dans le dépôt audité | Respecter la décision produit : couche modèle indépendante ; ne pas brancher un LLM tiers non validé |
| Paiement mobile money direct | MTN, Moov, Wave, Orange | Opérateurs présentés dans l'interface, mais traitement financier constaté via FedaPay | Ne pas confondre le choix de l'opérateur avec une API opérateur directe |

## Durcissements ajoutés dans cette branche

### Client HTTP Edge Functions

Nouveau module `supabase/functions/_shared/http.ts` :

- délai maximum configurable et borné ;
- tentatives limitées à trois ;
- prise en compte de `Retry-After` (avec plafond) ;
- temporisation exponentielle courte ;
- annulation du corps de réponse avant une nouvelle tentative ;
- propagation de l'annulation de l'appelant ;
- retries désactivés par défaut ;
- aucun retry implicite sur POST/DELETE, sauf activation explicite par un appelant qui sait que l'opération est sans effet de bord.

### FedaPay

- Les lectures GET/HEAD peuvent être retentées en cas de timeout réseau ou de réponses transitoires (408, 425, 429, 5xx sélectionnés).
- La création de transaction POST et les opérations financières ne sont jamais retentées automatiquement.
- Les réponses non JSON ou HTTP non réussies restent des erreurs explicites ; les secrets et corps de paiement ne sont pas journalisés.

### Cloudflare Stream

- Les vérifications d'état GET bénéficient des retries bornés.
- La création TUS/POST et DELETE ne sont pas retentées automatiquement afin d'éviter les doublons et les suppressions répétées.
- Les limites et validations existantes de taille, durée, propriétaire et UID sont conservées.

### Google Vision

- L'analyse SafeSearch a un timeout et des retries bornés, car l'analyse est une lecture sans effet de bord.
- Une réponse illisible ou une annotation absente reste une erreur ; aucune image n'est approuvée par défaut.

### Firebase Cloud Messaging

- L'échange OAuth et chaque envoi FCM ont un timeout.
- Les envois ne sont pas retentés automatiquement : le fournisseur peut avoir accepté le message même si la réponse réseau a été perdue.
- La suppression des tokens `UNREGISTERED` est conservée.

### Google Maps Places

- Le chargement du SDK reste partagé entre les composants.
- Un timeout ou une erreur réseau retire le script et nettoie le callback, afin qu'un nouvel essai ne laisse pas plusieurs scripts/callbacks orphelins.

## Améliorations supplémentaires recommandées, non activées dans ce commit

1. **Contrats de réponse typés** pour chaque Edge Function, avec schémas Zod côté client et serveur.
2. **Identifiants de corrélation** transmis par les clients, renvoyés par les Edge Functions et enregistrés sans données personnelles.
3. **Journal technique structuré** : fournisseur, opération, durée, statut HTTP, code d'erreur, tentative ; jamais de token, clé, numéro de téléphone, contenu privé ou corps complet.
4. **Idempotence financière persistante** : clé unique par opération métier, contraintes SQL et fonctions atomiques ; ne pas s'appuyer uniquement sur un UUID créé à chaque clic.
5. **Circuit breaker et quotas** par fournisseur pour éviter les tempêtes de requêtes en panne.
6. **Cache OAuth FCM** avec verrouillage de rafraîchissement dans un runtime partagé ; à tester selon le cycle de vie réel des Edge Functions.
7. **Renouvellement Agora basé sur `expiresIn`**, gestion de reconnexion et nettoyage des pistes après perte réseau.
8. **Observabilité** : tableaux de bord de latence, taux d'erreur, 429, timeouts, dépenses et quotas.
9. **Tests de contrat** avec fixtures/sandbox FedaPay, Cloudflare, Vision, FCM et Agora ; tests de non-répétition des paiements.
10. **Clés Google Maps** : restrictions HTTP referrer, restriction aux APIs Places/Maps réellement utilisées et quotas journaliers.
11. **Yango/OuiGoo** : n'activer qu'après validation contractuelle de l'API et des conditions de service au Bénin, et après tests sandbox.
12. **Akili** : déployer le modèle propre Afrixa AI/Akili derrière une interface serveur stable ; aucune clé de modèle dans le client.

## Points à vérifier avant production

- Vérifier la présence et la portée des secrets dans chaque environnement (jamais dans `VITE_*` sauf clés publiques conçues pour le navigateur).
- Confirmer les URLs sandbox/production FedaPay et les clés webhook distinctes.
- Confirmer les permissions minimales du token Cloudflare Stream.
- Confirmer les quotas Google Vision, FCM et Maps et les restrictions de clés.
- Confirmer l'expiration et les permissions des jetons Agora.
- Tester les délais, coupures réseau, 429, 5xx, réponses vides et erreurs de parsing.
- Tester les doubles webhooks, doubles clics et retries côté client.
- Confirmer que les Edge Functions sont déployées dans l'environnement de staging et que les secrets y sont configurés.

## Portée et limites

Cette branche durcit les appels HTTP serveur directement identifiés et le chargeur Google Maps. Elle ne remplace pas un audit exhaustif de chaque appel Supabase métier, ne crée pas les intégrations OuiGoo/Yango/AI, ne modifie pas les fournisseurs, ne configure pas les secrets et ne déploie rien. Les intégrations financières, livraison, IA et staging doivent être validées avec les accès réels avant activation.
