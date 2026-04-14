function maybeRepairUtf8Mojibake(value = "") {
  const input = String(value || "");
  if (!input) {
    return "";
  }

  if (!/[ÃÂâ€\uFFFD]/.test(input)) {
    return input;
  }

  try {
    const repaired = Buffer.from(input, "latin1").toString("utf8");
    return /[a-zA-ZÀ-ÿ]/.test(repaired) ? repaired : input;
  } catch {
    return input;
  }
}

function repairBrokenImperatives(value = "") {
  return String(value || "")
    .replace(/\bcr[\?\uFFFD]+e\b/gi, "cree")
    .replace(/\bcr[\?\uFFFD]+er\b/gi, "creer")
    .replace(/\bgen[\?\uFFFD]+re\b/gi, "genere")
    .replace(/\bd[\?\uFFFD]+veloppe\b/gi, "developpe")
    .replace(/\be[\?\uFFFD]+cris\b/gi, "ecris")
    .replace(/\bam[\?\uFFFD]+liore\b/gi, "ameliore")
    .replace(/\bpr[\?\uFFFD]+sentation\b/gi, "presentation")
    .replace(/\br[\?\uFFFD]+sum[\?\uFFFD]+\b/gi, "resume")
    .replace(/\btable[\?\uFFFD]+ur\b/gi, "tableur");
}

function collapseDuplicatedImperatives(value = "") {
  return String(value || "")
    .replace(
      /\b(?:cree|creer|create|build|generate|make|fais|fabrique|genere|produis)\s+(?:moi\s+)?(?:cree|creer|create|build|generate|make|fais|fabrique|genere|produis)\b/gi,
      (match) => {
        const normalized = match
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        if (/\bmoi\b/.test(normalized)) {
          if (/^(fais|make)/.test(normalized)) {
            return "fais moi";
          }
          return "cree moi";
        }

        if (/^(fais|make)/.test(normalized)) {
          return "fais";
        }

        return "cree";
      }
    )
    .replace(/\bcree\s+moi\s+(?:un|une|des)\s+excel\b/gi, "cree un excel")
    .replace(/\bcree\s+moi\s+(?:un|une|des)\s+tableur\b/gi, "cree un tableur")
    .replace(/\bcree\s+moi\s+(?:un|une|des)\s+presentation\b/gi, "cree une presentation")
    .replace(/\bcree\s+moi\s+(?:un|une|des)\s+document\b/gi, "cree un document")
    .replace(/\bcree\s+moi\b/gi, "cree")
    .replace(/\bfais\s+moi\b/gi, "fais")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPromptText(value = "") {
  return collapseDuplicatedImperatives(
    repairBrokenImperatives(maybeRepairUtf8Mojibake(value))
  );
}

export function normalizePromptText(value = "") {
  return cleanPromptText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default {
  cleanPromptText,
  normalizePromptText
};
