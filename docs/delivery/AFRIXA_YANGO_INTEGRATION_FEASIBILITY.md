# Afrixa Delivery — faisabilité Yango au Bénin

**Date de recherche :** 7 novembre 2026  
**Périmètre :** Yango Delivery B2B, API de livraison de colis, Bénin et Cotonou  
**Statut :** API B2B existante dans certains marchés ; disponibilité au Bénin non confirmée

## 1. Conclusion exécutive

Il existe bien une offre officielle Yango Delivery for Business destinée aux entreprises et proposant des services de livraison, suivi et intégration. Cependant, la page officielle globale présente actuellement, pour l'Afrique, les pays suivants : Côte d'Ivoire, Ghana, Sénégal et Zambie. Le Bénin n'apparaît pas dans cette liste.

La documentation juridique officielle consultée pour le service de livraison en Côte d'Ivoire définit une zone de service autour d'Abidjan. Elle confirme l'existence d'une plateforme B2B avec API, mais le contrat et la zone de service sont explicitement ivoiriens. Cela ne démontre pas une disponibilité au Bénin ou à Cotonou.

Un portail Yango Partners existe pour le Bénin, mais il concerne les partenaires de flotte/chauffeurs et ne prouve pas l'existence d'une API de livraison de colis pour une marketplace comme Afrixa.

**Décision recommandée : Yango doit rester un fournisseur conditionnel, désactivé pour le Bénin tant qu'un accord B2B et une confirmation écrite de couverture/API ne sont pas obtenus.**

## 2. Ce qui est confirmé par les sources officielles

### Yango Delivery for Business

Page officielle : https://delivery.yango.com/

Elle :
- présente une offre destinée aux personnes morales ;
- liste des régions et pays ;
- affiche pour l'Afrique : Côte d'Ivoire, Ghana, Sénégal, Zambie ;
- décrit des services express, same-day, programmés, next-day et reverse delivery ;
- indique que les destinataires peuvent suivre les coursiers en temps réel et recevoir des notifications ;
- mentionne des tableaux de bord pour les entreprises.

Le Bénin ne figure pas dans la liste des marchés affichés au moment de la consultation.

### Contrat officiel Côte d'Ivoire

Sources :
- https://yango.com/legal/delivery_dsa_ivory_coast/
- https://yango.com/legal/delivery_dsa_ivory_coast/fr/

Le contrat :
- décrit un service professionnel de livraison de colis ;
- définit une plateforme comprenant des API, SDK et interfaces ;
- prévoit une relation contractuelle avec une entreprise ;
- définit la zone de service comme Abidjan et ses environs, avec extension éventuelle ;
- précise que les dimensions et le poids des colis sont convenus entre les parties ;
- identifie les informations personnelles telles que téléphone, email et itinéraires.

Ce contrat concerne la Côte d'Ivoire, pas le Bénin. Il ne doit pas être utilisé comme preuve d'éligibilité d'Afrixa.

### Portail partenaires Bénin

https://pro-partners.yango.com/en-bj

Ce portail est consacré aux partenaires de flotte. Il ne s'agit pas d'une documentation d'API de livraison de colis. Sa présence ne valide donc ni les réservations B2B, ni les prix, ni les webhooks, ni le suivi de livraison pour Afrixa.

## 3. Attention aux produits Yango différents

Il ne faut pas confondre :

1. Application Yango destinée aux consommateurs pour commander des trajets.
2. API du widget de demande de trajet Yango.
3. Yango Delivery for Business pour les colis.
4. Portail partenaire de flotte/chauffeurs.
5. Yango Deli / livraison de repas ou commandes de partenaires.

La documentation du widget de trajet https://yango.com/en_int/partner-program/documentation/ concerne l'affichage du coût et du temps d'un trajet, puis la redirection de l'utilisateur vers Yango pour confirmer. Ce n'est pas une API de livraison de colis Afrixa.

Les offres Yango Deli et Vendor peuvent également prévoir des échanges API entre Yango et un restaurant partenaire, avec des exigences négociées par email. Elles ne démontrent pas une API de coursier à la demande ouverte à toute marketplace au Bénin.

## 4. État de faisabilité

