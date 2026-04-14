# Ajouter un tool

1. Creer un wrapper dans `backend/src/tools`.
2. Heriter de `BaseTool`.
3. Exposer un `id` stable.
4. Implementer `execute(input)`.
5. Enregistrer le tool dans `ToolRegistry`.

Exemple minimal:

```js
import { BaseTool } from "./BaseTool.js";

export class MyTool extends BaseTool {
  constructor() {
    super({
      id: "my_tool",
      label: "My Tool",
      description: "Does one thing well",
      permissions: ["custom:read"]
    });
  }

  async execute(input) {
    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: this.label,
      capability: "custom_action",
      raw: input,
      normalized: input,
      summaryText: "Tool executed."
    };
  }
}
```

Bonnes pratiques:

- un schema d’entree/sortie simple
- permissions explicites
- pas de hardcode de credentials
- resultat normalise et exploitable par le cerveau
