import { deriveProjectStatus } from "./project.status.js";
import { normalizePromptText } from "../core/promptNormalization.js";
import { resolveRequestedShape } from "../core/creationShape.js";

function slugifyTopic(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9\s-]+/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferTopicSlug(prompt = "") {
  const normalized = normalizePromptText(prompt)
    .replace(/[.?!]+$/g, "")
    .replace(/^(?:peux-tu|peux tu|pourrais-tu|pourrais tu|est-ce que tu peux|tu peux)\s+/i, "")
    .replace(
      /^(create|build|generate|make|cree|creer|fais|construis|genere|ecris|produis)\s+/,
      ""
    )
    .replace(
      /\b(global|project|projet|workspace|app|application|dashboard|document|presentation|spreadsheet|excel|workflow|wireframe|design)\b/g,
      " "
    )
    .replace(/\b(de|du|des|la|le|les|un|une|pour|with|and|et|this|ce|cet|cette|global|qui|that|helps?|help|aide|aider|their|leur|dans|sur|avec)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .slice(0, 3);

  return slugifyTopic(words.join(" "));
}

function deriveProjectNameHint(prompt = "", requestedShape = { shape: "project" }) {
  const normalized = normalizePromptText(prompt)
    .replace(/[.?!]+$/g, "")
    .replace(/^(?:peux-tu|peux tu|pourrais-tu|pourrais tu|est-ce que tu peux|tu peux)\s+/i, "");
  const directAppTopicMatch = normalized.match(
    /\b(?:application|app)\s+(?:de|d|pour|for|sur|about|with)\s+([a-z0-9\s-]{3,160})$/i
  );
  const explicitTopicMatch = normalized.match(
    /\b(?:application|app|project|projet|workspace|dashboard|document|presentation|workflow|design)\s+(?:de|sur|for|about|pour)?\s*([a-z0-9\s-]{3,160})$/i
  );
  const explicitTopic = inferTopicSlug(
    String(directAppTopicMatch?.[1] || explicitTopicMatch?.[1] || "")
  );
  const topicMatch =
    normalized.match(/\b(?:de|d|sur|for|about|pour)\b\s+([a-z0-9\s-]{3,160})$/i) ||
    normalized.match(
      /\b([a-z0-9\s-]{3,80})\s+(?:app|application|dashboard|api|backend|frontend|project|projet)\b/i
    ) ||
    normalized.match(
      /\b(?:app|application|dashboard|api|backend|frontend|project|projet)\s+(?:for|about|de|sur|with|pour)?\s*([a-z0-9\s-]{3,160})$/i
    );
  const topic =
    explicitTopic ||
    slugifyTopic(String(topicMatch?.[1] || "")) ||
    inferTopicSlug(prompt);

  if (!topic) {
    return requestedShape.shape === "app" ? "app" : "hydria-project";
  }

  if (requestedShape.shape === "app") {
    return `${topic}-app`;
  }

  if (requestedShape.shape === "code_project") {
    return `${topic}-workspace`;
  }

  return topic;
}

export function detectProjectIntent({ prompt = "", classification = "" } = {}) {
  const normalized = normalizePromptText(prompt);
  const requestedShape = resolveRequestedShape(prompt);
  const documentCentric =
    /\b(business plan|plan d'affaires|plan d affaires|presentation|slides|deck|rapport|report|proposal|proposition|brief|memo|guide|document)\b/.test(
      normalized
    );
  const explicitProjectSignal =
    /\b(project|projet|workspace|app|application|api|backend|frontend|dashboard|experience|pitch|presentation|narratif|narrative|story|storytelling|music|musique|audio|visuel|visual|studio|campaign|brand|site|outil|tool|build|scaffold|squelette|skeleton|generate|genere|create|cree|files|fichiers)\b/.test(
      normalized
    );

  if (
    ["spreadsheet", "presentation", "document", "dataset", "dashboard", "workflow", "design"].includes(
      requestedShape.shape
    ) ||
    (documentCentric &&
      !/\b(project|projet|workspace|app|application|api|backend|frontend|dashboard|build|scaffold|squelette|skeleton)\b/.test(
        normalized
      ))
  ) {
    return {
      isProjectTask: false,
      nameHint: ""
    };
  }

  if (requestedShape.executable || explicitProjectSignal) {
    return {
      isProjectTask: true,
      nameHint: deriveProjectNameHint(prompt, requestedShape)
    };
  }

  return {
    isProjectTask: false,
    nameHint: ""
  };
}

export function updateProjectAfterTask(
  project,
  {
    task,
    criticScore = 0,
    buildStatus = "",
    testStatus = "",
    learnings = [],
    delivery = null
  } = {}
) {
  const status = deriveProjectStatus({ criticScore, buildStatus, testStatus, delivery });
  return {
    ...project,
    status,
    qualityScore: Number(criticScore || project.qualityScore || 0),
    deliveryStatus: delivery
      ? {
          scaffold:
            delivery.status === "scaffolded" ||
            delivery.status === "installed" ||
            delivery.status === "run_failed" ||
            delivery.status === "validated" ||
            delivery.status === "exported" ||
            delivery.status === "delivered"
              ? "completed"
              : "pending",
          install: delivery.install?.status || "skipped",
          run: delivery.run?.status || "skipped",
          validation: delivery.validation?.status || "skipped",
          export: delivery.export?.downloadUrl ? "completed" : "skipped",
          deliver: delivery.status === "delivered" ? "completed" : "pending"
        }
      : project.deliveryStatus,
    logs: delivery?.logs
      ? {
          ...(project.logs || {}),
          ...delivery.logs
        }
      : project.logs,
    errors: [
      ...new Set([
        ...(project.errors || []),
        ...(delivery?.validation?.issues || [])
      ])
    ],
    corrections: delivery?.correctionsApplied || project.corrections || [],
    exportArtifact: delivery?.export || project.exportArtifact || null,
    lastCommand: delivery?.nextCommand || project.lastCommand || "",
    tasksHistory: [
      ...(project.tasksHistory || []),
      {
        task,
        criticScore,
        buildStatus,
        testStatus,
        deliveryStatus: delivery?.status || null,
        at: new Date().toISOString()
      }
    ].slice(-30),
    history: [
      ...(project.history || []),
      {
        event: "task_completed",
        task,
        status,
        deliveryStatus: delivery?.status || null,
        at: new Date().toISOString()
      }
    ].slice(-50),
    learningsLinked: [...new Set([...(project.learningsLinked || []), ...learnings.map((item) => item.id).filter(Boolean)])]
  };
}

export default {
  detectProjectIntent,
  updateProjectAfterTask
};
