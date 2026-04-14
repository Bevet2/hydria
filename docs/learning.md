# Learning Loop

Hydria ajoute une couche `backend/src/learning` pour reutiliser ce qui marche au fil des taches.

## Modules

- `learning.types.js`
  - type `LearningItem`
  - categories et project types
- `learning.store.js`
  - store JSON local des learnings
  - recherche simple par recouvrement de tokens
  - mise a jour de `usageCount`, `successRate` et `contextStats`
- `learning.extractor.js`
  - extraction automatique apres execution, GitHub research et evolution
- `learning.reuse.js`
  - recuperation des learnings pertinents avant planification et execution
  - scoring contextuel par domaine / sous-domaine / type de tache
- `learning.contextStats.js`
  - stats de succes contextuelles (`domain`, `subdomain`, `taskType`)
- `learning.genericityScore.js`
  - penalite pour learnings trop vagues ou trop larges

## Types de learnings

- `pattern`
  - organisation ou structure reutilisable
- `template`
  - gabarit ou forme de livrable reutilisable
- `mistake`
  - erreur ou strategie a eviter
- `strategy`
  - enchainement d'etapes qui a bien fonctionne

## Internal vs external

- `external`
  - learnings extraits depuis GitHub ou un repo externe
  - Hydria ne garde que des patterns
- `internal`
  - learnings issus des taches Hydria
  - Hydria peut garder patterns, templates, strategies et mistakes

## Flow reel

1. `plannerAgent` cherche des learnings pertinents avant de finaliser le plan
2. `executorAgent` injecte les learnings reutilisables dans les etapes LLM
3. `gitAgent` utilise les learnings existants pour mieux lire et presenter les repos
4. `evolution.loop` enregistre les strategies gagnantes et les retries faibles
5. `HydriaAutonomousBrain` persiste les nouveaux learnings et met a jour les stats d'usage contextuelles

## Selection contextuelle

Hydria ne reutilise plus un learning uniquement parce qu'il a un bon `successRate` global.

La decision prend en compte :

- `domainMatch`
- `taskSubdomain`
- `taskType`
- `contextualSuccessRate`
- `genericityPenalty`
- `internal` vs `external`
- recence et utilite recente

Regle pratique :

- mieux vaut 1 ou 2 learnings tres pertinents
- un learning trop generique est penalise
- un learning interne est favorise pour une tache interne proche
- un pattern externe est favorise pour `github_research`

## Sorties observables

Les learnings sont exposes dans la reponse API via :

- `learningUsed`
- `learningCreated`
- `agentLoop.memory.learning`

Chaque learning reutilise peut exposer :

- `reuseReason`
- `domainMatch`
- `taskSubdomain`
- `taskType`
- `contextualScore`
- `contextualSuccessRate`
- `genericityPenalty`
- `projectAffinity`

Selon le type de tache, Hydria peut aussi mentionner un pattern ou une strategie reutilisee dans la reponse finale.

## Maintenance des learnings historiques

Hydria lance maintenant une maintenance progressive des learnings existants :

- `learning.audit.js`
  - detecte genericite, faible utilite, anciennete et mismatch de categorie
- `learning.cleanup.js`
  - downgrade, archive, disable ou recategorise sans suppression brutale
- `learning.migration.js`
  - execute cette maintenance au demarrage du cerveau agentique

Objectif :

- reduire le bruit historique
- conserver une trace des learnings faibles
- fiabiliser la reuse future
