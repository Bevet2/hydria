# Evals V2

Hydria evalue maintenant les executions avec un scorer plus propre et un benchmark simple.

## Fichiers

- `backend/src/evals/HeuristicEvaluator.js`
- `backend/src/evals/eval.scorer.js`
- `backend/src/evals/eval.benchmark.js`
- `backend/src/evals/eval.domainBenchmark.js`
- `backend/scripts/domainBenchmarkEval.mjs`

## Capacites

- scoring multi-criteres
- dimensions explicites
- journal de performance
- comparaison baseline vs retry
- benchmark automatique par domaine
- export JSON des resultats et deltas entre runs
- penalites explicites sur:
  - hallucination
  - reponse vague
  - manque de structure
  - reponse trop courte / trop longue
  - sur-notation `simple_chat`, `reasoning` et `coding_ui`
- score composite:
  - factuality
  - clarity
  - usefulness
  - structure
  - brevity
  - executionQuality
  - identity

## Lancement

- `npm run eval:agentic-smoke`
- `npm run eval:domains`

Les resultats domaine sont ecrits dans `data/test-results/domain-benchmark-latest.json`.

## Controle `simple_chat`

- les prompts qui demandent ce qu'est Hydria sont maintenant verifies explicitement
- une mauvaise description du produit declenche `identity_mismatch`
- une description correcte renforce le score via `identity_grounded`
- les reponses trop mecaniques ou trop creuses sont plus severement penalisees

## Controle `data_lookup` et `browser`

- les reponses factuelles courtes et correctement sourcees ne sont plus penalisees comme si elles etaient incomplètes
- les prompts navigateur doivent maintenant remonter des elements visibles explicites:
  - titre
  - liens ou absence de liens
  - controles visibles si utile
