# GitAgent

`GitAgent` ajoute une couche GitHub exploitable dans Hydria V2.

## Capacites

- rechercher des repositories pertinents
- normaliser une demande vague en requete GitHub exploitable
- filtrer par langage, stars minimum, recence et `archived=false`
- classer les repos avec un score local et des raisons explicites
- analyser la structure de 1 a 3 repos
- lire des fichiers cibles
- chercher du code
- extraire des patterns utiles
- suggerer une implementation pour Hydria avec une sortie deterministe plus fiable

## Modules

- `backend/src/integrations/github/github.client.js`
- `backend/src/integrations/github/github.query.js`
- `backend/src/integrations/github/github.search.js`
- `backend/src/integrations/github/github.discovery.js`
- `backend/src/integrations/github/github.ranking.js`
- `backend/src/integrations/github/github.repo.js`
- `backend/src/integrations/github/github.analysis.js`
- `backend/src/integrations/github/repoPatternExtractor.js`
- `backend/src/integrations/github/githubResearchPresenter.js`
- `backend/src/integrations/github/github.intent.js`
- `backend/src/agents/gitAgent.js`

## Tools exposes

- `search_github_repos`
- `search_github_code`
- `clone_repo`
- `read_repo_file`
- `analyze_repo`

## Notes

- fonctionne sans token, mais avec rate limits GitHub publics
- `GITHUB_TOKEN` ameliore la stabilite
- si l'API GitHub est rate-limitee, Hydria passe en fallback :
  - recherche web `site:github.com`
  - deduplication locale
  - clone shallow des 2-3 meilleurs repos
  - analyse locale deterministe de la structure et des patterns
- les clones sont confines dans le sandbox runtime
- le rendu final privilegie maintenant l'analyse heuristique locale plutot qu'une synthese LLM fragile
- les metadonnees inconnues en fallback sont affichees prudemment comme `stars n/a` au lieu d'inventer des signaux
- la reponse finale ne doit pas etre un dump GitHub :
  - le GitAgent nourrit la decision
  - la couche presentation transforme ensuite les repos et patterns retenus en recommandation concrete
  - les details internes restent dans la trace debug, pas dans la reponse utilisateur principale
