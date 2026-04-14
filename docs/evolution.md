# Evolution Loop V1

Hydria dispose d'une boucle d'amelioration controlee.

## Fichiers

- `backend/src/evolution/evolution.strategy.js`
- `backend/src/evolution/evolution.loop.js`
- `backend/src/evolution/evolution.optimizer.js`
- `backend/src/evolution/evolution.agent-feedback.js`
- `backend/src/evolution/evolution.strategy-feedback.js`

## Flow

1. execution initiale
2. critique
3. si le score est faible
4. choix d'une strategie alternative explicite
5. nouvelle tentative
6. comparaison avec le meilleur resultat courant
7. si utile, nouvelles strategies dans la limite des retries
8. benchmark
9. conservation du meilleur resultat
10. memorisation de la strategie gagnante ou des retries faibles

## Garde-fous

- max retries borne
- max retries limite a 3 par defaut
- pas d'auto-modification du core
- strategies explicites
- aucune action dangereuse implicite
- comparaison inter-tentatives avant adoption

## Integration reelle

- la boucle s'appuie sur les evals heuristiques existantes
- les retries sont traces dans l'etat runtime
- la meilleure strategie est stockee en memoire long terme
- les retries faibles peuvent etre memorises comme `error_pattern`
- les domaines gardent maintenant un feedback structure sur les agents et strategies qui performent le mieux
