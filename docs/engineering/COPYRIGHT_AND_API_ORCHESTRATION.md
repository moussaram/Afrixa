# Afrixa — orchestration des API et protection des droits d'auteur

Date : 18 novembre 2026  
Branche : `feat/copyright-and-api-orchestration-20261118`

## 1. Décision produit

La priorité fonctionnelle n'est pas d'ajouter davantage d'API Google. La priorité est de protéger les œuvres et les titulaires de droits dans toutes les surfaces de création et de publication d'Afrixa.

Trois circuits séparés doivent être orchestrés :

1. **Identification des œuvres et gestion des droits** : empreintes audio/vidéo, correspondances, titulaires, licences, territoires, politiques, contestations et retraits.
2. **Modération de sécurité** : nudité, violence, contenu dangereux, spam et autres règles communautaires. Google Cloud Vision/Video Intelligence peut aider ici, mais ne décide jamais de la propriété intellectuelle.
3. **Adresses et géolocalisation** : Google Maps Platform pour la saisie volontaire d'adresses, les lieux de boutiques et les parcours de livraison. Ce circuit n'a aucun rôle dans la décision copyright.

Aucun résultat de reconnaissance automatique ne doit être présenté comme une décision judiciaire ou une preuve définitive de contrefaçon.

## 2. Couverture fonctionnelle obligatoire

Le pipeline copyright doit couvrir :

- vidéos importées et montées dans le studio Afrixa ;
- musique ajoutée depuis le catalogue Afrixa ou importée par le créateur ;
- audio incorporé dans les vidéos ;
- extraits de films, séries, émissions et événements ;
- lives et replays ;
- stories ;
- photos, illustrations et albums ;
- textes, livres et documents, selon les capacités et licences des fournisseurs ;
- contenus du Marketplace (images, vidéos, descriptions et documents numériques).

La détection de textes copiés ou de similarité d'image est un signal de revue, pas une preuve automatique de violation. Les exceptions, licences ouvertes, autorisations, citations et droits territoriaux doivent être examinés.

## 3. Parcours d'appel recommandé

### A. Préparation d'un upload

1. Le client demande une session d'upload à une Edge Function authentifiée.
2. Le serveur vérifie le compte, les quotas, le type MIME, la taille, la durée et les limites du produit.
3. Le serveur crée une ressource temporaire privée chez le fournisseur média déjà choisi (Cloudflare Stream pour la vidéo) et retourne uniquement les informations d'upload nécessaires.
4. Le média reste privé/non publiable. L'upload terminé déclenche un webhook signé ou une vérification serveur ; le navigateur ne peut pas marquer lui-même un média comme « contrôlé ».
5. Le serveur calcule un SHA-256 du fichier complet, un identifiant de version et, si le fournisseur retenu le permet, des empreintes perceptuelles audio/vidéo. Le hash binaire seul ne détecte pas les versions transformées.

### B. Reconnaissance copyright

1. Créer un travail `copyright_scan` idempotent par média/version, jamais un nouveau scan à chaque rendu de page.
2. Détecter les pistes audio et préparer des extraits/empreintes selon le SDK ou les spécifications du fournisseur sélectionné.
3. Soumettre le média ou ses empreintes au fournisseur de reconnaissance autorisé.
4. Utiliser un identifiant de requête idempotent lorsque le fournisseur le prend en charge. Ne jamais réessayer aveuglément un POST de soumission qui peut créer un travail facturable ou un doublon.
5. Pour un traitement asynchrone, conserver l'identifiant de tâche fournisseur et interroger son statut avec backoff exponentiel, jitter, plafond et respect de `Retry-After`. Arrêter le polling à l'échéance et envoyer le dossier en revue/reprise, pas en approbation.
6. Normaliser les résultats dans un format Afrixa commun : œuvre, type de correspondance, horodatages, confiance fournisseur, ISRC/ISWC/identifiants éventuels, titulaire déclaré, territoire, politique, version du catalogue et identifiant fournisseur.
7. Rechercher les licences et autorisations Afrixa actives avant toute restriction. Une correspondance sans politique de droits fiable ne doit pas déclencher un blocage automatique définitif.
8. Enregistrer la décision, les raisons, les preuves techniques et la version des règles appliquées.

