# Global Projects

Hydria ne traite plus seulement ses sorties comme des fichiers ou des artefacts isoles.  
Quand une demande est interpretee comme un projet executable, Hydria construit maintenant un
`global project` avec :

- des dimensions explicites : `text`, `narrative`, `visual`, `audio`, `structure`, `logic`, `data`
- des surfaces editables
- des capacites internes selectionnees automatiquement
- un workspace livrable et un work object persistant

## Capacites internes

Hydria inspecte au demarrage des projets presents sur disque et les transforme en capacites internes :

- `Hydria Studio`
  - source analysee : `F:\hydria-studio`
  - usage : storytelling, narration, storyboard, direction visuelle, bundle presentable
- `Hydria Music`
  - source analysee : `F:\hydria music`
  - usage : briefing audio, composition, cues, plan de pistes, export audio

Ces projets ne sont pas exposes comme outils externes.  
Ils sont internalises sous forme de profils de capacites et de patterns de projet.

## Builder global

Le project builder peut maintenant produire un projet enrichi :

- `project.blueprint.json`
- `experience/overview.md`
- `content/project-brief.md`
- `logic/architecture.md`
- `studio/*` si la capacite `studio` est retenue
- `audio/*` si la capacite `music` est retenue

Sur un projet Node/JS, la boucle classique reste :

1. scaffold
2. install
3. run smoke
4. auto-fix simple
5. validate
6. export

Sur un projet plus narratif / visuel / audio, Hydria scaffold le projet global, saute proprement
les phases Node non pertinentes, puis exporte quand meme un livrable utilisateur.

## Work objects

Le work object de projet expose maintenant aussi :

- `projectDimensions`
- `internalCapabilities`
- `globalProject`

Le frontend peut donc afficher le projet comme surface de travail riche, pas comme simple texte.
