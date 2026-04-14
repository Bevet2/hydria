import { applyLearningCleanup } from "./learning.cleanup.js";

export class LearningMigrationService {
  constructor({ learningStore }) {
    this.learningStore = learningStore;
  }

  async runMaintenance({ maxChanges = 40 } = {}) {
    if (!this.learningStore) {
      return {
        total: 0,
        flagged: 0,
        changed: 0,
        actions: {}
      };
    }

    const state = this.learningStore.readState();
    const result = applyLearningCleanup(state.items || [], { maxChanges });
    this.learningStore.writeState({
      ...state,
      items: result.items
    });

    return {
      total: result.total,
      flagged: result.flagged,
      changed: result.changed,
      actions: result.actions
    };
  }
}

export default LearningMigrationService;
