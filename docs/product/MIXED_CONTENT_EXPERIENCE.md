# Afrixa — architecture de l'expérience de contenus mixtes

## Décision produit

Afrixa est un réseau social de découverte et de création dont l'expérience principale est un fil vertical immersif, inspiré des usages de TikTok. Ce n'est pas un fil Facebook transposé sur ordinateur.

La référence TikTok concerne la consommation et la découverte : lecture verticale, contenu mis au premier plan, lecture vidéo automatique quand elle est visible, navigation continue, interactions accessibles sans quitter le contenu. Elle ne signifie pas que tous les contenus doivent être des vidéos.

Afrixa accepte plusieurs formats natifs : vidéo, photo unique, album/carrousel de photos et texte seul. Le commerce, les lives, les profils, les messages et les communautés complètent cette expérience.

## Principes non négociables

1. Le fil « Pour toi » reste un parcours vertical immersif sur mobile, tablette et ordinateur.
2. « Abonnements » reprend le même lecteur de contenus mixtes, mais privilégie les comptes suivis.
3. Aucun écran de bureau ne doit convertir le fil en grille de publications de type Facebook.
4. Chaque format conserve une présentation adaptée à son média ; le texte seul ne doit pas être artificiellement présenté comme une vidéo.
5. Le défilement et la pagination doivent rester continus, sans doublons, sans sauts et sans lecture simultanée de plusieurs vidéos.
6. Les permissions, blocages, confidentialité et modération sont appliqués côté serveur pour tous les formats.
7. Les vidéos existantes et leurs interactions ne doivent pas être cassées pendant la migration.

## Formats de publication

| Format | Création | Présentation dans le fil |
| --- | --- | --- |
| Vidéo | Caméra, import, montage, son, couverture, description, hashtags | Lecteur vertical immersif, autoplay visible, commandes et actions superposées |
| Photo | Import/capture, description, hashtags, localisation et visibilité | Image mise en valeur dans une carte média, sans faux lecteur vidéo |
| Album | Sélection ordonnée de plusieurs images, couverture, description | Carrousel horizontal dans la carte du fil, indicateur de position |
| Texte | Éditeur de texte, hashtags, mentions, visibilité | Carte typographique lisible, auteur et actions sociales ; hauteur adaptée au texte |

Un contenu peut associer une légende à un média. La légende n'est pas un format de publication séparé lorsqu'elle accompagne une vidéo ou une photo.

## Navigation et écrans

### Accueil

- Onglets « Pour toi » et « Abonnements ».
- Un seul flux vertical paginé, composé de contenus de formats différents.
- Les vidéos gardent le traitement immersif actuel.
- Les photos, albums et textes utilisent leurs propres composants de rendu dans ce même flux.
- Les publicités sont identifiées clairement et insérées selon une règle de fréquence contrôlée, sans casser le défilement.

### Découvrir

Recherche et exploration de créateurs, hashtags, sons, sujets et tendances. Les résultats peuvent être présentés en grilles ou listes adaptées à la recherche : cela ne change pas le comportement du fil d'accueil.

### Créer

L'entrée « Créer » propose explicitement quatre intentions : Vidéo, Photo, Album, Texte. Le parcours vidéo existant (caméra, durée, vitesse, effets, son, éditeur) est conservé. Les parcours photo, album et texte disposent d'un éditeur adapté et partagent les réglages de légende, hashtags, mentions, localisation, visibilité et commentaires.

### Profil

Les publications sont regroupées par format avec des onglets/filtres clairs. La grille peut être utilisée dans le profil comme outil de consultation, mais ne doit pas remplacer le fil immersif de l'accueil.

## Architecture technique cible

### Modèle de contenu unifié

Introduire une ressource canonique de contenu, par exemple `content_items`, avec un type discriminant : `video`, `photo`, `carousel`, `text`.

Champs communs à prévoir : identifiant, auteur, type, légende, visibilité, état de modération, statut de publication, dates, localisation, compteurs d'engagement et paramètres d'interaction.

Les médias sont stockés dans une table enfant ordonnée, par exemple `content_media` : contenu parent, type média, chemin Storage/CDN, miniature, ordre, métadonnées et état de traitement. Les albums utilisent plusieurs lignes ordonnées. Les contenus texte n'ont aucune ligne média.

La vidéo conserve son pipeline spécialisé (Cloudflare Stream, HLS, durée, statut de transcodage et contrôles vidéo), relié au contenu canonique. Il faut migrer progressivement les vidéos existantes, sans supprimer prématurément `videos`, `video_likes`, `video_comments` ou les fonctions associées.

### API du fil

Créer une fonction serveur de fil mixte qui retourne un contrat discriminé stable. Chaque élément doit contenir le type, les champs communs, les médias ordonnés et les champs vidéo nécessaires au lecteur actuel.

- `following` : contenus publics/visibles des comptes suivis, tri chronologique déterministe.
- `foryou` : classement multi-signaux et multi-formats, avec récence, qualité/complétude, intérêts, engagement normalisé par format, diversité des créateurs et pénalités de répétition.
- Ne pas comparer naïvement les compteurs bruts entre formats : une vue vidéo, une ouverture d'album et une lecture de texte ne sont pas des événements équivalents.
- Exclure les contenus non publiés, en attente/refusés, médias non prêts, comptes bloqués et contenus non autorisés par les règles de visibilité.
- Pagination stable par curseur recommandé (score/date/id) ou pagination serveur équivalente sans doublons.

