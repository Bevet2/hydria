import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizePatternItem } from "./pattern.types.js";
import { validatePatternItem } from "./pattern.validation.js";
import { searchPatternItems } from "./pattern.search.js";

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, items: [] }, null, 2));
  }
}

export class PatternLibrary {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureFile(filePath);
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: parsed.version || 1,
        items: Array.isArray(parsed.items) ? parsed.items.map((item) => normalizePatternItem(item)) : []
      };
    } catch {
      return { version: 1, items: [] };
    }
  }

  writeState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  async ingestLearnings(learnings = []) {
    const state = this.readState();
    const items = [...state.items];

    for (const learning of learnings) {
      if (!["pattern", "template", "strategy"].includes(learning.type)) {
        continue;
      }

      const candidate = normalizePatternItem({
        id: randomUUID(),
        type: learning.type,
        category: learning.category,
        description: learning.description,
        score: Number(learning.score || 0),
        confidence: Number(learning.confidence || 0.5),
        source: learning.source || {},
        projectType: learning.projectType || "internal",
        tags: learning.reusableFor || []
      });

      if (!validatePatternItem(candidate)) {
        continue;
      }

      const existingIndex = items.findIndex(
        (item) => item.type === candidate.type && item.category === candidate.category && item.description === candidate.description
      );
      if (existingIndex >= 0) {
        items[existingIndex] = {
          ...items[existingIndex],
          score: Math.max(Number(items[existingIndex].score || 0), candidate.score),
          confidence: Math.max(Number(items[existingIndex].confidence || 0), candidate.confidence),
          updatedAt: new Date().toISOString()
        };
      } else {
        items.push(candidate);
      }
    }

    this.writeState({
      ...state,
      items
    });

    return items;
  }

  search(query = "", options = {}) {
    return searchPatternItems(this.readState().items, query, options);
  }
}

export default PatternLibrary;
