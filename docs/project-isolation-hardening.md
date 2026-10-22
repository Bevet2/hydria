# Hydria OS — prévention des fuites inter-profils (lot 1)

Ce correctif vise les chemins de **liste des projets et des work objects**, sans prétendre mettre en place une authentification multi-utilisateur complète.

## Risques reproduits et corrigés

1. `WorkObjectService.listForProject` revenait à une requête globale quand un utilisateur n'avait pas de document dans le projet demandé. Cela pouvait divulguer les objets privés d'un autre profil.
2. Un `userId` explicitement fourni mais invalide (`0`, négatif, `NaN` ou texte) était interprété comme une absence de filtre dans plusieurs consultations. Désormais, une identité fournie mais invalide retourne une liste vide ou aucun projet.
3. `ProjectStore.ensureProject` pouvait associer deux utilisateurs distincts au même projet simplement parce qu'ils avaient choisi le même nom (sans `conversationId`). La recherche de projets existants respecte maintenant le propriétaire explicite.
4. Les objets explicitement partagés restent visibles au destinataire dans la navigation du projet, sans ajouter les objets privés de son propriétaire.

Le contrôle `npm run gate:project-isolation --prefix backend` reproduit des projets réels dans un répertoire temporaire. Il compare l'accès du propriétaire, d'un destinataire du partage et d'un tiers non autorisé. Le gate est appelé dans le workflow d'intégration GitHub.

## Limites de sécurité — ne pas déclarer le mode multi-utilisateur prêt

- `userId` vient toujours de données fournies par le client sur plusieurs routes. Le serveur n'a **pas encore de session utilisateur fiable** qui atteste cet identifiant.
- Certaines consultations non scindées (`userId` réellement absent) restent accessibles au propriétaire du **pilote privé** pour compatibilité. Ce mode ne doit pas être exposé comme un service multi-utilisateur.
- Les chemins `GET /api/work-objects/:id`, assets natifs de Drive, liens partagés, conversation/chat, agents et CRM nécessitent une revue d'autorisation systématique.
- La prochaine étape est la création d'identités, sessions et organisations serveur, puis le remplacement de tous les identifiants clients par le principal authentifié, avec tests HTTP de lecture/écriture croisée.
