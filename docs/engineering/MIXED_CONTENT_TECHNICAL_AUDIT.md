# Audit technique — publications mixtes Afrixa

Date de l'audit : 18 novembre 2026  
Branche inspectée : `feat/mixed-content-experience-architecture-20261118`

## Résultat exécutif

L'expérience de contenus mixtes est une évolution réalisable, mais le dépôt ne possède pas encore les fondations serveur nécessaires pour publier proprement des photos, albums et textes dans le fil principal. Il ne faut donc pas ajouter seulement des boutons d'interface ni brancher des insertions client directes qui contourneraient la modération et la confidentialité.

Le parcours vidéo avancé est un actif existant à préserver. Le parcours caméra/éditeur `/create` est incomplet : il annonce un succès après un délai sans écrire de publication en base.

## Éléments confirmés dans le code

### 1. Modèle actuel

- La table sociale centrale est `public.videos`.
- Elle porte l'auteur, les URLs HLS/miniature, le titre, la description, la durée, les compteurs, la localisation, `moderation_status`, `is_published` et les dates.
- Les interactions sont spécialisées : `video_likes`, `video_saves`, `video_comments`.
- Le fil `src/hooks/useFeed.ts` appelle le RPC `get_feed` et convertit les lignes en objets `Video` via `mapVideoRow`.
- Aucun contrat/table canonique `content_items` ni table de médias ordonnés `content_media` n'a été trouvé dans les migrations et fichiers consultés.

### 2. Deux parcours vidéo différents

- `/upload-video` utilise `AdvancedVideoUpload`, Cloudflare Stream et TUS. Il vérifie le type MP4/MOV, la taille (500 MB), la durée (15 secondes à 10 minutes), crée une session via Edge Function, transfère le fichier, puis vérifie le traitement Cloudflare.
- Les statuts de traitement empêchent de considérer un média en cours de traitement comme prêt. Le contenu doit rester privé/en attente jusqu'à validation.
- `/create` conduit à `PostEditor`. Son `handlePost` actuel simule un délai de 2,5 secondes, affiche « Vidéo publiée avec succès » et navigue vers l'accueil. Il ne persiste pas le média. Ce faux succès doit être supprimé avant d'ouvrir ce parcours au public.
- Les deux parcours ne doivent pas être confondus : le second n'annule pas le pipeline Cloudflare du premier.

### 3. Sécurité et modération existantes

- Les migrations ajoutent des politiques RLS sur `videos`, notamment confidentialité, publication, statut Cloudflare et masquage par signalements.
- Le RPC `get_feed` reste le chemin de lecture du fil ; le client ne doit pas remplacer ce contrôle serveur par une requête libre.
- L'Edge Function `moderate-image` existe. Elle exige une session utilisateur et une clé Google Vision, accepte une image encodée en base64 jusqu'à 5 MB et retourne `approved`, `review` ou `blocked`.
- Cette fonction ne constitue pas, à elle seule, un système de publication : il faut encore un stockage contrôlé, un enregistrement de publication, un état de modération persistant et un mécanisme empêchant l'accès public avant validation.
- Dans les migrations et fichiers consultés pendant cet audit, aucune déclaration explicite de bucket Storage et de politique `storage.objects` pour les publications photo n'a été repérée. L'existence éventuelle d'une configuration distante Supabase doit être vérifiée sur le projet staging avant de créer ou réutiliser un bucket.

## Décisions techniques à respecter

1. Ne pas supprimer ni renommer `videos`, `video_likes`, `video_saves`, `video_comments`, `get_feed` ou les Edge Functions Cloudflare.
2. Introduire le modèle canonique de façon additive et rétrocompatible.
3. Relier chaque contenu vidéo canonique à sa ligne vidéo existante par une relation explicite et unique ; ne pas recopier les médias vidéo dans un second pipeline.
4. Garder les photos et albums dans un bucket privé tant que la publication et la modération ne sont pas approuvées. Les URLs signées doivent être émises après vérification des droits.
5. Le texte seul ne crée aucune ligne média.
6. Un album doit conserver l'ordre des images en base, avec une contrainte d'unicité sur le rang par contenu.
7. Les règles d'accès doivent couvrir l'auteur, la visibilité (public/abonnés/privé), les blocages, les sanctions, les signalements et les statuts de modération.
8. Les likes, commentaires, sauvegardes et signalements des nouveaux formats doivent viser l'identifiant canonique du contenu, sans casser les interactions vidéo existantes.
9. Le client n'affiche un succès qu'après confirmation de l'opération serveur. Une erreur de transfert ou d'enregistrement doit laisser un état réessayable et ne pas créer de publication fantôme.

## Ordre d'implémentation et portes de validation

### Phase A — Préparation de staging (bloquante avant migration)

- Vérifier la connexion au bon projet Supabase staging.
- Comparer les migrations locales à `supabase_migrations.schema_migrations` et au schéma distant réel.
- Inspecter les buckets existants, leur visibilité et leurs politiques Storage.
- Vérifier les politiques RLS effectives, les fonctions/RPC et les privilèges.
- Vérifier les secrets requis par la modération d'images et Cloudflare, sans exposer leurs valeurs.
- Tester les parcours vidéo actuels sur staging avant tout changement.

**Porte A :** aucune migration de production et aucun changement de bucket tant que le projet staging, les politiques et les secrets n'ont pas été confirmés.

### Phase B — Fondation SQL additive

