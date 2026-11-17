# PHASE 06 — MESSAGERIE ET LIVES

**Priorité :** élevée.  
**Prérequis :** phases 01 à 05.

## Objectif
Fiabiliser conversations privées, messages texte/média, présence, frappe, transport RTC, chat live, réactions et cadeaux.

## Chantiers
- verrouiller les deux participants d'une conversation et les règles d'accès ;
- appliquer who_can_message, compte privé, blocage et restrictions ;
- définir stockage sécurisé des médias et règles de suppression ;
- fiabiliser unread/read, ordre des messages, retries et realtime ;
- maintenir Agora token côté serveur, renouvellement et fermeture session ;
- persister chat live et réactions via un modèle choisi ;
- connecter cadeaux à un débit coins et crédit créateur atomiques ;
- traiter signalement et modération en direct.

## Tests
conversation tierce, participant modifié, compte bloqué, message média, doublon réseau, reconnexion Realtime, host/audience, token expiré, live privé/followers, cadeau sans solde.

## Critères de sortie
Messagerie isolée, règles de confidentialité appliquées, live stable et aucune action financière locale.
