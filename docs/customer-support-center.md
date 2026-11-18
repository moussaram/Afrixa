# Centre de support client Afrixa

## Parcours utilisateur
La page `/help-support` centralise la FAQ, les domaines d'assistance, la création d'un ticket et l'historique des dix dernières demandes. La création d'un ticket exige une session authentifiée.

Chaque demande contient :
- un domaine et un sujet précis ;
- un objet et une description ;
- une priorité déclarée par l'utilisateur ;
- une référence facultative de commande ou de transaction ;
- une adresse e-mail de contact facultative ;
- un numéro de suivi généré côté base de données.

Les domaines couverts sont : marketplace et achats, paiements et remboursements, livraison, produits numériques, boutiques et vendeurs, droits d'auteur et propriété intellectuelle, sécurité et signalements, compte et accès, contenus et modération, Live, messagerie, créateurs et retraits, publicité, problèmes techniques et demandes générales.

## File de traitement
La page `/admin/support` est réservée aux administrateurs enregistrés dans `platform_admins`. Elle permet de :
- consulter et filtrer les tickets ;
- traiter les priorités urgentes et élevées avant les autres ;
- prendre en charge un ticket ;
- répondre au demandeur ;
- passer le ticket en cours, en attente du client, résolu ou clôturé.

Le bouton « Support client » est accessible depuis la page de modération.

## Statuts
- `new` : ticket reçu ;
- `in_progress` : prise en charge ;
- `waiting_customer` : une information est attendue du demandeur ;
- `resolved` : solution communiquée ;
- `closed` : traitement clôturé.

Les anciens statuts `non_lu` et `lu` sont convertis en `new` pendant la migration.

## Sécurité et traçabilité
- Les utilisateurs authentifiés peuvent créer un ticket et lire uniquement leurs propres tickets.
- Les administrateurs de la plateforme peuvent lire et mettre à jour la file.
- Les utilisateurs ne peuvent pas modifier une demande après son envoi ni écrire une réponse administrateur.
- Les numéros de ticket sont générés côté base, jamais choisis par le navigateur.
- Les changements de statut et réponses sont inscrits dans `support_message_events`, sans dupliquer le contenu privé des messages.
- Une notification in-app est créée quand le support répond.
- Les messages demandent explicitement de ne jamais communiquer mot de passe, OTP ou PIN.

## Exploitation à finaliser avant production
1. Appliquer la migration en staging puis vérifier les politiques RLS avec un compte demandeur, un autre utilisateur et un administrateur.
2. Vérifier la réception des notifications sur les appareils et navigateurs concernés.
3. Définir l'équipe responsable, les horaires, les délais de réponse réellement tenables et les procédures d'escalade.
4. Ajouter ultérieurement un stockage privé des pièces jointes avec contrôle de type, taille, antivirus et liens signés temporaires.
5. Brancher les canaux externes (WhatsApp Business, e-mail transactionnel ou téléphone) uniquement après validation des coordonnées officielles et des secrets serveur.

Aucun délai de résolution n'est promis automatiquement par l'interface. Le délai affiché devra être configuré selon les capacités réelles de l'équipe.
