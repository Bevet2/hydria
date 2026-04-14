import ApiRegistryStore from "./api-registry.store.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export class ApiRegistryService {
  constructor({ store = new ApiRegistryStore() } = {}) {
    this.store = store;
  }

  list(filters = {}) {
    const {
      category = "",
      pricing = "",
      capability = "",
      enabledOnly = false,
      query = ""
    } = filters;
    const normalizedQuery = normalizeText(query);

    return this.store.list()
      .filter((item) => (enabledOnly ? item.enabled : true))
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (pricing ? item.pricing === pricing : true))
      .filter((item) =>
        capability ? item.capabilities.includes(capability) : true
      )
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = normalizeText(
          `${item.id} ${item.name} ${item.description} ${item.category} ${item.capabilities.join(" ")}`
        );
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => left.priority - right.priority);
  }

  getById(id) {
    return this.store.list().find((item) => item.id === id) || null;
  }

  getPublicSummary() {
    const items = this.list();
    const categories = [...new Set(items.map((item) => item.category))].sort();

    return {
      total: items.length,
      categories,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        pricing: item.pricing,
        capabilities: item.capabilities,
        enabled: item.enabled,
        source: item.source,
        priority: item.priority
      }))
    };
  }
}

export default ApiRegistryService;
