// Roles in decreasing privilege order: executive > manager > analyst > standard
const DATA_ROLES = ["executive", "manager", "analyst", "standard"];

// Columns/fields that commonly hold personal identifiable information
const PII_PATTERNS =
  /\b(email|phone|mobile|tel(?![a-z])|contact|nom|pr[eé]nom|first.?name|last.?name|adresse|address|birthday|dob|date.?(?:of.?)?birth|ssn|siret|iban)\b/i;

function truncate(text, maxChars) {
  const t = String(text || "");
  return t.length <= maxChars ? t : `${t.slice(0, maxChars - 1).trim()}…`;
}

/**
 * Filter workspace content preview based on the user's data access role.
 * Returns the original preview unchanged for executive role (default).
 */
export function filterContentPreviewByRole(contentPreview, role, workspaceFamilyId) {
  if (!contentPreview) return contentPreview;

  const normalizedRole = DATA_ROLES.includes(role) ? role : "executive";
  if (normalizedRole === "executive") return contentPreview;

  if (normalizedRole === "standard") {
    return truncate(contentPreview, 1200);
  }

  // Detect JSON structured content (sheets/datasets)
  const trimmed = contentPreview.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return filterStructuredByRole(contentPreview, normalizedRole);
  }

  // Text content (docs, CRM notes)
  if (normalizedRole === "manager") {
    return truncate(contentPreview, 6000);
  }

  // analyst on CRM: keep all data but redact PII lines
  const family = (workspaceFamilyId || "").toLowerCase();
  if (normalizedRole === "analyst" && (family === "crm_sales" || family === "crm")) {
    return redactPiiLines(contentPreview);
  }

  return contentPreview;
}

function filterStructuredByRole(contentPreview, role) {
  try {
    const parsed = JSON.parse(contentPreview);
    if (role === "manager") {
      const filtered = redactPiiFields(parsed);
      return JSON.stringify(filtered, null, 2).slice(0, 6000);
    }
    // analyst: full structured data, no truncation
    return contentPreview;
  } catch {
    return truncate(contentPreview, role === "manager" ? 6000 : 1200);
  }
}

function redactPiiFields(data) {
  if (Array.isArray(data)) return data.map(redactPiiFields);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        PII_PATTERNS.test(k) ? "[redacted]" : redactPiiFields(v)
      ])
    );
  }
  return data;
}

function redactPiiLines(text) {
  return text
    .split("\n")
    .map((line) =>
      PII_PATTERNS.test(line) ? line.replace(/(:?\s*)(\S.{2,})$/, "$1[redacted]") : line
    )
    .join("\n");
}
