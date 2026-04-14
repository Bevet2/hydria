# Hydria Agentic V1 Architecture

Hydria garde son backend Express et ses services historiques, mais ajoute une nouvelle couche `backend/src` orientee agent autonome modulaire.

## Cible

- `src/core`
  - cerveau principal
  - provider LLM abstrait
- `src/agents`
  - `plannerAgent`
  - `executorAgent`
  - `criticAgent`
  - `memoryAgent`
- `src/runtime`
  - wrapper fichier
  - wrapper shell securise
  - vault credentials
- `src/tools`
  - registre de tools
  - wrappers API, web, workspace, diagnostics, preview, knowledge, artifact
- `src/memory`
  - store JSON local court terme / travail / long terme / outcomes
- `src/knowledge`
  - ingestion de pieces jointes
  - index JSON local
  - recherche locale
- `src/evals`
  - evaluation heuristique
  - journal JSONL
- `src/learning`
  - extraction automatique des patterns, templates, mistakes et strategies
  - store JSON local
  - reuse avant planification et execution
- `src/config`
  - flags agentiques
- `src/types`
  - interfaces communes
- `src/presentation`
  - synthese finale orientee solution
  - separation reponse utilisateur vs trace debug
 - `frontend`
  - shell workspace visuel
  - navigation projet -> objet -> fichier -> section
  - preview + edition persistante

## Boucle V1

1. reception de la tache utilisateur
2. rappel memoire + ingestion documentaire
3. routage conversationnel
4. classification + mini-plan
5. execution des etapes
6. observation des resultats
7. synthese finale
8. critique heuristique
9. memorisation utile
10. persistance SQLite + JSON local

## Principe de compatibilite

- l’existant n’est pas supprime
- les services historiques restent utilises pour:
  - classification
  - planning
  - LLM routing
  - APIs
  - web
  - outils locaux
  - generation de documents
  - SQLite
- le nouveau cerveau `HydriaAutonomousBrain` orchestre ces briques dans une architecture plus modulaire

## Interfaces centrales

- `BrainProvider`
- `Agent`
- `Tool`
- `MemoryStore`
- `KnowledgeStore`
- `Evaluator`
- `RuntimeAdapter`

## Renforts audit V2

- `backend/src/agents/AgentRegistry.js`
  - inventaire central des agents actifs
  - domaines couverts
  - liaison agents -> tools -> responsabilites
- `backend/src/core/domainRouter.js`
  - routage par domaine: `simple_chat`, `coding`, `github_research`, `reasoning`, `brainstorm`
  - choix de l'agent prioritaire, strategie et profondeur
- `backend/src/prompts/domainPrompts.js`
  - templates de prompt par domaine
  - style de reponse adapte a la tache
- `backend/src/core/responseQualityPass.js`
  - passe deterministe apres synthese
  - normalise la forme finale et privilegie les sorties outillees utiles
- `backend/src/core/executionIntent.js`
  - detecte quand la demande n'est plus une demande de conseil mais une demande d'execution
  - permet la bascule raisonnement -> action
- `backend/src/presentation/solutionSynthesizer.js`
  - transforme recherche + patterns + learnings en recommandation exploitable
- `backend/src/presentation/finalAnswerBuilder.js`
  - choisit entre presentation outil, synthese solution et reponse brute
- `backend/src/presentation/executionResultPresenter.js`
  - priorise une reponse centree sur l'action quand Hydria a reellement cree un scaffold
- `backend/src/presentation/userFacingFormatter.js`
  - nettoie les traces internes avant affichage utilisateur
- `backend/src/project-builder/projectBuilder.js`
  - cree un workspace, ecrit un scaffold initial et produit un manifest local
  - execute ensuite une boucle de delivery bornee: install -> run smoke -> auto-fix simple -> validation -> export zip
- `backend/src/artifacts/*`
  - export du projet en zip utilisateur
  - manifest de livraison
  - publication via la route d'artifacts existante
- `backend/src/api-registry/*`
  - couche agentique locale au-dessus des catalogues JSON existants
  - recherche et filtrage simple sans casser la couche legacy
- `backend/src/core/simpleChatResponder.js`
  - reponses locales ancrees pour l'identite et les capacites d'Hydria
  - evite les hallucinations de `simple_chat` sur le produit lui-meme
- `backend/src/projects/internalCapabilityDiscovery.js`
  - inspecte des projets existants sur disque comme `F:\hydria-studio` et `F:\hydria music`
  - les transforme en capacites internes utilisables par Hydria
- `backend/src/projects/globalProjectService.js`
  - fait evoluer un projet vers un objet global compose de dimensions
  - selectionne automatiquement des capacites internes comme `studio` et `music`
- `global project delivery`
  - ajoute `project.blueprint.json`, `experience/overview.md`, `studio/*`, `audio/*`
  - expose les dimensions et capacites directement dans le projet et le work object
