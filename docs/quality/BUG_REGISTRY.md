# Registre central des bugs Afrixa

Ce registre reprend les identifiants du document d'audit. Le statut reste **à corriger** tant qu'une preuve automatisée ou un scénario manuel documenté n'a pas validé le correctif. Les corrections déjà présentes sur `main` ou dans des PR ouvertes doivent être revérifiées avant clôture.

| ID | Module | Fichier / zone | Gravité | Correction attendue | Validation attendue | Statut |
|---|---|---|---|---|---|---|
| FIN-01 | Paiements | AfrixaPaySheet.tsx | Critique | Retirer toute confirmation temporisée sans transaction confirmée | Paiement réel + webhook | À corriger |
| FIN-02 | Paiements | useAfrixaPayment.ts | Critique | Déplacer la création de commande côté serveur | Test checkout serveur | À corriger |
| FIN-03 | Paiements | useAfrixaPayment.ts | Critique | Calculer prix et commissions depuis la base côté serveur | Prix altéré côté client rejeté | À corriger |
| FIN-04 | Finance | SellerWallet.tsx | Critique | Calculer les soldes depuis le registre financier | Rapprochement des écritures | À corriger |
| FIN-05 | Finance | SellerWallet.tsx | Critique | Implémenter les retraits sécurisés | Réservation, succès, échec, rejet | À corriger |
| FIN-06 | Finance | SellerWallet.tsx | Critique | Ajouter le relevé comptable complet | Historique exhaustif et cohérent | À corriger |
| FIN-07 | Finance | Marketplace / Finance | Critique | Compléter remboursements et litiges | Parcours de litige de bout en bout | À corriger |
| MKT-01 | Marketplace | MarketplaceContent.tsx | Critique | Remplacer le catalogue fictif par les données persistées | Catalogue réel paginé | À corriger |
| MKT-02 | Marketplace | MarketplaceContent.tsx | Critique | Charger les vraies boutiques | Boutiques réelles et états vides | À corriger |
| MKT-03 | Marketplace | MarketplaceContent.tsx | Critique | Charger les vidéos commerciales réelles | Vidéos réelles et permissions | À corriger |
| MKT-04 | Commandes | Orders.tsx | Critique | Charger les commandes de l'acheteur | Deux comptes et commandes réelles | À corriger |
| MKT-05 | Commandes | OrderDetail.tsx | Critique | Charger le détail et l'historique persistants | Rechargement sans perte d'état | À corriger |
| MKT-06 | Commandes | OrderDetail.tsx | Critique | Confirmer la réception côté serveur | Test d'autorisation et séquestre | À corriger |
| MKT-07 | Litiges | OrderDetail.tsx | Critique | Créer le workflow serveur de litige | Motif, preuves, décision, historique | À corriger |
| MKT-08 | Avis | OrderDetail.tsx | Critique | Enregistrer les avis après livraison uniquement | Avis refusé avant livraison | À corriger |
| MKT-09 | Achats groupés | GroupBuyList.tsx | Critique | Connecter participants et prix réels | Participants persistés | À corriger |
| MKT-10 | Boutique vendeur | MyShop.tsx | Critique | Supprimer les fallbacks fictifs | États vide/erreur réels | À corriger |
| DEL-01 | Livraison | YangoDeliveryStep.tsx | Élevée | Vérifier l'existence d'une API partenaire officielle Yango | Preuve fournisseur ou lien externe explicite | À corriger |
| DEL-02 | Livraison | Intégration OuiGoo | Élevée | Intégrer l'API officielle avec accès fournis | Devis, création, suivi, annulation, webhook | À corriger |
| DEL-03 | Livraison | Backend livraison | Élevée | Créer le modèle central transporteurs/expéditions | Tests des trois modes | À corriger |
| DEL-04 | Livraison | Backend livraison | Élevée | Gérer statuts et événements côté serveur | Webhooks signés et transitions valides | À corriger |
| DEL-05 | Livraison | Preuves de livraison | Élevée | Stockage privé et confirmation acheteur sécurisée | Accès non autorisé refusé | À corriger |
| DEL-06 | Livraison | Livraison vendeur | Élevée | Finaliser zones, tarifs, délais et retrait | Parcours vendeur-acheteur | À corriger |
| SOC-01 | Social | Discover | Élevée | Remplacer vidéos et utilisateurs fictifs | Aucun mock dans le parcours | À corriger |
| SOC-02 | Social | Discover / défis | Élevée | Calculer les statistiques depuis la base | Statistiques rapprochées | À corriger |
| SOC-03 | Social | Spotlight | Élevée | Charger créateurs et vidéos réels | Données réelles et RLS | À corriger |
| SOC-04 | Création | Studio créateur | Élevée | Persister les brouillons | Brouillon disponible après reconnexion | À corriger |
| SOC-05 | Social | Historique d'activité | Élevée | Utiliser les événements réels | Historique multi-session | À corriger |
| SOC-06 | Vidéos hors ligne | OfflineVideos.tsx | Élevée | Implémenter le téléchargement ou retirer l'option | Test hors ligne réel | À corriger |
| SOC-07 | Notifications | Notifications.tsx | Élevée | Effectuer le suivi via l'opération serveur | Suivi persistant entre comptes | À corriger |
| SOC-08 | Confidentialité | Fil, profil, recherche, commentaires, lives, messages | Élevée | Harmoniser visibilité, comptes privés et blocages | Matrice RLS multi-comptes | À corriger |
| SOC-09 | Notifications | Tables / Realtime | Élevée | Réconcilier triggers et événements Realtime | Pas de doublon/perte d'événement | À corriger |
| SEC-01 | Authentification | AuthContext.tsx | Critique | Supprimer utilisateur/session/profil fictifs | Aucun compte mock en développement | À corriger |
| SEC-02 | Confidentialité | AuthContext.tsx | Critique | Remplacer select('*') par colonnes explicites | Test du payload autorisé | À corriger |
| SEC-03 | Authentification | AuthContext.tsx | Critique | Remonter erreurs, retry et finalisation profil | Scénarios erreur/profil absent | À corriger |
| SEC-04 | Confidentialité | Profils publics/privés | Critique | Harmoniser accès et RLS | Matrice propriétaire/tiers/anonyme | À corriger |
| SEC-05 | Confidentialité | Composants accédant à profiles | Critique | Retirer accès direct à la table privée | Recherche statique + tests RLS | À corriger |
| SEC-06 | Sécurité backend | Fonctions privilégiées | Critique | Exiger autorisation explicite | Appel anonyme/utilisateur refusé | À corriger |
| ADM-01 | Administration | Actions de modération | Élevée | Vérifier le rôle admin côté serveur | Utilisateur ordinaire refusé | À corriger |
| ADM-02 | Modération | Historique des décisions | Élevée | Conserver un journal non modifiable | Historique vérifiable | À corriger |
| ADM-03 | Modération | Signalements | Élevée | Implémenter le cycle complet des signalements | Reçu, examen, décision, appel | À corriger |
| ADM-04 | Modération | Modules serveur | Élevée | Appliquer les sanctions sur tous les modules | Compte sanctionné bloqué partout | À corriger |
| ADM-05 | Administration | Actions sensibles | Élevée | Journaliser les actions administratives | Trace d'audit vérifiable | À corriger |
| PREMIUM-01 | Premium | Premium.tsx | Critique | Plans, prix, souscription, renouvellement/expiration et droits serveur | Souscription staging et accès contrôlé | À corriger |
| ADS-01 | Publicité | AdsManager.tsx | Critique | Campagnes, budget, facturation et métriques serveur | Campagne financée et métriques vérifiables | À corriger |
| COIN-01 | Coins | Coins / cadeaux / portefeuille | Critique | Garantir la cohérence des soldes | Rapprochement du registre | À corriger |
| COIN-02 | Coins | Webhooks et transactions | Critique | Remboursement après échec et idempotence | Webhook rejoué sans double crédit | À corriger |
| COIN-03 | Monétisation | Retraits / vues | Critique | Plafonds, vues éligibles, rapprochement FedaPay et commissions | Tests limites et rapprochement | À corriger |
| DB-01 | Base de données | Schéma et migrations | Élevée | Réconcilier modèles historiques et récents | Migration vierge/existante | À corriger |
| DB-02 | Base de données | src/integrations/supabase/types.ts | Élevée | Générer les types depuis le schéma réel | CI sans dérive de types | À corriger |
| DB-03 | Base de données | supabase/migrations | Élevée | Tester migrations vierge et existante | Deux scénarios reproductibles | À corriger |
| DB-04 | Base de données | Relations/index/triggers | Élevée | Auditer contraintes et index | Tests SQL et plan de requêtes | À corriger |
| DB-05 | Sécurité DB | Politiques RLS | Critique | Tester les rôles et comptes multiples | Matrice propriétaire/tiers/bloqué/abonné/admin/anonyme | À corriger |
| PERF-01 | Performance | calculate-scores | Élevée | Éviter la double boucle utilisateurs × vidéos | Test volumétrique | À corriger |
| PERF-02 | Performance | calculate-scores | Élevée | Supprimer la limite fixe de 500 vidéos | Test au-delà de 500 vidéos | À corriger |
| PERF-03 | Performance | Pagination / Realtime | Élevée | Tester sous charge | Test de charge documenté | À corriger |
| PERF-04 | Sécurité backend | Tâches privilégiées | Critique | Réserver les tâches aux appels autorisés | Appel utilisateur ordinaire refusé | À corriger |

## Décisions et dépendances externes

- Accès anonyme aux vidéos publiques : décision produit requise avant modification de la politique.
- Renouvellement Premium : paiement récurrent ou manuel à confirmer selon les capacités du prestataire.
- Vidéos hors ligne : construire le téléchargement ou retirer temporairement la fonction.
- FedaPay sandbox, OuiGoo et API partenaire Yango : intégrations bloquées tant que les accès et confirmations officielles ne sont pas fournis.