| Fonction | État de preuve pour Afrixa au Bénin |
|---|---|
| Offre Yango Delivery B2B dans certains pays | Confirmée |
| API B2B dans l'écosystème Yango Delivery | Confirmée comme capacité contractuelle/plateforme |
| API publique self-service avec documentation complète pour le Bénin | Non confirmée |
| Couverture du Bénin | Non confirmée par la liste officielle consultée |
| Couverture Cotonou | Non confirmée |
| Compte partenaire Afrixa éligible | Non obtenu / non confirmé |
| Estimation de prix via API au Bénin | Non confirmée |
| Création de course via API au Bénin | Non confirmée |
| Tracking API/webhooks au Bénin | Non confirmé |
| Annulation API au Bénin | Non confirmée |
| Conditions commerciales Afrixa | Non obtenues |

## 5. Trois scénarios de décision

### Scénario A — API officiellement disponible et accès obtenu

Conditions :
- confirmation écrite de Yango couvrant le Bénin et Cotonou ;
- accord B2B signé ;
- documentation technique fournie ;
- identifiants de test et production séparés ;
- tarifs, frais d'annulation et SLA documentés ;
- méthodes d'estimation, création, suivi, annulation et événements connues.

Alors l'adaptateur Yango pourra être activé sur les seules zones contractuellement confirmées.

### Scénario B — API existante mais accès soumis à autorisation/partenariat

C'est le scénario de travail prudent à ce stade.

Afrixa contacte l'équipe Yango Delivery for Business et demande explicitement :
- disponibilité Bénin/Cotonou ;
- éligibilité d'une marketplace multi-vendeurs ;
- API de coursier à la demande, et non widget de trajet ;
- méthode d'onboarding ;
- docs d'intégration ;
- mécanisme de prix et de réservation ;
- tracking, webhooks et annulation ;
- conditions commerciales et traitement des données.

Tant que ces éléments ne sont pas obtenus, l'option Yango ne doit pas être affichée comme sélectionnable.

### Scénario C — API non disponible ou non vérifiable

Afrixa garde Yango désactivé dans la configuration globale et continue de proposer les modes effectivement disponibles : OuiGoo et livraison vendeur. Aucun lien vers l'application Yango ne doit être présenté comme une livraison Afrixa réservée.

## 6. Questions à adresser à Yango

1. Yango Delivery for Business opère-t-il actuellement au Bénin ?
2. Les livraisons de colis sont-elles disponibles à Cotonou ?
3. Une marketplace tierce enregistrée au Bénin peut-elle ouvrir un compte B2B ?
4. Existe-t-il une API officielle pour calculer un tarif et créer une course ?
5. Les points de collecte et de dépôt peuvent-ils être transmis par coordonnées GPS ?
6. Quels types, poids et dimensions de colis sont acceptés ?
7. Existe-t-il un environnement sandbox ?
8. Comment fonctionne l'authentification ?
9. Quels statuts et identifiants sont retournés ?
10. Existe-t-il des webhooks signés ou seulement du polling ?
11. Peut-on annuler une livraison ? Jusqu'à quel stade et à quel coût ?
12. Quels sont les frais, dépôts, facturation et conditions de paiement ?
13. Quelles données personnelles sont nécessaires et combien de temps sont-elles conservées ?
14. Quel support technique accompagne l'intégration ?

## 7. Architecture Afrixa en attendant

- Déclarer le provider YANGO comme provider configurable.
- État initial : unavailable / access_pending.
- Conserver les capacités API comme inconnues, pas comme activées.
- Ne pas coder d'endpoint supposé.
- Ne pas faire de scraping ni utiliser d'API non officielle.
- Ne pas utiliser l'API ride request pour simuler une réservation colis.
- Activer seulement après confirmation et tests contractuels.

## 8. Sources officielles consultées

- Yango Delivery for Business : https://delivery.yango.com/
- Contrat Yango Delivery Côte d'Ivoire (EN) : https://yango.com/legal/delivery_dsa_ivory_coast/
- Contrat Yango Delivery Côte d'Ivoire (FR) : https://yango.com/legal/delivery_dsa_ivory_coast/fr/
- Portail Yango Partners Bénin (partenaires de flotte) : https://pro-partners.yango.com/en-bj
- Documentation du widget de trajet Yango : https://yango.com/en_int/partner-program/documentation/
- Yango Deli services offer : https://yango.com/legal/deli_offer/en/

**Limite :** une recherche publique ne remplace pas une réponse contractuelle de Yango. L'absence du Bénin dans la page globale ne prouve pas une impossibilité définitive ; elle impose de traiter la disponibilité comme non confirmée.
