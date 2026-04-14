import { auditLearningStoreItems } from "./learning.audit.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

export function applyLearningCleanup(items = [], { maxChanges = 40 } = {}) {
  const audit = auditLearningStoreItems(items);
  const nextItems = [...items];
  let changes = 0;

  for (const entry of audit.entries) {
    if (changes >= maxChanges) {
      break;
    }

    const index = nextItems.findIndex((item) => item.id === entry.item.id);
    if (index < 0) {
      continue;
    }

    const current = nextItems[index];
    const stamp = new Date().toISOString();
    const baseAudit = {
      ...(current.audit || {}),
      lastCheckedAt: stamp,
      lastAction: entry.audit.action,
      flags: entry.audit.flags,
      genericityScore: entry.audit.genericityScore
    };

    if (entry.audit.action === "keep") {
      nextItems[index] = {
        ...current,
        audit: baseAudit
      };
      continue;
    }

    changes += 1;
    if (entry.audit.action === "downgrade") {
      nextItems[index] = {
        ...current,
        confidence: clamp01(Number(current.confidence || 0.5) * 0.82),
        successRate: clamp01(Number(current.successRate || 0.5) * 0.9),
        audit: baseAudit
      };
      continue;
    }

    if (entry.audit.action === "recategorize") {
      nextItems[index] = {
        ...current,
        category: entry.audit.suggestedCategory || current.category,
        audit: {
          ...baseAudit,
          previousCategory: current.category
        }
      };
      continue;
    }

    if (entry.audit.action === "archive") {
      nextItems[index] = {
        ...current,
        status: "archived",
        archivedAt: stamp,
        audit: baseAudit
      };
      continue;
    }

    if (entry.audit.action === "disable") {
      nextItems[index] = {
        ...current,
        status: "disabled",
        disabledAt: stamp,
        audit: baseAudit
      };
    }
  }

  return {
    ...audit,
    changed: changes,
    items: nextItems
  };
}

export default {
  applyLearningCleanup
};
