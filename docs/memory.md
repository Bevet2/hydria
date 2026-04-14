# Memory V2

La memoire agentique locale suit maintenant quatre axes:

- short-term
- mid-term
- long-term
- task outcomes / error memories

## Fichiers

- `backend/src/memory/JsonMemoryStore.js`
- `backend/src/memory/memory.consolidation.js`
- `backend/src/memory/memory.history.js`

## Capacites

- consolidation automatique du court terme vers le moyen terme
- memorisation des succes
- memorisation des erreurs
- rappel des patterns deja vus
- reinjection dans le contexte agentique