- `workspace visuel`
  - le chat reste le journal d'activite
  - le frontend ouvre les projets comme espaces de travail reels
  - la selection de fichier et de section modifie le meme work object au lieu de regenerer un objet a chaque tour
  - un modele de surfaces universelles choisit maintenant entre `overview`, `preview`, `edit`, `structure`, `code`, `data`, `media`, `app` et `live`
  - les assets previewables d'un work object sont exposes par `/api/work-objects/:id/assets/*`
  - les work objects HTML runtime-capables exposent aussi `/api/work-objects/:id/runtime`
  - la surface `live` execute maintenant un `runtimeSession` distinct de la source editee
  - le flux est separe en `source` persistee, `draft` en cours et `runtime` actif
  - la preview live lit `/api/work-objects/:id/runtime/session/render` et les assets sessionnes associes
  - l'edition pousse vers la session runtime, puis la sauvegarde resynchronise la source persistante
  - les changements HTML/CSS simples sont appliques en patch doux dans l'iframe pour eviter un reload brutal
  - les changements plus lourds restent proteges par un fallback de refresh runtime cible
- `noyau OS cognitif V1`
  - `backend/src/core/intentKernel.js` extrait maintenant une vraie lecture de l'intention: objectif reel, niveau utilisateur, ambiguite, contraintes implicites, besoins induits
  - `backend/src/core/environmentPlanner.js` choisit l'environnement cible a instancier: type d'objet, surfaces, runtime, mode de persistance, continuité
  - `backend/src/core/projectContinuity.js` maintient la continuité d'objet/projet dans une conversation, pour que les prompts de suivi reprennent l'environnement courant au lieu de repartir de zero
  - `backend/src/core/intentSimulation.js` compare maintenant plusieurs chemins plausibles avant action: `environment_create`, `environment_update`, `environment_transform`, `project_scaffold`
  - `backend/src/core/environmentSimulation.js` compare maintenant plusieurs scenarios d'environnement concrets: continuer l'objet courant, creer un nouvel objet, transformer l'objet actif, etendre le projet courant, ou creer un nouveau projet
  - `backend/src/core/projectTrajectorySimulation.js` compare maintenant plusieurs trajectoires produit: objet lie au projet, extension du shell projet, projet complet avec delivery, ou nouvelle branche projet
  - `backend/src/core/businessSimulation.js` compare maintenant plusieurs scenarios metier: `mvp_launch`, `investor_ready`, `analytics_command_center`, `automation_operator`, `knowledge_asset`, `product_design_sprint`
  - `backend/src/core/productPlanSimulation.js` compare maintenant plusieurs plans produit complets: `lean_object_plan`, `project_extension_plan`, `delivery_mvp_plan`, `investor_asset_plan`, `operating_surface_plan`, `design_iteration_plan`
  - `backend/src/core/impactSimulation.js` compare maintenant plusieurs issues d'impact: `fast_value_path`, `continuity_roi_path`, `delivery_investment_path`, `safe_transform_path`, `operational_leverage_path`
  - `backend/src/core/usageScenarioSimulation.js` compare maintenant plusieurs boucles d'usage: `quick_first_success`, `launch_validation_loop`, `stakeholder_review_loop`, `repeat_operator_loop`, `continuous_iteration_loop`
  - `plannerAgent`, `strategyAgent` et `HydriaAutonomousBrain` consomment maintenant ces briques pour decider quand continuer, quand changer de forme, quand transformer un objet existant, quand enrichir un projet vivant, quand lancer une delivery complete, quel plan produit global sert le mieux l'utilisateur, quel compromis valeur/cout/risque est le plus justifie, et quelle boucle d'usage doit structurer le workspace

## Etat des donnees

- SQLite: historique utilisateur, conversations, messages, execution logs, memoire utilisateur existante
- JSON local: learnings reutilisables issus des taches internes et des recherches externes
- JSON local: memoire agentique, index documentaire, logs evals, logs d’usage tools

## Extension future

- provider LLM local supplementaire
- boucle d’auto-amelioration controlee
- evaluateurs plus fins
- indexation vectorielle locale
- runtime navigateur plus fort

## V-next branchee

Hydria ajoute maintenant :

- `strategyAgent`
  - choix meta de la strategie, des agents et de la profondeur de reasoning
- `patterns`
  - bibliotheque de patterns / templates / strategies valides
- `projects`
  - suivi de projets vivants avec historique et quality score
- `project-builder`
  - scaffold -> install -> run -> auto-fix simple -> validate -> export
  - garde un workspace interne, mais livre un artifact zip utilisateur
- `global projects`
  - le project builder ne construit plus seulement des fichiers techniques
  - il peut maintenant construire un projet riche, editables et multi-dimensions
- `benchmarks`
  - scenarios de benchmark plus proches de l'usage reel
- maintenance progressive des learnings historiques
  - pour assainir les learnings generiques plus anciens sans perte brutale d'historique
# Work Objects

Hydria now exposes created outputs as persistent work objects. The canonical layer is in
`backend/src/work-objects`, and it links user-facing objects with project delivery,
artifact export, editing, and iterative improvement.
