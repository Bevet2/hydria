import { loadApiRegistrySeed } from "./api-registry.seed.js";

export class ApiRegistryStore {
  constructor({ seedLoader = loadApiRegistrySeed } = {}) {
    this.seedLoader = seedLoader;
    this.cache = null;
  }

  load() {
    this.cache = this.seedLoader();
    return this.cache;
  }

  list() {
    return this.cache || this.load();
  }
}

export default ApiRegistryStore;