### C. Décision et publication

États conseillés :

- `uploaded_private`
- `scan_queued`
- `scanning`
- `clear` (aucune correspondance connue dans les catalogues interrogés ; ne signifie pas « libre de droits »)
- `licensed`
- `restricted_pending_review`
- `blocked_by_policy`
- `published`
- `claim_received`
- `disputed`
- `removed_after_review`
- `scan_failed`

Règles :
- Échec fournisseur, timeout, quota épuisé ou catalogue indisponible = `scan_failed` / mise en attente selon le risque ; jamais `clear`.
- Une correspondance à confiance faible ou avec propriété conflictuelle = revue humaine.
- Une licence doit être vérifiée côté serveur et liée à l'œuvre, à l'utilisateur, à l'usage, au territoire, à la période et à l'usage commercial/non commercial.
- Les décisions automatiques de blocage doivent être limitées aux politiques contractuelles explicites et aux correspondances suffisamment fiables.
- Prévoir une voie de contestation, dépôt de licence, contre-notification et réexamen humain avec délais et historique.
- Conserver la preuve du signalement, la version du média, les timecodes et les notifications, avec accès strictement contrôlé et durée de conservation définie.

## 4. Fournisseurs de reconnaissance à évaluer — pas encore activés

### Pex Attribution Engine

Piste prioritaire à tester pour l'identification audio/vidéo avant publication, la base d'œuvres, les politiques de licences et le traitement des contestations. La documentation publique expose un endpoint de recherche par cas d'usage `identify_music` et `classify_content`. Les offres, tarifs, catalogues réellement couverts, régions, latence, SDK, conditions d'utilisation et droits disponibles au Bénin/Afrique doivent être confirmés directement avec Pex.

- Présentation : https://pex.com/products/attribution-engine/
- Documentation Search : https://docs.pex.com/search/api-documentation/start-search-use-case/

### Audible Magic

Autre candidat sérieux pour la reconnaissance audio et la surveillance de flux en direct. Demander une démonstration et confirmer la couverture vidéo, les catalogues africains, les modalités d'intégration, les coûts, les faux positifs et le processus de recours.

- https://www.audiblemagic.com/identification
- https://www.audiblemagic.com/technology

### ACRCloud

Candidat à comparer pour l'identification musicale et le contrôle copyright des uploads audio. Vérifier si l'offre exacte couvre le workflow UGC complet, la gestion de politiques/licences et la résolution de réclamations, ou seulement l'identification de pistes.

- https://www.acrcloud.com/copyright-compliance-data-deduplication/
- https://www.acrcloud.com/audio-fingerprinting/

**Aucun fournisseur n'est déclaré sélectionné.** Ne pas développer un adaptateur de production ou ajouter des secrets avant d'avoir reçu les spécifications contractuelles, un accès sandbox, des exemples de payloads et la confirmation des droits/catalogues.

## 5. Orchestration par type de contenu

| Surface | Déclencheur | Contrôle | Publication |
|---|---|---|---|
| Vidéo / studio | Upload finalisé | Audio + vidéo fingerprinting, licence, modération séparée | Après résultat exploitable |
| Musique ajoutée | Sélection dans catalogue | Vérifier la licence et les restrictions de l'œuvre | Autorisation selon licence |
| Photo / album | Upload finalisé | Similarité d'image si fournisseur disponible + modération Vision | Après contrôle de sécurité et revue si signal |
| Story | Upload finalisé | Même pipeline que le format source, priorité de traitement courte | Pas de bypass |
| Live | Démarrage puis segments continus | Reconnaissance temps réel uniquement si contrat fournisseur le permet ; alertes et intervention | Couper/muter/mettre en revue selon politique contractuelle |
| Replay | Fin du live | Scan complet hors temps réel | Peut rester restreint jusqu'au résultat |
| Marketplace | Upload d'un média produit | Contrôle de droits + modération + revue vendeur si nécessaire | Fiche média validée séparément |
| Texte / document | Soumission | Similarité textuelle uniquement avec source/catalogue autorisé ; revue et preuve de licence | Ne pas bloquer sur simple similarité |

