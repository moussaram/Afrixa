# Afrixa Delivery — spécification d'intégration OuiGoo

**Source principale :** documentation officielle OuiGoo API  
https://ouigoo.gitbook.io/ouigoo/introduction/ouigoo-api  
**Page officielle complémentaire :** https://ouigoo.co/  
**Date de consultation :** 7 novembre 2026  
**Statut :** faisabilité documentaire positive, contrat technique détaillé à confirmer

## 1. Conclusion

OuiGoo présente une API REST officielle pour créer des expéditions, les suivre de la collecte à la livraison et connecter une plateforme à son réseau de livreurs. Le site officiel OuiGoo mentionne le Bénin parmi les pays où le service est présent et indique que les marchands peuvent intégrer le service par API REST.

L'intégration est donc une piste réaliste pour Afrixa au Bénin. Cela ne prouve toutefois ni l'activation d'un compte marchand Afrixa, ni la couverture de chaque adresse à Cotonou, ni l'obtention de clés, ni les modalités commerciales propres à Afrixa.

La page d'introduction officielle est accessible et confirme plusieurs conventions. Les pages détaillées de ressources liées (shipments, deliveries, drivers) n'ont pas pu être récupérées dans cette consultation. Les endpoints, payloads exacts, champs obligatoires, événements et règles d'annulation restent à confirmer dans la documentation complète et avec OuiGoo avant tout développement.

## 2. Faits confirmés par la page officielle d'introduction

La documentation officielle indique :

- API REST sur HTTPS.
- Base URL : https://api.business.ouigoo.co
- Corps et réponses JSON.
- Authentification par Authorization: Bearer <api-key>.
- Une clé par entreprise.
- Dates ISO 8601 en UTC.
- Pagination page à partir de 1, limit jusqu'à 100.
- Enveloppe standard de réponse : success et data.
- Codes HTTP standard accompagnés d'un message lisible.
- Objet Shipment : colis entre un point de collecte et un destinataire, créé par le marchand.
- Objet Delivery : tournée réelle du livreur ; OuiGoo construit les tournées et Afrixa les consulte.
- Driver : livreur invité sur le compte du marchand, auquel un colis peut être affecté directement.
- productReference : référence permettant de rattacher un envoi OuiGoo à la commande Afrixa.
- Webhooks signés pour recevoir les changements d'état au lieu d'interroger continuellement l'API.

Ces éléments sont documentés à la page d'introduction. Ne pas déduire des détails non exposés par cette page.

## 3. Couverture géographique

Le site OuiGoo présente le Bénin dans la liste des pays opérés. Il décrit le retrait au point de départ, la livraison au destinataire et le suivi en temps réel. Il indique que les tarifs commencent à partir de 500 FCFA et varient selon la destination et le poids.

Ce tarif « à partir de » n'est pas un tarif de commande Afrixa. Aucun montant ne doit être affiché au client sans demande de prix réelle ou grille tarifaire contractuelle et à jour.

À confirmer avec OuiGoo :
- couverture de Cotonou par quartier et coordonnées GPS ;
- couverture hors Cotonou ;
- zones exclues et limites de distance ;
- adresse de collecte par boutique ;
- poids et dimensions acceptés ;
- délais réels et fenêtres de collecte ;
- éventuelles restrictions par catégorie de produit.

## 4. Authentification et environnements

### Confirmé

- HTTPS.
- Clé API par entreprise.
- Header Authorization: Bearer.
- API key à conserver côté serveur uniquement.

### À confirmer

- procédure de création de compte marchand ;
- clés distinctes production/test ;
- existence d'un environnement sandbox ;
- rotation/révocation des clés ;
- scopes et permissions ;
- quotas et limites de débit ;
- délais de timeout recommandés ;
- politique de réessai ;
- restrictions IP éventuelles.

Ne jamais coder la clé dans le frontend Vite ni dans une variable VITE_*.

## 5. Objets et responsabilités

### Shipment

Afrixa crée une ressource d'expédition pour un colis. L'objet représente le colis, pas nécessairement un trajet individuel du livreur.

### Delivery

La documentation précise qu'une Delivery correspond à une course réelle et que plusieurs colis proches peuvent être regroupés. Afrixa doit donc stocker séparément :
- son identifiant de livraison interne ;
- l'identifiant shipment OuiGoo ;
- la référence externe ;
- éventuellement l'identifiant delivery/run lorsqu'il est disponible.

Ne pas supposer une relation 1 commande = 1 course. Plusieurs shipments peuvent partager une tournée.

### Driver

La documentation évoque un livreur invité sur le compte marchand et l'affectation directe. Cette capacité doit être évaluée comme option avancée, pas comme prérequis du premier lancement.

## 6. Données métier à préparer

Le contrat API complet doit confirmer le nom et le format des champs. Au niveau Afrixa, préparer les données suivantes sans supposer qu'elles sont toutes obligatoires côté OuiGoo :

