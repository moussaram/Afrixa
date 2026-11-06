# PHASE 04 — RÉSEAU SOCIAL

**Priorité :** élevée.  
**Prérequis :** phases 01 à 03.

## Objectif
Rendre follows, demandes privées, likes, favoris, commentaires, mentions, blocages et signalements persistants et cohérents.

## Chantiers
- remplacer timers simulés de `useSocialInteractions` et `useFollow` par opérations Supabase idempotentes ;
- déterminer une table canonique de commentaires ;
- synchroniser compteurs par triggers ou RPC atomiques ;
- relier follow_requests aux profils privés ;
- faire respecter blocage, sanctions et who_can_comment/who_can_message ;
- contrôler mentions et notifications générées ;
- supprimer les fallbacks mock uniquement après remplacement vérifié.

## Tests
double clic, requête concurrente, rollback UI, self-follow, compte privé, blocage, suppression commentaire, likes en temps réel, compteur exact et RLS.

## Critères de sortie
État social persistant, cohérent entre appareils, non falsifiable et protégé par RLS.