Les scans live doivent être limités à des fenêtres configurables et au mécanisme réellement supporté par le fournisseur. Ne pas découper arbitrairement des flux puis prétendre qu'ils sont couverts par un service qui ne prend pas en charge le live.

## 6. Règles d'appel et de coût

- **Déclenchement unique** : événement serveur de média prêt, protégé par une clé idempotente `media_id + media_version + scan_policy_version`.
- **Déduplication** : réutiliser un résultat uniquement si le hash du média, le fournisseur, la version de catalogue et la politique de scan sont identiques et encore valides.
- **Pas de scan à chaque lecture** : feed, profil, page de produit et lecture vidéo ne doivent jamais appeler l'API de copyright.
- **Pas de scan à chaque frappe** : pas d'appel Vision ou Maps sur chaque caractère ; utiliser debounce pour l'autocomplete et appeler les détails seulement après sélection.
- **Retries** : lectures GET et polling peuvent être retentés avec backoff ; POST de création de scan uniquement si idempotency key/documentation fournisseur le permet.
- **Quotas** : limites par utilisateur, boutique, IP et fournisseur ; file d'attente avec concurrence contrôlée ; priorités upload/avant publication, replay et rescans.
- **Circuit breaker** : arrêter temporairement les appels à un fournisseur en panne et garder les médias non publiés dans un état explicite.
- **Observabilité** : request_id, media_id interne, provider, operation, latence, statut, code d'erreur, coût estimé et tentatives ; ne jamais logger de médias, clés, tokens, adresses privées ou contenu utilisateur.
- **Sécurité** : clés fournisseur uniquement dans les secrets Edge Functions/Railway selon le service ; signatures de webhook vérifiées ; stockage privé jusqu'à décision.
- **Rétention** : supprimer les fichiers temporaires et empreintes dérivées selon un calendrier défini ; garder les éléments de preuve d'une réclamation selon une politique juridique distincte.

## 7. Google Cloud : rôle exact

### Cloud Vision

Rôle secondaire : modération de photos, OCR et signaux d'analyse. Il ne détermine ni le propriétaire d'une œuvre ni la licence d'une image.

### Video Intelligence

Rôle secondaire : scènes, objets, logos, texte incrusté, parole et contenus explicites. Ce service ne constitue pas un moteur de fingerprint copyright. Les opérations longues doivent être asynchrones : démarrer une annotation, enregistrer l'opération, puis consulter son état avec polling borné.

### Règle de non-confusion

Un résultat SafeSearch « approved » signifie uniquement que les catégories de modération configurées ne déclenchent pas de restriction. Il ne signifie jamais que l'image ou la vidéo est libre de droits.

Références :
- https://docs.cloud.google.com/video-intelligence/docs
- https://docs.cloud.google.com/video-intelligence/docs/reference/rest
- https://docs.cloud.google.com/video-intelligence/quotas

## 8. Google Maps Platform : adresses et localisation

- Charger Places une seule fois par session d'application.
- Limiter les pays/régions proposés selon le contexte métier ; permettre la saisie manuelle si le lieu n'est pas trouvé.
- Déclencher l'autocomplete après un minimum de caractères et avec debounce ; annuler/remplacer les requêtes précédentes.
- Ne demander que les champs nécessaires après sélection : adresse formatée, identifiant de lieu et coordonnées si elles sont indispensables.
- Ne pas appeler Geocoding à chaque frappe ni géocoder de nouveau une adresse déjà validée sans raison.
- Stocker l'adresse saisie, le `place_id`, les coordonnées utiles et la date de validation ; ne pas exposer une position GPS précise sur un profil public par défaut.
- La géolocalisation du terminal est opt-in, liée à une action précise et révocable.
- Les adresses privées de livraison ne sont accessibles qu'à l'acheteur, au vendeur lorsque nécessaire et au prestataire logistique autorisé.
- Restreindre la clé navigateur par domaines et APIs ; quotas et alertes de facturation.
- Ne pas supposer qu'un `place_id` ou une adresse de Maps constitue une preuve de domicile ou d'identité.

## 9. Autres appels déjà présents