- Créer `content_items` avec un type contrôlé (`video`, `photo`, `carousel`, `text`), auteur, texte, visibilité, état de publication/modération et dates.
- Créer `content_media` avec ordre, chemin Storage, type MIME, taille, dimensions, état de traitement et métadonnées contrôlées.
- Ajouter les contraintes de cohérence (texte sans média, photo avec un média, album avec plusieurs médias, vidéo liée à une ligne vidéo existante).
- Ajouter index, RLS et fonctions serveur de création/finalisation.
- Écrire des tests SQL qui prouvent les refus d'accès aux contenus privés, non approuvés, bloqués ou signalés.
- Prévoir une migration de liaison progressive des vidéos existantes, sans basculer immédiatement le fil.

**Porte B :** tests RLS et contraintes réussis sur staging ; les vidéos existantes restent visibles et lisibles.

### Phase C — Publication réelle

- Remplacer le faux `handlePost` par des appels au service de publication.
- Réutiliser Cloudflare/TUS pour les vidéos, y compris les médias capturés depuis la caméra, sans créer de second chemin vidéo.
- Ajouter l'upload photo simple et multi-images avec validation MIME, taille, dimensions, nombre d'images, annulation et nettoyage des fichiers orphelins.
- Exécuter la modération image avant mise à disposition publique ; conserver les états `review` et `blocked`.
- Ajouter la publication texte avec limites et modération de texte.
- Rendre les opérations idempotentes afin qu'un double clic ou une reprise réseau ne crée pas de doublons.

**Porte C :** après rechargement, chaque publication approuvée est retrouvable ; les échecs ne créent pas de faux succès.

### Phase D — Fil mixte et interactions

- Introduire un contrat TypeScript discriminé et un rendu dédié pour chaque format.
- Conserver le composant vidéo existant comme renderer vidéo.
- Ajouter photo, carrousel et texte dans le même défilement vertical.
- Ajouter pagination stable, déduplication, règles autoplay et une seule vidéo active.
- Migrer les interactions vers le contenu canonique par étapes, avec compatibilité vidéo.
- Ajouter les filtres de profil sans transformer l'accueil en grille.

**Porte D :** tests fonctionnels des quatre formats et tests mobile/tablette/ordinateur réussis.

## Tests minimums à exiger

- Utilisateur non connecté : aucun accès aux contenus privés.
- Auteur : accès à son brouillon et à ses contenus en attente.
- Abonné/non-abonné : résultat conforme à la visibilité et aux règles du créateur.
- Utilisateur bloqué : contenu et interactions refusés dans les deux sens prévus par la politique produit.
- Média en traitement, erreur ou en revue : jamais exposé comme publication publique prête.
- Album : ordre stable et absence d'image manquante.
- Double soumission : une seule publication.
- Suppression/annulation : médias orphelins nettoyés ou inscrits dans une file de nettoyage.
- Fil paginé : aucun doublon entre deux pages et aucun contenu interdit.
- Régression : upload Cloudflare, lecture HLS, likes, commentaires et sauvegardes vidéo continuent de fonctionner.

## Limites de cet audit

Cet audit est basé sur les fichiers et migrations du dépôt sur la branche indiquée. Il ne prouve pas l'état réel du projet Supabase distant, des buckets configurés dans le tableau de bord, des secrets Railway/Supabase, ni l'exécution réelle des Edge Functions. Ces éléments doivent être vérifiés sur staging avant de déclarer le chantier prêt pour production.


## Vérification complémentaire du projet Supabase Afrixa (lecture seule)

Le connecteur Supabase a identifié le projet nommé **Afrixa**, état `ACTIVE_HEALTHY`, région `eu-west-1`. Les contrôles suivants ont été exécutés en lecture seule le 18 novembre 2026 :

- `public.videos` existe ; `public.content_items` et `public.content_media` n'existent pas encore.
- `storage.buckets` contient actuellement **0 bucket**.
- Le journal distant `supabase_migrations.schema_migrations` se termine à `20261109182143` (`afrixa_20261106180000_sync_video_engagement_counts`). Les migrations du dépôt pour la vérification d'identité (`20261117190000`) et la vérification entreprise/boutique (`20261118100000`) ne sont donc pas enregistrées dans ce projet distant au moment du contrôle.
- Le connecteur ne retourne actuellement aucune Edge Function déployée pour ce projet. Cela doit être confirmé dans le tableau de bord avant toute hypothèse de disponibilité des fonctions Cloudflare ou de modération.
- Les politiques RLS des tables vidéo et de leurs interactions sont présentes. Leurs règles effectives doivent néanmoins être testées avec les rôles et scénarios utilisateurs réels avant extension au nouveau modèle.
- Le conseiller de sécurité Supabase remonte **68 avertissements** de visibilité dans le schéma GraphQL pour des objets publics accessibles en SELECT par le rôle `anon`. Ce signal ne prouve pas à lui seul une fuite de données : chaque objet doit être trié selon son caractère volontairement public, ses politiques RLS et ses privilèges. Ne pas appliquer une révocation globale sans analyse fonctionnelle.

### Conséquence opérationnelle

Le projet Supabase Afrixa inspecté est actif, mais il ne constitue pas une cible de développement sûre pour appliquer immédiatement une nouvelle migration de publications mixtes : aucun bucket Storage n'est configuré, aucune table canonique n'existe, le journal de migrations est en retard par rapport au dépôt et aucune Edge Function n'est listée par le connecteur.

**Aucune modification n'a été faite sur ce projet.** Pas de migration appliquée, pas de bucket créé, pas de fonction déployée et pas de donnée modifiée. Avant d'écrire le SQL, il faut identifier/valider un environnement staging isolé et réconcilier l'historique des migrations du dépôt avec le schéma distant. Le projet de production ne doit pas servir de bac d'essai.