### Collecte
- nom commercial du vendeur ;
- nom et téléphone du contact de collecte ;
- adresse lisible ;
- latitude et longitude ;
- instructions d'accès ;
- créneau souhaité ;
- référence boutique.

### Destinataire
- nom ;
- téléphone au format international ;
- adresse lisible ;
- latitude et longitude ;
- instructions complémentaires.

### Colis
- référence commande Afrixa ;
- productReference unique ;
- description non sensible ;
- nombre de colis ;
- poids et dimensions si requis ;
- valeur déclarée si le contrat la demande ;
- instructions de manutention si prises en charge.

Ne transmettre que les informations nécessaires à la livraison.

## 7. Tarification et création d'expédition

Le site officiel OuiGoo indique que les frais varient selon destination et poids et que le marchand peut connecter son système à la plateforme. La page d'introduction confirme la capacité de tarification, mais les endpoints et paramètres précis n'ont pas été vérifiés.

Architecture proposée :
1. Le frontend demande les options de livraison à Afrixa.
2. Le backend valide adresse, colis, zone et mode.
3. L'adaptateur OuiGoo interroge le tarif si l'API le permet.
4. Afrixa stocke un devis avec expiration et détail.
5. Le client confirme le mode et le total.
6. Après validation métier et paiement selon les règles convenues, le backend crée le shipment.
7. Afrixa conserve la réponse externe et la référence productReference.

Le prix confirmé au checkout doit être figé dans le snapshot de commande. Si le devis expire ou change, le client doit reconfirmer le nouveau total.

## 8. Suivi et webhooks

La documentation d'introduction annonce des événements de changement d'état envoyés vers un endpoint marchand et précise qu'ils sont signés.

À confirmer dans la documentation détaillée :
- algorithme et en-têtes de signature ;
- secret utilisé ;
- fenêtre de validité du timestamp ;
- identifiant d'événement ;
- politique de retries ;
- format du corps ;
- liste exhaustive des états ;
- événements de collecte, assignation, pickup, transit, livraison, échec, retour ;
- présence d'une URL de suivi publique ;
- preuve de livraison et données associées.

Conception de réception :
- endpoint Edge Function dédié ;
- vérification cryptographique de la signature avant traitement ;
- journal brut expurgé des données personnelles inutiles ;
- clé d'idempotence sur l'identifiant d'événement ;
- validation de la référence shipment ;
- transition d'état autorisée uniquement ;
- accusé de réception rapide ;
- traitement asynchrone si nécessaire.

Ne jamais marquer une commande comme livrée sur la seule réponse de création d'expédition.

## 9. Annulation, retours et erreurs

Les possibilités d'annulation et de retour ne sont pas confirmées par la page d'introduction consultée. Le site OuiGoo évoque une gestion des retours pour marchands, mais les conditions et endpoints précis restent à vérifier.

Avant développement, demander :
- endpoint d'annulation ;
- conditions avant/après affectation du livreur ;
- frais d'annulation ;
- traitement des colis non remis ;
- procédure de retour ;
- statuts d'échec ;
- codes d'erreur ;
- comportement en cas de référence dupliquée ;
- délai de disponibilité d'un statut final.

## 10. Interface commune Afrixa

L'adaptateur doit implémenter un contrat interne, sans exposer le format OuiGoo au reste de l'application :

- checkAvailability(request)
- quote(request)
- createShipment(request, idempotencyKey)
- getShipment(externalId)
- cancelShipment(externalId, reason)
- verifyWebhook(headers, rawBody)
- normalizeStatus(providerPayload)

Ces noms sont des propositions d'architecture Afrixa, pas des endpoints OuiGoo.

Toutes les capacités non prises en charge doivent être déclarées comme non supportées, jamais simulées.

## 11. Conditions préalables avant P4

1. Accès marchand OuiGoo Afrixa confirmé.
2. Clé API fournie par un canal sécurisé.
3. Documentation complète des endpoints consultée.
4. Sandbox ou stratégie de tests non facturante confirmée.
5. Couverture des zones ciblées confirmée.
6. Champs d'adresse, colis et contact confirmés.
7. Webhook signé et procédure de vérification documentés.
8. Tarifs, annulations et retours contractuellement compris.
9. Accord sur les données personnelles transmises.
10. Tests d'intégration autorisés.

## 12. Sources

- OuiGoo API Introduction : https://ouigoo.gitbook.io/ouigoo/introduction/ouigoo-api
- Site officiel OuiGoo : https://ouigoo.co/
- Extension officielle listée sur WordPress.org : https://wordpress.org/plugins/ouigoo-delivery/ — source secondaire utile pour comprendre l'écosystème plugin, à ne pas substituer à la documentation API.
- Shopify App Store : https://apps.shopify.com/ouigoo — éléments descriptifs marchands, non contractuels.

**Réserve documentaire :** ne pas écrire les requêtes d'intégration réelles avant récupération des pages détaillées shipments, deliveries, drivers et webhooks auprès de la documentation officielle OuiGoo.