Le fil vidéo actuel `get_feed` ne doit pas être remplacé par une requête client permissive. La logique de visibilité et de sécurité reste côté serveur.

### Interactions

Définir un contrat commun pour aimer, commenter, enregistrer, partager, signaler et compter les interactions. Préserver la compatibilité avec les interactions vidéo existantes durant la transition. Les commentaires doivent pointer vers un contenu canonique, et non être limités à une vidéo.

### Stockage et sécurité

- Photos et images d'album dans Supabase Storage avec règles RLS et chemins par utilisateur/contenu.
- Validation du type MIME, taille, dimensions et nombre maximal d'images côté serveur.
- URLs signées ou publiques selon la visibilité réelle ; ne jamais exposer un contenu privé via un bucket public.
- Modération des textes et médias avant diffusion publique selon la politique produit.
- Nettoyage des médias orphelins en cas d'annulation ou d'échec de publication.
- Ne jamais faire croire qu'une publication est réussie avant confirmation du stockage et de l'enregistrement serveur.

## État constaté dans le dépôt (18 novembre 2026)

- `src/pages/Index.tsx` affiche actuellement un flux de vidéos, avec « Pour toi » et « Abonnements ».
- `src/hooks/useFeed.ts` appelle le RPC `get_feed`, qui retourne des lignes de `public.videos`.
- `src/components/video/VideoCard.tsx` est un lecteur et composant d'interaction vidéo.
- `src/pages/Create.tsx` propose capture vidéo/photo et import d'un fichier image ou vidéo.
- `src/components/create/PostEditor.tsx` gère actuellement la description et les réglages, mais son `handlePost` simule l'envoi avec un délai et un toast. Ce parcours ne constitue donc pas une publication persistée fiable.
- Le schéma social actuel contient `public.videos` et des tables d'interaction spécialisées vidéo. Aucun modèle canonique complet de publications photo/album/texte n'a été confirmé dans les migrations examinées.

## Plan d'implémentation ordonné

### Étape 0 — Contrats et audit
- Cartographier les tables, RPC, buckets, RLS, types et composants réellement utilisés.
- Vérifier le pipeline Cloudflare vidéo et les flux d'import déjà opérationnels.
- Fixer les limites de taille/nombre/dimensions des photos et albums.
- Documenter le contrat TypeScript discriminé et les règles de classement.

### Étape 1 — Fondation de données
- Ajouter le modèle canonique et les médias ordonnés par migration additive.
- Ajouter RLS, index, contraintes, fonctions de publication et de lecture sécurisées.
- Prévoir une migration réversible/compatible et une stratégie de liaison des vidéos existantes.
- Ne supprimer aucune table vidéo existante dans cette étape.

### Étape 2 — Publication réelle
- Remplacer la simulation de `PostEditor.handlePost` par une publication persistée.
- Construire les parcours photo, album et texte.
- Gérer chargement, progression, annulation, reprise/erreur et nettoyage des fichiers.
- Confirmer la réussite uniquement après validation serveur.

### Étape 3 — Fil mixte
- Ajouter le RPC du fil mixte et ses types.
- Ajouter un `ContentFeedItem` discriminé et des composants de rendu par format.
- Garder le lecteur vidéo existant comme rendu du type vidéo.
- Ajouter les rendus photo, carrousel et texte dans le même défilement vertical.

### Étape 4 — Interactions et profils
- Unifier progressivement likes, commentaires, favoris, partages, signalements et compteurs.
- Ajouter les filtres de profil par format.
- Vérifier les notifications et les liens de partage pour chaque type.

### Étape 5 — Qualité et activation
- Tests RLS et SQL, tests de publication par format, pagination et modération.
- Tests mobile/tablette/ordinateur et vérification des overlays.
- Activer progressivement via feature flag si nécessaire.
- Vérifier les données staging avant toute activation production.

## Critères d'acceptation

- Une vidéo existante continue à être lue et à recevoir likes/commentaires/partages comme avant.
- Un utilisateur peut publier une photo, un album et un texte, puis retrouver le contenu après rechargement.
- Les quatre formats peuvent apparaître dans « Pour toi » et « Abonnements ».
- Le fil reste vertical et immersif sur les trois classes d'appareils.
- Les albums respectent leur ordre et permettent de passer d'une image à l'autre.
- Les contenus privés, bloqués, non modérés ou dont les médias ne sont pas prêts ne sont jamais exposés.
- Les pages profil peuvent filtrer par format sans modifier la logique du fil d'accueil.
- Les erreurs réseau/stockage ne génèrent ni faux succès ni publications fantômes.

## Hors périmètre de cette architecture

Cette architecture ne demande pas de copier Facebook, ni de remplacer le fil d'accueil par une grille, ni de retirer les fonctions vidéo de type TikTok. Elle ne suppose pas non plus que toutes les fonctions de découverte, commerce ou communauté soient livrées dans la même migration.
