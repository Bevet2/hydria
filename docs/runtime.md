# Runtime V2

Hydria dispose maintenant d'un runtime plus stateful et plus proche d'une base `phantom-like`.

## Fichiers

- `backend/src/runtime/runtime.state.js`
- `backend/src/runtime/runtime.session.js`
- `backend/src/runtime/runtime.permissions.js`
- `backend/src/runtime/runtime.browser.js`
- `backend/src/runtime/HydriaRuntimeAdapter.js`
- `backend/src/runtime/commandRunner.js`
- `backend/src/runtime/runtime.retry.js`
- `backend/src/runtime/runtime.recovery.js`
- `backend/src/runtime/runtime.rollback.js`
- `backend/src/runtime/runtime.failureClassifier.js`

## Capacites

- session d'execution persistante
- historique d'actions
- etat de tache persistant
- suivi des steps par `stepId`
- journal des erreurs
- journal des retries
- journal des recoveries
- journal des rollbacks
- permissions par tool
- allowlist de tools et d'actions navigateur
- sandbox basique
- runtime navigateur avec session locale
- actions navigateur: navigate, extract, links, click, fill, screenshot
- les inspections navigateur remontent aussi les controles visibles quand aucun lien n'est detecte
- retry simple pour les tools retryables
- classification simple des echecs runtime
- recovery state et rollback traces dans la session

## Principe

Chaque requete chat ouvre une session runtime.

La session enregistre:

- prompt
- classification
- actions tools
- etat des steps
- erreurs runtime
- retries declenches
- phase courante
- score final
- etat navigateur courant

Le sandbox est base sur:

- repertoire autorise
- allowlist shell
- permission `git:clone`
- droits reseau / navigateur
- allowlist optionnelle des tools
- allowlist des actions navigateur
