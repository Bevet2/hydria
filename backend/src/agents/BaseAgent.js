import { Agent } from "../types/contracts.js";

export class BaseAgent extends Agent {
  constructor({ id, label, role }) {
    super();
    this.id = id;
    this.label = label;
    this.role = role || label;
  }

  getId() {
    return this.id;
  }

  async run(input, state = {}) {
    return this.execute(input, state);
  }

  describe() {
    return {
      id: this.id,
      label: this.label,
      role: this.role
    };
  }
}

export default BaseAgent;
