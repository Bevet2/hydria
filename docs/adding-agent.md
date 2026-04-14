# Ajouter un agent

1. Creer un fichier dans `backend/src/agents`.
2. Heriter de `BaseAgent`.
3. Implementer `execute(input)`.
4. Brancher l'agent dans `backend/src/core/HydriaAutonomousBrain.js`.
5. L'ajouter au `AgentRegistry`.

Exemple minimal:

```js
import { BaseAgent } from "./BaseAgent.js";

export class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: "my_agent",
      label: "My Agent",
      role: "specific responsibility"
    });
  }

  async execute(input) {
    return { ok: true, input };
  }
}
```

Bonnes pratiques:

- une responsabilite claire
- pas de dependance directe au transport HTTP
- preferer reutiliser les services existants
- retourner des structures explicites et journalisables
- si l'agent participe au flow, l'exposer dans l'orchestrateur ou dans le plan

Agents actuellement branches:

- `orchestrator_agent`
- `planner_agent`
- `executor_agent`
- `critic_agent`
- `memory_agent`
- `research_agent`
- `api_agent`
- `git_agent`
