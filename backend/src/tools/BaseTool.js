import { Tool } from "../types/contracts.js";

export class BaseTool extends Tool {
  constructor(definition) {
    super();
    this.definition = definition;
    this.id = definition.id;
    this.label = definition.label || definition.name || definition.id;
    this.description = definition.description || "";
    this.permissions = definition.permissions || [];
  }

  getDefinition() {
    return this.definition;
  }
}

export default BaseTool;