- **Cloudflare Stream/TUS** : créer un upload une fois, utiliser TUS pour reprendre le transfert, vérifier l'état par GET, ne supprimer qu'après autorisation métier ; éviter de réessayer les créations.
- **FedaPay** : transaction avec référence métier unique ; création POST non retentée aveuglément ; webhook signé, idempotent, montant/devise/référence revérifiés côté serveur.
- **Agora** : tokens RTC courts, rôle/canal vérifiés côté serveur, renouvellement selon `expiresIn`, nettoyage des pistes et reconnexion maîtrisée.
- **FCM** : cache OAuth serveur si runtime le permet, déduplication métier des notifications, token d'appareil invalidé retiré ; ne pas renvoyer un push quand l'état d'acceptation est ambigu sans stratégie de déduplication.
- **Supabase** : pagination cursor-based, projection des colonnes nécessaires, RPC atomiques pour les mutations financières, RLS et tests par rôle ; ne pas charger tout le feed ni multiplier les appels N+1.
- **Akili** : abstraction serveur propre à Afrixa AI, aucun fournisseur LLM tiers non approuvé.
- **Livraison** : OuiGoo/Wigo et Yango restent désactivés tant que contrats, accès API, webhooks, sandbox et couverture géographique ne sont pas confirmés.

## 10. Modèle de données cible — à valider avant migrations

Entités conceptuelles :
- `media_assets` : propriétaire, type, stockage privé, hash, version, état de publication ;
- `copyright_scan_jobs` : média/version, fournisseur, statut, tentatives, échéance, clé idempotente ;
- `copyright_matches` : œuvre, type de match, timecodes, confiance, identifiants fournisseur ;
- `rights_holders` : titulaire et statut de vérification ;
- `rights_licenses` : œuvre, titulaire, utilisateur/usage autorisé, territoire, période, conditions ;
- `copyright_claims` : réclamation, preuve, statut et décisions ;
- `copyright_disputes` : contestation, pièces, réponse, décision et historique ;
- `provider_webhook_events` : ID fournisseur unique, signature vérifiée, statut de traitement.

Les noms et colonnes finaux doivent suivre le schéma existant après audit de staging. Ne pas créer ces tables directement en production.

## 11. Tests d'acceptation avant activation

1. Même upload soumis deux fois ne crée pas deux scans ni deux facturations.
2. Une coupure après soumission ne provoque pas un second POST sans idempotence.
3. Timeout, 429, 5xx, résultat fournisseur vide et catalogue indisponible ne deviennent jamais une approbation.
4. Une licence expirée, hors territoire ou non commerciale n'autorise pas une publication commerciale.
5. Un utilisateur peut fournir une licence et contester une correspondance.
6. Un conflit entre ayants droit déclenche une revue humaine.
7. Une vidéo contenant une piste protégée à différents timecodes remonte les segments concernés.
8. Les photos, albums, stories, lives, replays et médias marketplace utilisent le même orchestrateur avec des politiques propres au format.
9. Aucune API de scan n'est appelée lors du simple défilement du feed ou de la lecture.
10. Les webhooks dupliqués ou non signés sont rejetés/idempotents.
11. Les adresses privées ne sont jamais rendues publiques par défaut.
12. La clé Maps ne fonctionne que depuis les origines et APIs autorisées.

## 12. Dépendances bloquantes avant intégration réelle

- Choix contractuel du fournisseur copyright (Pex, Audible Magic, ACRCloud ou autre).
- Accès sandbox/API, SDK, documentation de signature, limites, tarifs et SLA.
- Couverture du répertoire musical africain, labels/distributeurs locaux, œuvres indépendantes et territoires de licence.
- Accord juridique et opérationnel sur les règles de blocage, monétisation, contestation et contre-notification.
- Projet Supabase de staging confirmé, schéma distant réconcilié, stockage privé et politiques RLS testés.
- Clés Maps restreintes et quotas configurés.
- Tests de charge, coûts par minute média et capacité de la file d'attente.

## 13. Portée de cette phase

Cette phase fixe l'architecture et les contrats d'appel, et corrige une erreur de syntaxe constatée dans le helper Cloudflare de la phase précédente. Elle ne prétend pas connecter Pex/Audible Magic/ACRCloud sans compte, contrat et secrets. Elle ne crée pas de tables en production, ne change pas de fournisseur de paiement/média et ne déploie rien.
