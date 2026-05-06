function createTextFragment(text = "") {
  const fragment = document.createDocumentFragment();
  const pattern = /(!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[2] !== undefined && match[3]) {
      const image = document.createElement("img");
      image.src = match[3];
      image.alt = match[2] || "Embedded visual";
      image.className = "workspace-inline-image";
      fragment.appendChild(image);
    } else if (match[4] && match[5]) {
      const link = document.createElement("a");
      link.href = match[5];
      link.textContent = match[4];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      fragment.appendChild(link);
    } else if (match[6]) {
      const code = document.createElement("code");
      code.textContent = match[6];
      fragment.appendChild(code);
    } else if (match[7]) {
      const strong = document.createElement("strong");
      strong.textContent = match[7];
      fragment.appendChild(strong);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function normalizePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function friendlyPathLabel(filePath = "") {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

const SPREADSHEET_HISTORY_LIMIT = 80;
const spreadsheetHistoryStore = new Map();
const spreadsheetShortcutCleanupStore = new Map();
const spreadsheetSelectionStore = new Map();
const spreadsheetClipboardStore = new Map();
const spreadsheetViewportStore = new Map();
const spreadsheetRibbonTabStore = new Map();
const spreadsheetRibbonVisibilityStore = new Map();
const spreadsheetExpandedStore = new Map();
const spreadsheetExpandedPopupHostStore = new Map();
const spreadsheetRecentFormulaStore = new Map();
const SPREADSHEET_MIN_VISIBLE_COLUMNS = 26;
const SPREADSHEET_MIN_VISIBLE_ROWS = 200;

function cloneSpreadsheetSnapshot(model = {}) {
  return JSON.parse(JSON.stringify(model || {}));
}

function areSpreadsheetSnapshotsEqual(left = {}, right = {}) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

const SPREADSHEET_NUMBER_FORMATS = new Set(["number", "currency", "percent", "date"]);
const SPREADSHEET_HORIZONTAL_ALIGNMENTS = new Set(["left", "center", "right"]);
const SPREADSHEET_VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const SPREADSHEET_BORDER_EDGES = ["top", "right", "bottom", "left"];
const SPREADSHEET_BORDER_STYLE_CSS = {
  thin: "1px solid",
  medium: "2px solid",
  thick: "3px solid",
  dashed: "2px dashed",
  dotted: "2px dotted",
  double: "3px double"
};
const SPREADSHEET_BORDER_STYLE_LABELS = {
  thin: "Trait fin",
  medium: "Trait moyen",
  thick: "Trait epais",
  dashed: "Tirets",
  dotted: "Pointilles",
  double: "Double trait"
};
const SPREADSHEET_CONDITIONAL_FORMAT_TYPES = new Set([
  "greaterThan",
  "lessThan",
  "between",
  "equal",
  "textContains",
  "duplicate"
]);
const SPREADSHEET_CONDITIONAL_FORMAT_TYPE_LABELS = {
  greaterThan: "Superieur a",
  lessThan: "Inferieur a",
  between: "Entre",
  equal: "Egal a",
  textContains: "Texte qui contient",
  duplicate: "Valeurs en double"
};
const SPREADSHEET_CONDITIONAL_FORMAT_PRESETS = [
  {
    id: "red",
    label: "Remplissage rouge clair, texte rouge fonce",
    fillColor: "#ffc7ce",
    textColor: "#9c0006",
    bold: false
  },
  {
    id: "yellow",
    label: "Remplissage jaune, texte jaune fonce",
    fillColor: "#ffeb9c",
    textColor: "#9c6500",
    bold: false
  },
  {
    id: "green",
    label: "Remplissage vert, texte vert fonce",
    fillColor: "#c6efce",
    textColor: "#006100",
    bold: false
  },
  {
    id: "blue",
    label: "Remplissage bleu, texte bleu fonce",
    fillColor: "#ddebf7",
    textColor: "#1f4e79",
    bold: false
  },
  {
    id: "bold",
    label: "Texte gras sans remplissage",
    fillColor: "",
    textColor: "#202124",
    bold: true
  }
];
const SPREADSHEET_TABLE_STYLES = ["blue", "green", "orange", "purple", "gray"];
const SPREADSHEET_TABLE_TOTAL_FUNCTIONS = new Set(["sum", "average", "count", "min", "max", "none"]);
const SPREADSHEET_TABLE_TOTAL_LABELS = {
  sum: "Somme",
  average: "Moyenne",
  count: "Nombre",
  min: "Min",
  max: "Max",
  none: "Aucun"
};
const SPREADSHEET_TABLE_TOTAL_SUBTOTAL_CODES = {
  sum: 109,
  average: 101,
  count: 103,
  min: 105,
  max: 104
};
const SPREADSHEET_BUILTIN_FORMULA_NAMES = new Set([
  "ABS",
  "AND",
  "AVERAGE",
  "AVERAGEIF",
  "AVERAGEIFS",
  "AVG",
  "CONCAT",
  "COUNT",
  "COUNTA",
  "COUNTBLANK",
  "COUNTIF",
  "COUNTIFS",
  "DATE",
  "FILTER",
  "FALSE",
  "IF",
  "IFERROR",
  "INDEX",
  "LEFT",
  "LEN",
  "LOWER",
  "MATCH",
  "MAX",
  "MID",
  "MIN",
  "MEDIAN",
  "NOT",
  "NOW",
  "OR",
  "PRODUCT",
  "RIGHT",
  "ROUND",
  "ROUNDDOWN",
  "ROUNDUP",
  "SORT",
  "SUBTOTAL",
  "SUM",
  "SUMIF",
  "SUMIFS",
  "TEXT",
  "TODAY",
  "TRIM",
  "TRUE",
  "UNIQUE",
  "UPPER",
  "VALUE",
  "VLOOKUP",
  "XLOOKUP"
]);
const SPREADSHEET_FORMULA_NAME_ALIASES = {
  SI: "IF",
  SIERREUR: "IFERROR",
  ET: "AND",
  OU: "OR",
  NON: "NOT",
  VRAI: "TRUE",
  FAUX: "FALSE",
  SOMME: "SUM",
  "SOMME.SI": "SUMIF",
  "SOMME.SI.ENS": "SUMIFS",
  MOYENNE: "AVERAGE",
  "MOYENNE.SI": "AVERAGEIF",
  "MOYENNE.SI.ENS": "AVERAGEIFS",
  NB: "COUNT",
  NBVAL: "COUNTA",
  "NB.VIDE": "COUNTBLANK",
  "NB.SI": "COUNTIF",
  "NB.SI.ENS": "COUNTIFS",
  AUJOURDHUI: "TODAY",
  MAINTENANT: "NOW",
  TEXTE: "TEXT",
  GAUCHE: "LEFT",
  DROITE: "RIGHT",
  STXT: "MID",
  SUPPRESPACE: "TRIM",
  VALEUR: "VALUE",
  FILTRE: "FILTER",
  TRIER: "SORT",
  UNIQUE: "UNIQUE",
  EQUIV: "MATCH",
  RECHERCHEV: "VLOOKUP",
  RECHERCHEX: "XLOOKUP",
  "SOUS.TOTAL": "SUBTOTAL",
  ARRONDI: "ROUND",
  "ARRONDI.INF": "ROUNDDOWN",
  "ARRONDI.SUP": "ROUNDUP",
  PRODUIT: "PRODUCT",
  CONCATENER: "CONCAT"
};
const SPREADSHEET_FORMULA_CATEGORIES = [
  { id: "all", label: "Tout", ribbonLabel: "Toutes", icon: "function" },
  { id: "math", label: "Math et trigo", ribbonLabel: "Math", icon: "number" },
  { id: "statistical", label: "Statistiques", ribbonLabel: "Stat", icon: "chart" },
  { id: "logical", label: "Logique", ribbonLabel: "Logique", icon: "checkbox" },
  { id: "text", label: "Texte", ribbonLabel: "Texte", icon: "text" },
  { id: "date", label: "Date et heure", ribbonLabel: "Date", icon: "calendar" },
  { id: "lookup", label: "Recherche et reference", ribbonLabel: "Recherche", icon: "search" },
  { id: "conditional", label: "Conditionnelles", ribbonLabel: "Condition", icon: "filter" }
];
const SPREADSHEET_FORMULA_DEFINITIONS = [
  { name: "ABS", category: "math", syntax: "ABS(nombre)", description: "Renvoie la valeur absolue d'un nombre." },
  { name: "AND", category: "logical", syntax: "AND(condition1, [condition2], ...)", description: "Renvoie TRUE si toutes les conditions sont vraies." },
  { name: "AVERAGE", category: "statistical", syntax: "AVERAGE(nombre1, [nombre2], ...)", description: "Calcule la moyenne des nombres." },
  { name: "AVERAGEIF", category: "conditional", syntax: "AVERAGEIF(plage, critere, [plage_moyenne])", description: "Calcule la moyenne des cellules qui respectent un critere." },
  { name: "AVERAGEIFS", category: "conditional", syntax: "AVERAGEIFS(plage_moyenne, plage_criteres1, critere1, ...)", description: "Calcule une moyenne avec plusieurs criteres." },
  { name: "CONCAT", category: "text", syntax: "CONCAT(texte1, [texte2], ...)", description: "Assemble plusieurs valeurs texte." },
  { name: "COUNT", category: "statistical", syntax: "COUNT(valeur1, [valeur2], ...)", description: "Compte les valeurs numeriques." },
  { name: "COUNTA", category: "statistical", syntax: "COUNTA(valeur1, [valeur2], ...)", description: "Compte les cellules non vides." },
  { name: "COUNTBLANK", category: "statistical", syntax: "COUNTBLANK(plage)", description: "Compte les cellules vides dans une plage." },
  { name: "COUNTIF", category: "conditional", syntax: "COUNTIF(plage, critere)", description: "Compte les cellules qui respectent un critere." },
  { name: "COUNTIFS", category: "conditional", syntax: "COUNTIFS(plage_criteres1, critere1, ...)", description: "Compte les cellules avec plusieurs criteres." },
  { name: "DATE", category: "date", syntax: "DATE(annee, mois, jour)", description: "Construit une date a partir d'une annee, d'un mois et d'un jour." },
  { name: "FILTER", category: "lookup", syntax: "FILTER(tableau, inclure, [si_vide])", description: "Renvoie les lignes qui respectent une condition." },
  { name: "IF", category: "logical", syntax: "IF(test_logique, valeur_si_vrai, valeur_si_faux)", description: "Renvoie une valeur selon le resultat d'un test." },
  { name: "IFERROR", category: "logical", syntax: "IFERROR(valeur, valeur_si_erreur)", description: "Renvoie une valeur de secours si le calcul produit une erreur." },
  { name: "INDEX", category: "lookup", syntax: "INDEX(plage, no_ligne, [no_colonne])", description: "Renvoie une valeur a une position donnee dans une plage." },
  { name: "LEFT", category: "text", syntax: "LEFT(texte, [nb_caracteres])", description: "Extrait les caracteres de gauche d'un texte." },
  { name: "LEN", category: "text", syntax: "LEN(texte)", description: "Renvoie la longueur d'un texte." },
  { name: "LOWER", category: "text", syntax: "LOWER(texte)", description: "Convertit un texte en minuscules." },
  { name: "MATCH", category: "lookup", syntax: "MATCH(valeur_cherchee, plage, [type])", description: "Renvoie la position d'une valeur dans une plage." },
  { name: "MAX", category: "statistical", syntax: "MAX(nombre1, [nombre2], ...)", description: "Renvoie la plus grande valeur numerique." },
  { name: "MEDIAN", category: "statistical", syntax: "MEDIAN(nombre1, [nombre2], ...)", description: "Renvoie la mediane des nombres." },
  { name: "MID", category: "text", syntax: "MID(texte, debut, nb_caracteres)", description: "Extrait une partie d'un texte." },
  { name: "MIN", category: "statistical", syntax: "MIN(nombre1, [nombre2], ...)", description: "Renvoie la plus petite valeur numerique." },
  { name: "NOT", category: "logical", syntax: "NOT(condition)", description: "Inverse le resultat logique d'une condition." },
  { name: "NOW", category: "date", syntax: "NOW()", description: "Renvoie la date et l'heure actuelles." },
  { name: "OR", category: "logical", syntax: "OR(condition1, [condition2], ...)", description: "Renvoie TRUE si au moins une condition est vraie." },
  { name: "PRODUCT", category: "math", syntax: "PRODUCT(nombre1, [nombre2], ...)", description: "Multiplie les nombres." },
  { name: "RIGHT", category: "text", syntax: "RIGHT(texte, [nb_caracteres])", description: "Extrait les caracteres de droite d'un texte." },
  { name: "ROUND", category: "math", syntax: "ROUND(nombre, nb_decimales)", description: "Arrondit un nombre au nombre de decimales choisi." },
  { name: "ROUNDDOWN", category: "math", syntax: "ROUNDDOWN(nombre, nb_decimales)", description: "Arrondit un nombre vers le bas." },
  { name: "ROUNDUP", category: "math", syntax: "ROUNDUP(nombre, nb_decimales)", description: "Arrondit un nombre vers le haut." },
  { name: "SORT", category: "lookup", syntax: "SORT(tableau, [index_tri], [ordre_tri])", description: "Trie une plage ou un tableau." },
  { name: "SUBTOTAL", category: "math", syntax: "SUBTOTAL(no_fonction, ref1, [ref2], ...)", description: "Calcule un sous-total compatible avec les tableaux filtres." },
  { name: "SUM", category: "math", syntax: "SUM(nombre1, [nombre2], ...)", description: "Additionne les nombres." },
  { name: "SUMIF", category: "conditional", syntax: "SUMIF(plage, critere, [plage_somme])", description: "Additionne les cellules qui respectent un critere." },
  { name: "SUMIFS", category: "conditional", syntax: "SUMIFS(plage_somme, plage_criteres1, critere1, ...)", description: "Additionne les cellules avec plusieurs criteres." },
  { name: "TEXT", category: "text", syntax: "TEXT(valeur, format)", description: "Convertit une valeur en texte avec un format." },
  { name: "TODAY", category: "date", syntax: "TODAY()", description: "Renvoie la date du jour." },
  { name: "TRIM", category: "text", syntax: "TRIM(texte)", description: "Supprime les espaces inutiles d'un texte." },
  { name: "UNIQUE", category: "lookup", syntax: "UNIQUE(tableau)", description: "Renvoie les valeurs uniques d'une plage." },
  { name: "UPPER", category: "text", syntax: "UPPER(texte)", description: "Convertit un texte en majuscules." },
  { name: "VALUE", category: "text", syntax: "VALUE(texte)", description: "Convertit un texte en nombre." },
  { name: "VLOOKUP", category: "lookup", syntax: "VLOOKUP(valeur, table, no_colonne, [approx])", description: "Recherche une valeur dans la premiere colonne d'une table." },
  { name: "XLOOKUP", category: "lookup", syntax: "XLOOKUP(valeur, plage_recherche, plage_resultat)", description: "Recherche une valeur et renvoie le resultat associe." }
].sort((left, right) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" }));

const SPREADSHEET_FORMULA_HELP = {
  AVERAGEIF: {
    example: '=AVERAGEIF(A2:A20; ">10"; B2:B20)',
    arguments: [
      ["plage", "cellules ou la condition est verifiee."],
      ["critere", "condition a appliquer, par exemple \">10\" ou \"Nord\"."],
      ["plage_moyenne", "cellules a moyenner. Si omis, la plage est utilisee."]
    ]
  },
  AVERAGEIFS: {
    example: '=AVERAGEIFS(C2:C20; A2:A20; "Nord"; B2:B20; ">10")',
    arguments: [
      ["plage_moyenne", "cellules a moyenner."],
      ["plage_criteres1", "premiere plage ou tester un critere."],
      ["critere1", "condition associee a la premiere plage."]
    ]
  },
  COUNTIF: {
    example: '=COUNTIF(A2:A20; "Nord")',
    arguments: [
      ["plage", "cellules a compter."],
      ["critere", "condition a respecter."]
    ]
  },
  COUNTIFS: {
    example: '=COUNTIFS(A2:A20; "Nord"; B2:B20; ">10")',
    arguments: [
      ["plage_criteres1", "premiere plage ou tester un critere."],
      ["critere1", "condition associee a la premiere plage."]
    ]
  },
  DATE: {
    example: "=DATE(2026; 5; 5)",
    arguments: [
      ["annee", "annee de la date."],
      ["mois", "mois de la date."],
      ["jour", "jour du mois."]
    ]
  },
  FILTER: {
    example: '=FILTER(A2:C20; B2:B20="Nord")',
    arguments: [
      ["tableau", "plage a retourner."],
      ["inclure", "test logique qui choisit les lignes ou colonnes."],
      ["si_vide", "valeur a afficher si aucun resultat n'est trouve."]
    ]
  },
  IF: {
    example: '=IF(C2>B2; "Depassement du budget"; "Dans le budget")',
    arguments: [
      ["test_logique", "valeur ou expression dont le resultat peut etre VRAI ou FAUX."],
      ["valeur_si_vrai", "valeur renvoyee si test_logique est VRAI."],
      ["valeur_si_faux", "valeur renvoyee si test_logique est FAUX. Si omis, FAUX est renvoye."]
    ]
  },
  IFERROR: {
    example: '=IFERROR(A2/B2; "Erreur")',
    arguments: [
      ["valeur", "formule ou valeur a evaluer."],
      ["valeur_si_erreur", "resultat a renvoyer en cas d'erreur."]
    ]
  },
  INDEX: {
    example: "=INDEX(A2:C10; 3; 2)",
    arguments: [
      ["plage", "plage ou chercher la valeur."],
      ["no_ligne", "position de la ligne dans la plage."],
      ["no_colonne", "position de la colonne dans la plage."]
    ]
  },
  MATCH: {
    example: '=MATCH("Nord"; A2:A20; 0)',
    arguments: [
      ["valeur_cherchee", "valeur a trouver."],
      ["plage", "plage dans laquelle chercher."],
      ["type", "0 pour une correspondance exacte."]
    ]
  },
  SUBTOTAL: {
    example: "=SUBTOTAL(109; B2:B20)",
    arguments: [
      ["no_fonction", "code du calcul, par exemple 109 pour SOMME."],
      ["ref1", "premiere plage a calculer."],
      ["ref2", "plages supplementaires optionnelles."]
    ]
  },
  SUMIF: {
    example: '=SUMIF(A2:A20; "Nord"; B2:B20)',
    arguments: [
      ["plage", "cellules ou la condition est verifiee."],
      ["critere", "condition a appliquer."],
      ["plage_somme", "cellules a additionner. Si omis, la plage est utilisee."]
    ]
  },
  SUMIFS: {
    example: '=SUMIFS(C2:C20; A2:A20; "Nord"; B2:B20; ">10")',
    arguments: [
      ["plage_somme", "cellules a additionner."],
      ["plage_criteres1", "premiere plage ou tester un critere."],
      ["critere1", "condition associee a la premiere plage."]
    ]
  },
  TEXT: {
    example: '=TEXT(A2; "dd/mm/yyyy")',
    arguments: [
      ["valeur", "valeur a convertir en texte."],
      ["format", "format souhaite, par exemple \"0,00\" ou \"dd/mm/yyyy\"."]
    ]
  },
  VLOOKUP: {
    example: '=VLOOKUP(E2; A2:C20; 3; FALSE)',
    arguments: [
      ["valeur", "valeur a chercher."],
      ["table", "plage dont la premiere colonne contient la valeur."],
      ["no_colonne", "numero de la colonne a renvoyer."],
      ["approx", "FALSE pour une correspondance exacte."]
    ]
  },
  XLOOKUP: {
    example: '=XLOOKUP(E2; A2:A20; C2:C20)',
    arguments: [
      ["valeur", "valeur a chercher."],
      ["plage_recherche", "plage ou chercher la valeur."],
      ["plage_resultat", "plage contenant le resultat a renvoyer."]
    ]
  }
};

function normalizeSpreadsheetColor(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }
  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function normalizeSpreadsheetBorderSpec(border = {}) {
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return null;
  }
  const normalized = {};
  SPREADSHEET_BORDER_EDGES.forEach((edge) => {
    if (border[edge]) {
      normalized[edge] = true;
    }
  });
  if (!SPREADSHEET_BORDER_EDGES.some((edge) => normalized[edge])) {
    return null;
  }
  const color = normalizeSpreadsheetColor(border.color) || "#202124";
  const style = SPREADSHEET_BORDER_STYLE_CSS[border.style] ? border.style : "medium";
  return { ...normalized, color, style };
}

function normalizeSpreadsheetCellFormat(format = {}) {
  if (typeof format === "string") {
    return SPREADSHEET_NUMBER_FORMATS.has(format) ? { numberFormat: format } : {};
  }
  if (!format || typeof format !== "object" || Array.isArray(format)) {
    return {};
  }

  const normalized = {};
  const numberFormat = String(format.numberFormat || format.format || "");
  if (SPREADSHEET_NUMBER_FORMATS.has(numberFormat)) {
    normalized.numberFormat = numberFormat;
  }
  ["bold", "italic", "underline"].forEach((flag) => {
    if (format[flag]) {
      normalized[flag] = true;
    }
  });
  const horizontalAlign = String(format.horizontalAlign || format.align || "");
  if (SPREADSHEET_HORIZONTAL_ALIGNMENTS.has(horizontalAlign)) {
    normalized.horizontalAlign = horizontalAlign;
  }
  const verticalAlign = String(format.verticalAlign || "");
  if (SPREADSHEET_VERTICAL_ALIGNMENTS.has(verticalAlign)) {
    normalized.verticalAlign = verticalAlign;
  }
  const fontSize = Number(format.fontSize);
  if (Number.isFinite(fontSize)) {
    normalized.fontSize = Math.max(8, Math.min(36, Math.round(fontSize)));
  }
  const textColor = normalizeSpreadsheetColor(format.textColor);
  if (textColor) {
    normalized.textColor = textColor;
  }
  const fillColor = normalizeSpreadsheetColor(format.fillColor);
  if (fillColor) {
    normalized.fillColor = fillColor;
  }
  const border = normalizeSpreadsheetBorderSpec(format.border);
  if (border) {
    normalized.border = border;
  }
  return normalized;
}

function isSpreadsheetCellFormatEmpty(format = {}) {
  return Object.keys(normalizeSpreadsheetCellFormat(format)).length === 0;
}

function normalizeSpreadsheetProtectionRange(range = {}, index = 0) {
  const startRowIndex = Math.max(0, Number(range.startRowIndex ?? range.minRow ?? 0));
  const endRowIndex = Math.max(startRowIndex, Number(range.endRowIndex ?? range.maxRow ?? startRowIndex));
  const startColumnIndex = Math.max(0, Number(range.startColumnIndex ?? range.minColumn ?? 0));
  const endColumnIndex = Math.max(startColumnIndex, Number(range.endColumnIndex ?? range.maxColumn ?? startColumnIndex));
  return {
    id: String(range.id || `protected-range-${index + 1}`),
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
    label: String(range.label || "")
  };
}

function normalizeSpreadsheetProtectionRanges(ranges = []) {
  if (!Array.isArray(ranges)) {
    return [];
  }
  return ranges
    .filter((range) => range && typeof range === "object")
    .map((range, index) => normalizeSpreadsheetProtectionRange(range, index));
}

function normalizeSpreadsheetNote(note = {}) {
  if (typeof note === "string") {
    const text = String(note || "").trim();
    return text ? { text, kind: "note" } : null;
  }
  if (!note || typeof note !== "object" || Array.isArray(note)) {
    return null;
  }
  const text = String(note.text || note.note || note.comment || "").trim();
  if (!text) {
    return null;
  }
  return {
    text,
    kind: String(note.kind || note.type || "note"),
    author: String(note.author || "")
  };
}

function normalizeSpreadsheetNotes(notes = {}) {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(notes)
      .map(([key, value]) => [key, normalizeSpreadsheetNote(value)])
      .filter(([, value]) => Boolean(value))
  );
}

function normalizeSpreadsheetDataValidationRule(rule = {}) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const rawType = String(rule.type || rule.kind || "list").trim();
  const type = rawType.toLowerCase() === "textlength" ? "textLength" : rawType.toLowerCase();
  if (!["list", "whole", "decimal", "date", "textLength"].includes(type)) {
    return null;
  }
  const operator = ["between", "notBetween", "equal", "notEqual", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual"]
    .includes(String(rule.operator || "between"))
    ? String(rule.operator || "between")
    : "between";
  return {
    type,
    operator,
    allowBlank: rule.allowBlank !== false,
    showDropdown: rule.showDropdown !== false,
    source: String(rule.source || rule.values || ""),
    minimum: String(rule.minimum ?? rule.min ?? ""),
    maximum: String(rule.maximum ?? rule.max ?? ""),
    message: String(rule.message || rule.error || "")
  };
}

function normalizeSpreadsheetDataValidations(validations = {}) {
  if (!validations || typeof validations !== "object" || Array.isArray(validations)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(validations)
      .map(([key, value]) => [String(key), normalizeSpreadsheetDataValidationRule(value)])
      .filter(([, value]) => Boolean(value))
  );
}

function normalizeSpreadsheetFormulaName(name = "") {
  const text = String(name || "").trim().toUpperCase();
  return SPREADSHEET_FORMULA_NAME_ALIASES[text] || text;
}

function isSpreadsheetBuiltinFormulaName(name = "") {
  return SPREADSHEET_BUILTIN_FORMULA_NAMES.has(normalizeSpreadsheetFormulaName(name));
}

function isSpreadsheetDefinedNameValid(name = "") {
  const text = String(name || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) {
    return false;
  }
  if (/^\$?[A-Z]+\$?\d+$/i.test(text) || /^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(text)) {
    return false;
  }
  return !isSpreadsheetBuiltinFormulaName(text);
}

function normalizeSpreadsheetTableName(value = "Table") {
  const compact = String(value || "Table")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.]/g, "");
  const candidate = /^[A-Za-z_]/.test(compact) ? compact : `Table${compact}`;
  const fallback = candidate || "Table";
  return isSpreadsheetBuiltinFormulaName(fallback) ? `${fallback}_Table` : fallback;
}

function normalizeSpreadsheetNamedRange(namedRange = {}, index = 0) {
  if (!namedRange || typeof namedRange !== "object" || Array.isArray(namedRange)) {
    return null;
  }
  const name = String(namedRange.name || namedRange.label || "").trim();
  const range = String(namedRange.range || namedRange.ref || namedRange.address || "")
    .trim()
    .replace(/^=/, "");
  if (!isSpreadsheetDefinedNameValid(name) || !range) {
    return null;
  }
  const sheetId = String(namedRange.sheetId || namedRange.sheet || "").trim();
  return {
    id: String(namedRange.id || `named-range-${index + 1}`),
    name,
    range,
    sheetId,
    scope: String(namedRange.scope || (sheetId ? "sheet" : "workbook")),
    comment: String(namedRange.comment || namedRange.description || "")
  };
}

function normalizeSpreadsheetNamedRanges(namedRanges = []) {
  if (!Array.isArray(namedRanges)) {
    return [];
  }
  const seen = new Set();
  return namedRanges
    .map((namedRange, index) => normalizeSpreadsheetNamedRange(namedRange, index))
    .filter((namedRange) => {
      if (!namedRange) {
        return false;
      }
      const key = `${namedRange.sheetId || "workbook"}:${namedRange.name.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeSpreadsheetConditionalFormatRule(rule = {}, index = 0) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const type = String(rule.type || rule.kind || "greaterThan").trim();
  if (!SPREADSHEET_CONDITIONAL_FORMAT_TYPES.has(type)) {
    return null;
  }
  const range = String(rule.range || rule.ref || "").trim();
  if (!range) {
    return null;
  }
  const fillColor = rule.fillColor === ""
    ? ""
    : normalizeSpreadsheetColor(rule.fillColor || rule.color || "") || "#fff2cc";
  const textColor = normalizeSpreadsheetColor(rule.textColor || "") || "#202124";
  return {
    id: String(rule.id || `conditional-format-${index + 1}`),
    type,
    range,
    value1: String(rule.value1 ?? rule.value ?? ""),
    value2: String(rule.value2 ?? ""),
    fillColor,
    textColor,
    bold: Boolean(rule.bold),
    label: String(rule.label || "")
  };
}

function normalizeSpreadsheetConditionalFormats(rules = []) {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules
    .map((rule, index) => normalizeSpreadsheetConditionalFormatRule(rule, index))
    .filter(Boolean);
}

function normalizeSpreadsheetStructureBounds(source = {}) {
  const startRowIndex = Math.max(0, Number(source.startRowIndex ?? source.minRow ?? 0));
  const endRowIndex = Math.max(startRowIndex, Number(source.endRowIndex ?? source.maxRow ?? startRowIndex));
  const startColumnIndex = Math.max(0, Number(source.startColumnIndex ?? source.minColumn ?? 0));
  const endColumnIndex = Math.max(startColumnIndex, Number(source.endColumnIndex ?? source.maxColumn ?? startColumnIndex));
  return { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex };
}

function normalizeSpreadsheetTable(table = {}, index = 0) {
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    return null;
  }
  const bounds = normalizeSpreadsheetStructureBounds(table);
  return {
    id: String(table.id || `sheet-table-${index + 1}`),
    name: String(table.name || table.title || `Table${index + 1}`).trim() || `Table${index + 1}`,
    ...bounds,
    style: SPREADSHEET_TABLE_STYLES.includes(String(table.style || "").toLowerCase())
      ? String(table.style || "").toLowerCase()
      : "blue",
    showHeaderRow: table.showHeaderRow !== false,
    showBandedRows: table.showBandedRows !== false,
    showBandedColumns: Boolean(table.showBandedColumns),
    showFirstColumn: Boolean(table.showFirstColumn),
    showLastColumn: Boolean(table.showLastColumn),
    showFilterButtons: table.showFilterButtons !== false,
    showTotalRow: Boolean(table.showTotalRow),
    totalFunctions:
      table.totalFunctions && typeof table.totalFunctions === "object" && !Array.isArray(table.totalFunctions)
        ? Object.fromEntries(
            Object.entries(table.totalFunctions).map(([key, value]) => [
              String(key),
              SPREADSHEET_TABLE_TOTAL_FUNCTIONS.has(String(value || "").toLowerCase())
                ? String(value || "").toLowerCase()
                : "sum"
            ])
          )
        : {}
  };
}

function normalizeSpreadsheetTables(tables = []) {
  if (!Array.isArray(tables)) {
    return [];
  }
  return tables
    .map((table, index) => normalizeSpreadsheetTable(table, index))
    .filter(Boolean);
}

function normalizeSpreadsheetTableFilters(tableFilters = {}) {
  if (!tableFilters || typeof tableFilters !== "object" || Array.isArray(tableFilters)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(tableFilters)
      .map(([key, filter]) => {
        if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
          return null;
        }
        const selectedValues = Array.isArray(filter.selectedValues)
          ? filter.selectedValues.map((value) => String(value ?? ""))
          : [];
        return [
          String(key),
          {
            query: String(filter.query || ""),
            active: Boolean(filter.active),
            selectedValues: Array.from(new Set(selectedValues))
          }
        ];
      })
      .filter(Boolean)
  );
}

function normalizeSpreadsheetPivotTable(pivotTable = {}, index = 0) {
  if (!pivotTable || typeof pivotTable !== "object" || Array.isArray(pivotTable)) {
    return null;
  }
  const aggregate = String(pivotTable.aggregate || pivotTable.summary || "sum").toLowerCase();
  return {
    id: String(pivotTable.id || `sheet-pivot-${index + 1}`),
    name: String(pivotTable.name || pivotTable.title || `PivotTable${index + 1}`).trim() || `PivotTable${index + 1}`,
    sourceSheetId: String(pivotTable.sourceSheetId || pivotTable.sheetId || ""),
    sourceTableId: String(pivotTable.sourceTableId || pivotTable.tableId || ""),
    sourceRange: String(pivotTable.sourceRange || pivotTable.range || ""),
    renderedRange: String(pivotTable.renderedRange || ""),
    rowField: String(pivotTable.rowField || ""),
    columnField: String(pivotTable.columnField || ""),
    valueField: String(pivotTable.valueField || ""),
    aggregate: ["sum", "count", "average", "min", "max"].includes(aggregate) ? aggregate : "sum",
    anchorRowIndex: Math.max(0, Number(pivotTable.anchorRowIndex ?? pivotTable.rowIndex ?? 0)),
    anchorColumnIndex: Math.max(0, Number(pivotTable.anchorColumnIndex ?? pivotTable.columnIndex ?? 0)),
    lastRefreshedAt: String(pivotTable.lastRefreshedAt || "")
  };
}

function normalizeSpreadsheetPivotTables(pivotTables = []) {
  if (!Array.isArray(pivotTables)) {
    return [];
  }
  return pivotTables
    .map((pivotTable, index) => normalizeSpreadsheetPivotTable(pivotTable, index))
    .filter(Boolean);
}

const SPREADSHEET_CHART_GALLERY_SECTIONS = [
  {
    label: "Columns",
    items: [
      { kind: "column", label: "Clustered column" },
      { kind: "stacked-column", label: "Stacked column" },
      { kind: "percent-column", label: "100% stacked column" }
    ]
  },
  {
    label: "Lines",
    items: [
      { kind: "line", label: "Line" },
      { kind: "line-markers", label: "Line with markers" },
      { kind: "combo", label: "Combo" }
    ]
  },
  {
    label: "Scatter",
    items: [
      { kind: "scatter", label: "Scatter" },
      { kind: "bubble", label: "Bubble" },
      { kind: "radar", label: "Radar" }
    ]
  },
  {
    label: "Pie",
    items: [
      { kind: "pie", label: "Pie" },
      { kind: "donut", label: "Donut" },
      { kind: "sunburst", label: "Sunburst" }
    ]
  },
  {
    label: "Bars",
    items: [
      { kind: "bar", label: "Clustered bar" },
      { kind: "stacked-bar", label: "Stacked bar" },
      { kind: "percent-bar", label: "100% stacked bar" }
    ]
  },
  {
    label: "Statistics",
    items: [
      { kind: "histogram", label: "Histogram" },
      { kind: "box", label: "Box plot" },
      { kind: "waterfall", label: "Waterfall" }
    ]
  },
  {
    label: "Areas",
    items: [
      { kind: "area", label: "Area" },
      { kind: "stacked-area", label: "Stacked area" },
      { kind: "funnel", label: "Funnel" }
    ]
  },
  {
    label: "Hierarchy",
    items: [
      { kind: "treemap", label: "Treemap" },
      { kind: "sunburst", label: "Sunburst" }
    ]
  }
];

const SPREADSHEET_CHART_TYPE_MAP = new Map(
  SPREADSHEET_CHART_GALLERY_SECTIONS.flatMap((section) =>
    section.items.map((item) => [
      item.kind,
      {
        ...item,
        sectionLabel: section.label
      }
    ])
  )
);

function normalizeSpreadsheetChartKind(kind = "") {
  const normalized = String(kind || "").trim().toLowerCase();
  return SPREADSHEET_CHART_TYPE_MAP.has(normalized) ? normalized : "column";
}

function getSpreadsheetChartTypeConfig(kind = "") {
  return SPREADSHEET_CHART_TYPE_MAP.get(normalizeSpreadsheetChartKind(kind)) || SPREADSHEET_CHART_TYPE_MAP.get("column");
}

function normalizeSpreadsheetChartPoint(point = {}, index = 0) {
  if (typeof point === "string" || typeof point === "number") {
    return {
      label: `Point ${index + 1}`,
      value: String(point ?? ""),
      xValue: "",
      yValue: String(point ?? ""),
      sizeValue: "",
      secondaryValue: ""
    };
  }
  return {
    label: String(point.label || point.name || `Point ${index + 1}`),
    value: String(point.value ?? point.y ?? ""),
    xValue: String(point.xValue ?? point.x ?? ""),
    yValue: String(point.yValue ?? point.y ?? point.value ?? ""),
    sizeValue: String(point.sizeValue ?? point.size ?? point.z ?? ""),
    secondaryValue: String(point.secondaryValue ?? point.secondary ?? "")
  };
}

function normalizeSpreadsheetChartMetric(value = 0, fallback = 0, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(numericValue, max));
}

function getDefaultSpreadsheetChartFrame(index = 0) {
  return {
    x: 212 + ((index % 2) * 432),
    y: 52 + (Math.floor(index / 2) * 296),
    width: 432,
    height: 284
  };
}

function normalizeSpreadsheetCharts(charts = []) {
  if (!Array.isArray(charts)) {
    return [];
  }
  return charts
    .filter((chart) => chart && typeof chart === "object")
    .map((chart, index) => {
      const defaultFrame = getDefaultSpreadsheetChartFrame(index);
      return {
        id: String(chart.id || `sheet-chart-${index + 1}`),
        title: String(chart.title || `Chart ${index + 1}`),
        kind: normalizeSpreadsheetChartKind(chart.kind),
        range: String(chart.range || ""),
        sourceTableId: String(chart.sourceTableId || chart.tableId || ""),
        seriesName: String(chart.seriesName || chart.series || ""),
        secondarySeriesName: String(chart.secondarySeriesName || chart.secondarySeries || ""),
        x: normalizeSpreadsheetChartMetric(chart.x ?? chart.left, defaultFrame.x, { min: 16, max: 100000 }),
        y: normalizeSpreadsheetChartMetric(chart.y ?? chart.top, defaultFrame.y, { min: 16, max: 100000 }),
        width: normalizeSpreadsheetChartMetric(chart.width, defaultFrame.width, { min: 280, max: 1200 }),
        height: normalizeSpreadsheetChartMetric(chart.height, defaultFrame.height, { min: 180, max: 900 }),
        showLegend: chart.showLegend !== false,
        points: Array.isArray(chart.points) ? chart.points.map((point, pointIndex) => normalizeSpreadsheetChartPoint(point, pointIndex)) : []
      };
    });
}

function normalizeSpreadsheetSparkline(config = {}) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }
  const range = String(config.range || "").trim();
  if (!range) {
    return null;
  }
  return {
    range,
    type: ["line", "column"].includes(String(config.type || "").toLowerCase())
      ? String(config.type || "").toLowerCase()
      : "line",
    color: normalizeSpreadsheetColor(config.color) || "#1a73e8"
  };
}

function normalizeSpreadsheetSparklines(sparklines = {}) {
  if (!sparklines || typeof sparklines !== "object" || Array.isArray(sparklines)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(sparklines)
      .map(([key, value]) => [key, normalizeSpreadsheetSparkline(value)])
      .filter(([, value]) => Boolean(value))
  );
}

function normalizeSpreadsheetSlicers(slicers = []) {
  if (!Array.isArray(slicers)) {
    return [];
  }
  return slicers
    .filter((slicer) => slicer && typeof slicer === "object" && Number.isInteger(Number(slicer.columnIndex)))
    .map((slicer, index) => ({
      id: String(slicer.id || `sheet-slicer-${index + 1}`),
      title: String(slicer.title || slicer.label || `Slicer ${index + 1}`),
      columnIndex: Math.max(0, Number(slicer.columnIndex)),
      selectedValue: String(slicer.selectedValue || "")
    }));
}

function getSpreadsheetHistoryKey(workObject = null, filePath = "") {
  const objectKey = workObject?.id || workObject?.objectId || workObject?.title || "workspace";
  const pathKey = normalizePath(filePath || workObject?.primaryFile || "sheet");
  return `${objectKey}::${pathKey}`;
}

function clampSpreadsheetIndex(value = 0, max = 0) {
  const parsed = Number(value);
  return Math.max(0, Math.min(Number.isFinite(parsed) ? Math.trunc(parsed) : 0, Math.max(0, max)));
}

function normalizeSpreadsheetSelectionState(selection = {}, rowCount = 1, columnCount = 1) {
  const maxRowIndex = Math.max(0, rowCount - 1);
  const maxColumnIndex = Math.max(0, columnCount - 1);
  const active = selection?.activeSelection || {};
  const range = selection?.selectionRange || {};
  const activeSelection = {
    rowIndex: clampSpreadsheetIndex(active.rowIndex, maxRowIndex),
    columnIndex: clampSpreadsheetIndex(active.columnIndex, maxColumnIndex)
  };

  return {
    activeSelection,
    selectionRange: {
      startRowIndex: clampSpreadsheetIndex(range.startRowIndex ?? activeSelection.rowIndex, maxRowIndex),
      startColumnIndex: clampSpreadsheetIndex(range.startColumnIndex ?? activeSelection.columnIndex, maxColumnIndex),
      endRowIndex: clampSpreadsheetIndex(range.endRowIndex ?? activeSelection.rowIndex, maxRowIndex),
      endColumnIndex: clampSpreadsheetIndex(range.endColumnIndex ?? activeSelection.columnIndex, maxColumnIndex)
    }
  };
}

function saveSpreadsheetSelectionState(historyKey = "", selection = {}, rowCount = 1, columnCount = 1) {
  spreadsheetSelectionStore.set(
    historyKey || "workspace::sheet",
    normalizeSpreadsheetSelectionState(selection, rowCount, columnCount)
  );
}

function getSpreadsheetHistoryState(historyKey = "", currentSnapshot = {}) {
  const key = historyKey || "workspace::sheet";
  let state = spreadsheetHistoryStore.get(key);
  if (!state) {
    state = {
      past: [],
      future: [],
      current: cloneSpreadsheetSnapshot(currentSnapshot)
    };
    spreadsheetHistoryStore.set(key, state);
    return state;
  }

  if (!areSpreadsheetSnapshotsEqual(state.current, currentSnapshot)) {
    state.past = [];
    state.future = [];
    state.current = cloneSpreadsheetSnapshot(currentSnapshot);
  }

  return state;
}

function registerSpreadsheetShortcutHandler(historyKey = "", previewShell = null, handlers = null) {
  const key = historyKey || "workspace::sheet";
  spreadsheetShortcutCleanupStore.get(key)?.();
  spreadsheetShortcutCleanupStore.delete(key);

  const normalizedHandlers =
    typeof handlers === "function"
      ? { keydown: handlers }
      : handlers && typeof handlers === "object"
        ? handlers
        : {};
  const registeredHandlers = Object.entries(normalizedHandlers).filter(
    ([, handler]) => typeof handler === "function"
  );

  if (!previewShell || !registeredHandlers.length) {
    return;
  }

  registeredHandlers.forEach(([eventName, handler]) => {
    document.addEventListener(eventName, handler, true);
  });
  spreadsheetShortcutCleanupStore.set(key, () => {
    registeredHandlers.forEach(([eventName, handler]) => {
      document.removeEventListener(eventName, handler, true);
    });
  });
}

function getDocumentWorkspacePreviewProfile(workObject = null) {
  const familyId = workObject?.workspaceFamilyId || "";
  const profileMap = {
    document_knowledge: {
      workspaceLabel: "Knowledge workspace",
      tabs: ["Page", "Outline", "Knowledge"],
      contextLabelA: "Knowledge posture",
      contextValueA: "Structured knowledge",
      contextLabelB: "Primary takeaway",
      ribbon: ["Knowledge", "Reading", "Reusable", "Project linked"]
    },
    project_management: {
      workspaceLabel: "Project management workspace",
      tabs: ["Board", "Tracks", "Reading"],
      contextLabelA: "Delivery posture",
      contextValueA: "Project tracks",
      contextLabelB: "Current move",
      ribbon: ["Project", "Tracks", "Dependencies", "Project linked"]
    },
    strategy_planning: {
      workspaceLabel: "Strategy workspace",
      tabs: ["Plan", "Themes", "Decision"],
      contextLabelA: "Planning posture",
      contextValueA: "Strategic board",
      contextLabelB: "Current thesis",
      ribbon: ["Strategy", "Themes", "Tradeoffs", "Project linked"]
    },
    file_storage: {
      workspaceLabel: "Storage workspace",
      tabs: ["Drive", "Folders", "Reading"],
      contextLabelA: "Storage posture",
      contextValueA: "Folder index",
      contextLabelB: "Current asset group",
      ribbon: ["Storage", "Folders", "Access", "Project linked"]
    },
    testing_qa: {
      workspaceLabel: "QA workspace",
      tabs: ["Runbook", "Suites", "Checks"],
      contextLabelA: "QA posture",
      contextValueA: "Test coverage",
      contextLabelB: "Current scenario",
      ribbon: ["QA", "Suites", "Checks", "Project linked"]
    },
    web_cms: {
      workspaceLabel: "Web & CMS workspace",
      tabs: ["Pages", "Site map", "Reading"],
      contextLabelA: "Publishing posture",
      contextValueA: "Site inventory",
      contextLabelB: "Current page",
      ribbon: ["CMS", "Pages", "Publishing", "Project linked"]
    }
  };

  return profileMap[familyId] || {
    workspaceLabel: "Document workspace",
    tabs: ["Page", "Outline", "Reading"],
    contextLabelA: "Reading posture",
    contextValueA: "Structured page",
    contextLabelB: "Primary takeaway",
    ribbon: ["Page", "Reading", "Narrative", "Project linked"]
  };
}

function getDatasetWorkspacePreviewProfile(workObject = null) {
  const familyId = workObject?.workspaceFamilyId || "";
  const profileMap = {
    data_spreadsheet: {
      workspaceLabel: "Spreadsheet workspace",
      primaryTab: "Sheet 1",
      secondaryTab: "Summary",
      formulaLabel: "Sheet fields",
      contextLabelA: "Sheet profile",
      contextValueA: "Working sheet",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Sheet 1"
    },
    hr: {
      workspaceLabel: "HR workspace",
      primaryTab: "Employees",
      secondaryTab: "Summary",
      formulaLabel: "People fields",
      contextLabelA: "People profile",
      contextValueA: "Roster board",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Employees"
    },
    finance: {
      workspaceLabel: "Finance workspace",
      primaryTab: "Budget",
      secondaryTab: "Summary",
      formulaLabel: "Budget fields",
      contextLabelA: "Budget profile",
      contextValueA: "Finance sheet",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Budget"
    },
    crm_sales: {
      workspaceLabel: "CRM workspace",
      primaryTab: "Pipeline",
      secondaryTab: "Summary",
      formulaLabel: "Pipeline fields",
      contextLabelA: "Pipeline profile",
      contextValueA: "Sales board",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Pipeline"
    },
    knowledge_graph: {
      workspaceLabel: "Knowledge graph workspace",
      primaryTab: "Entities",
      secondaryTab: "Relations",
      formulaLabel: "Entity fields",
      contextLabelA: "Graph profile",
      contextValueA: "Schema table",
      contextLabelB: "Primary fields",
      ribbonPrefix: "Entities"
    }
  };

  return profileMap[familyId] || profileMap.data_spreadsheet;
}

function toSurfaceLabel(surfaceId = "") {
  switch (String(surfaceId || "")) {
    case "live":
      return "Live";
    case "dashboard":
      return "Dashboard";
    case "benchmark":
      return "Benchmark";
    case "campaign":
      return "Campaign";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "workflow":
      return "Workflow";
    case "design":
      return "Design";
    case "preview":
    case "app":
      return "Preview";
    case "edit":
      return "Modify";
    case "structure":
      return "Outline";
    case "data":
      return "Data";
    case "code":
      return "Code";
    case "media":
      return "Media";
    case "presentation":
      return "Slides";
    case "overview":
      return "Overview";
    default:
      return String(surfaceId || "Preview");
  }
}

function appendInlineContent(element, text = "") {
  element.appendChild(createTextFragment(text));
}

function normalizeText(value = "") {
  return String(value || "").replace(/\r\n/g, "\n");
}

function buildWorkObjectAssetUrl(workObject = null) {
  if (!workObject?.id) {
    return "";
  }
  if (workObject.previewAssetUrl) {
    return workObject.previewAssetUrl;
  }
  const targetPath = workObject.previewAssetPath || workObject.primaryFile || "";
  if (!targetPath) {
    return "";
  }
  return `/api/work-objects/${encodeURIComponent(String(workObject.id))}/assets/${normalizePath(targetPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function isRichDocumentHtml(value = "") {
  return /<\s*(h1|h2|h3|h4|p|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|hr|img|figure|figcaption|div)\b/i.test(
    normalizeText(value)
  );
}

function extractRichDocumentHeadings(value = "") {
  if (!isRichDocumentHtml(value)) {
    return [];
  }
  const template = document.createElement("template");
  template.innerHTML = normalizeText(value);
  return Array.from(template.content.querySelectorAll("h1, h2, h3, h4")).map((node, index) => ({
    id: node.id || `heading-${index + 1}`,
    label: String(node.textContent || "").trim() || `Section ${index + 1}`
  }));
}

function safeJsonParse(value = "") {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

function getLineOffsets(lines = []) {
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  return offsets;
}

function createWholeFileSection(text = "") {
  return {
    id: "whole-file",
    title: "Whole file",
    block: text,
    level: 1,
    start: 0,
    bodyStart: 0,
    end: text.length
  };
}

function buildCodeBlocks(text = "", startOffset = 0) {
  const normalized = normalizeText(text);
  if (!normalized.trim()) {
    return [];
  }

  const blocks = [];
  let start = 0;
  let index = 0;
  const blockRegex = /\n{2,}/g;
  let match;

  while ((match = blockRegex.exec(normalized)) !== null) {
    const chunk = normalized.slice(start, match.index).trim();
    if (chunk) {
      const rawStart = normalized.indexOf(chunk, start);
      blocks.push({
        id: `block-${index + 1}`,
        title: chunk.split("\n")[0].slice(0, 72) || `Block ${index + 1}`,
        kind: "block",
        preview: chunk.slice(0, 140),
        block: chunk,
        start: startOffset + rawStart,
        end: startOffset + rawStart + chunk.length
      });
      index += 1;
    }
    start = match.index + match[0].length;
  }

  const tail = normalized.slice(start).trim();
  if (tail) {
    const rawStart = normalized.indexOf(tail, start);
    blocks.push({
      id: `block-${index + 1}`,
      title: tail.split("\n")[0].slice(0, 72) || `Block ${index + 1}`,
      kind: "block",
      preview: tail.slice(0, 140),
      block: tail,
      start: startOffset + rawStart,
      end: startOffset + rawStart + tail.length
    });
  }

  return blocks.length ? blocks : [{
    id: "block-1",
    title: "Whole file",
    kind: "block",
    preview: normalized.slice(0, 140),
    block: normalized,
    start: startOffset,
    end: startOffset + normalized.length
  }];
}

export function isMarkdownPath(filePath = "") {
  return /\.(md|markdown|txt)$/i.test(filePath);
}

export function isJsonPath(filePath = "") {
  return /\.json$/i.test(filePath);
}

export function isCsvPath(filePath = "") {
  return /\.(csv|tsv)$/i.test(filePath);
}

export function isCodePath(filePath = "") {
  return /\.(js|mjs|cjs|ts|tsx|jsx|css|html|yml|yaml)$/i.test(filePath);
}

export function isImagePath(filePath = "") {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath);
}

export function isAudioPath(filePath = "") {
  return /\.(mp3|wav|ogg|m4a)$/i.test(filePath);
}

export function isVideoPath(filePath = "") {
  return /\.(mp4|webm|mov)$/i.test(filePath);
}

export function isHtmlPreviewPath(filePath = "") {
  return /\.(html|svg)$/i.test(filePath);
}

export function deriveWorkspaceSections(content = "", filePath = "") {
  const text = normalizeText(content);

  if (!text.trim()) {
    return [];
  }

  if (isRichDocumentHtml(text)) {
    const template = document.createElement("template");
    template.innerHTML = text;
    const headings = Array.from(template.content.querySelectorAll("h1, h2, h3, h4"));
    if (!headings.length) {
      return [createWholeFileSection(text)];
    }
    return headings.map((heading, index) => ({
      id: heading.id || `section-${index + 1}`,
      title: String(heading.textContent || "").trim() || `Section ${index + 1}`,
      block: heading.outerHTML,
      level: Number(heading.tagName.slice(1)) || 1,
      start: 0,
      bodyStart: 0,
      end: text.length
    }));
  }

  if (!isMarkdownPath(filePath)) {
    return [createWholeFileSection(text)];
  }

  const lines = text.split("\n");
  const offsets = getLineOffsets(lines);
  const headingIndexes = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (/^#{1,3}\s+/.test(lines[index].trim())) {
      headingIndexes.push(index);
    }
  }

  if (!headingIndexes.length) {
    return [createWholeFileSection(text)];
  }

  return headingIndexes.map((startIndex, position) => {
    const nextIndex = headingIndexes[position + 1] ?? lines.length;
    const blockStart = offsets[startIndex];
    const blockEnd = nextIndex < offsets.length ? offsets[nextIndex] - 1 : text.length;
    const headingLine = lines[startIndex].trim();
    const bodyStart = blockStart + lines[startIndex].length + 1;
    const block = lines.slice(startIndex, nextIndex).join("\n").trim();
    return {
      id: `section-${position + 1}`,
      title: headingLine.replace(/^#{1,3}\s+/, "").trim(),
      block,
      level: (headingLine.match(/^#{1,3}/)?.[0] || "#").length,
      start: blockStart,
      bodyStart: Math.min(bodyStart, blockEnd),
      end: blockEnd
    };
  });
}

export function applyWorkspaceSectionEdit(
  originalContent = "",
  filePath = "",
  sectionId = "",
  updatedBlock = ""
) {
  const normalized = normalizeText(originalContent);
  if (!sectionId || sectionId === "whole-file" || !isMarkdownPath(filePath)) {
    return String(updatedBlock || "");
  }

  const sections = deriveWorkspaceSections(normalized, filePath);
  const selected = sections.find((section) => section.id === sectionId);
  if (!selected) {
    return String(updatedBlock || "");
  }

  return `${normalized.slice(0, selected.start)}${String(updatedBlock || "").trim()}${normalized.slice(selected.end)}`;
}

export function deriveWorkspaceBlocks(
  content = "",
  filePath = "",
  sectionId = "",
  sections = []
) {
  const normalized = normalizeText(content);
  if (!normalized.trim()) {
    return [];
  }

  if (sectionId && sectionId !== "whole-file") {
    const selectedSection =
      sections.find((section) => section.id === sectionId) ||
      deriveWorkspaceSections(normalized, filePath).find((section) => section.id === sectionId);

    if (!selectedSection) {
      return [];
    }

    const sectionBody = normalized.slice(selectedSection.bodyStart, selectedSection.end).trim();
    if (!sectionBody) {
      return [];
    }
    return buildCodeBlocks(sectionBody, normalized.indexOf(sectionBody, selectedSection.bodyStart)).map(
      (block, index) => ({
        ...block,
        id: `section-block-${index + 1}`,
        kind: /(^[-*]\s)|(^\d+\.\s)/m.test(block.block) ? "list" : "paragraph"
      })
    );
  }

  if (isMarkdownPath(filePath)) {
    return buildCodeBlocks(normalized, 0).map((block, index) => ({
      ...block,
      id: `block-${index + 1}`,
      kind: /(^[-*]\s)|(^\d+\.\s)/m.test(block.block) ? "list" : "paragraph"
    }));
  }

  if (isJsonPath(filePath)) {
    try {
      const parsed = JSON.parse(normalized);
      return Object.keys(parsed).map((key, index) => ({
        id: `json-block-${index + 1}`,
        title: key,
        kind: "json",
        preview: JSON.stringify(parsed[key]).slice(0, 140),
        block: JSON.stringify(parsed[key], null, 2),
        start: normalized.indexOf(`"${key}"`),
        end: normalized.indexOf(`"${key}"`) + JSON.stringify(parsed[key], null, 2).length
      }));
    } catch {
      return buildCodeBlocks(normalized, 0);
    }
  }

  return buildCodeBlocks(normalized, 0).map((block, index) => ({
    ...block,
    id: `code-block-${index + 1}`,
    kind: "code"
  }));
}

export function applyWorkspaceBlockEdit(
  originalContent = "",
  filePath = "",
  sectionId = "",
  blockId = "",
  updatedBlock = "",
  sections = []
) {
  if (!blockId) {
    return String(updatedBlock || "");
  }

  const normalized = normalizeText(originalContent);
  const blocks = deriveWorkspaceBlocks(normalized, filePath, sectionId, sections);
  const selected = blocks.find((block) => block.id === blockId);

  if (!selected) {
    return normalized;
  }

  return `${normalized.slice(0, selected.start)}${String(updatedBlock || "").trim()}${normalized.slice(selected.end)}`;
}

export function matchesWorkspaceDimension(filePath = "", dimension = "") {
  const normalizedPath = normalizePath(filePath).toLowerCase();
  const normalizedDimension = String(dimension || "").toLowerCase();

  if (!normalizedDimension) {
    return true;
  }

  if (normalizedDimension === "structure") {
    return /(readme|project\.blueprint|hydria\.manifest|experience\/overview|package\.json|app\.config\.json)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "logic") {
    return /(logic\/|src\/|architecture|server\.js|app\.js|index\.js|package\.json|app\.config\.json)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "text" || normalizedDimension === "narrative") {
    return /(content\/|brief|overview|story|roadmap|source-work-object|readme)/.test(
      normalizedPath
    );
  }

  if (normalizedDimension === "visual") {
    return /(studio\/|visual|storyboard|presentation|slides)/.test(normalizedPath);
  }

  if (normalizedDimension === "audio") {
    return /(audio\/|track|music|sound|voice)/.test(normalizedPath);
  }

  if (normalizedDimension === "data") {
    return /\.(json|csv|xlsx)$/.test(normalizedPath) || /data\//.test(normalizedPath);
  }

  return true;
}

function renderMarkdownPreview(
  container,
  content = "",
  sections = [],
  selectedSectionId = "",
  onSectionFocus = null,
  onInlineEdit = null,
  workObject = null,
  projectWorkObjects = [],
  onProjectObjectSelect = null
) {
  const profile = getDocumentWorkspacePreviewProfile(workObject);
  const isDocsClone = workObject?.workspaceFamilyId === "document_knowledge";
  const usesRichDocument = isDocsClone && isRichDocumentHtml(content);
  let activeEditable = null;
  let docsMenuPanel = null;
  let docsMenuButtons = [];
  const normalized = normalizeText(content);
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const headings = usesRichDocument
    ? extractRichDocumentHeadings(normalized).map((entry) => `# ${entry.label}`)
    : blocks.filter((block) => /^#{1,3}\s+/.test(block));
  const listCount = blocks.filter((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length && lines.every((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line));
  }).length;
  const insightGrid = createPreviewInsightGrid([
    { label: "Sections", value: headings.length || 1, meta: headings[0]?.replace(/^#{1,3}\s+/, "") || "Structured document" },
    { label: "Words", value: previewWordCount(normalized), meta: "Current readable draft" },
    { label: "Lists", value: listCount, meta: listCount ? "Actionable grouped content" : "Mostly narrative text" }
  ]);
  if (insightGrid && !isDocsClone) {
    container.appendChild(insightGrid);
  }

  const previewShell = document.createElement("section");
  previewShell.className = `workspace-document-preview-shell${isDocsClone ? " workspace-document-preview-shell-docs" : ""}`;

  const previewToolbar = document.createElement("div");
  previewToolbar.className = "workspace-document-preview-toolbar";
  const previewMeta = document.createElement("div");
  previewMeta.className = "workspace-code-toolbar-meta";
  const previewTitle = document.createElement("strong");
  previewTitle.textContent = headings[0]?.replace(/^#{1,3}\s+/, "") || "Document preview";
  const previewHint = document.createElement("span");
  previewHint.className = "tiny";
  previewHint.textContent = isDocsClone
    ? `Editing | Autosaved | ${previewWordCount(normalized)} words`
    : `${headings.length || 1} sections | ${previewWordCount(normalized)} words`;
  previewMeta.append(previewTitle, previewHint);
  const previewTabs = document.createElement("div");
  previewTabs.className = "workspace-code-tabs";
  (isDocsClone ? ["Editing", "Outline", "Share-ready"] : profile.tabs).forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    chip.textContent = label;
    previewTabs.appendChild(chip);
  });
  previewToolbar.append(previewMeta, previewTabs);
  previewShell.appendChild(previewToolbar);

  let docsToolbar = null;
  let docsToolbarStatus = null;
  let shell = null;
  let docsCommitHandle = null;

  const commitDocumentShell = () => {
    if (shell) {
      onInlineEdit?.(serializeDocumentPreviewShell(shell));
    }
  };

  const focusPromptForDocs = () => {
    const promptInput = document.getElementById("prompt-input");
    if (!promptInput) {
      return;
    }
    const pageName = previewTitle.textContent || workObject?.title || "this page";
    promptInput.value = `Improve ${pageName}: rewrite it more clearly, keep the same intent and structure.`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
  };

  const createNewProjectDoc = () => {
    const promptInput = document.getElementById("prompt-input");
    if (!promptInput) {
      return;
    }
    const projectName = workObject?.projectName || "this project";
    promptInput.value = `Create a new document in ${projectName}: add a clear title and start the first page.`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    updateDocsToolbarStatus("Prompt ready to create a new document");
  };

  const getActiveBlockTarget = () => {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode || null;
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (element) {
      const target = element.closest("h1, h2, h3, h4, p, blockquote, li, th, td, figcaption");
      if (target) {
        return target;
      }
    }
    return activeEditable
      ? activeEditable.closest("h1, h2, h3, h4, p, blockquote, li, th, td, figcaption")
      : null;
  };

  const applyBlockAlignment = (value = "left") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Select a block first.");
      return;
    }
    target.style.textAlign = value;
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const applyBlockFontSize = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontSize = value || "";
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const applyBlockFontFamily = (value = "") => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click a block first.");
      return;
    }
    target.style.fontFamily = value || "";
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const unwrapDocsPageShell = () => {
    if (!shell) {
      return;
    }
    const rawNodes = [];
    Array.from(shell.children).forEach((child) => {
      if (child.classList?.contains("workspace-document-page-sheet")) {
        rawNodes.push(...Array.from(child.childNodes));
      } else {
        rawNodes.push(child);
      }
    });
    shell.replaceChildren(...rawNodes);
  };

  const rebuildDocsPageShell = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const rawNodes = Array.from(shell.childNodes);
    shell.innerHTML = "";
    let pageIndex = 0;
    let currentPage = document.createElement("section");
    currentPage.className = "workspace-document-page-sheet";
    currentPage.dataset.page = String(pageIndex + 1);
    for (const node of rawNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("workspace-docs-page-break")) {
        shell.appendChild(currentPage);
        shell.appendChild(node);
        pageIndex += 1;
        currentPage = document.createElement("section");
        currentPage.className = "workspace-document-page-sheet";
        currentPage.dataset.page = String(pageIndex + 1);
        continue;
      }
      currentPage.appendChild(node);
    }
    if (currentPage.childNodes.length || !shell.children.length) {
      shell.appendChild(currentPage);
    }
  };

  const projectLinkedObjects = (projectWorkObjects || []).filter((item) => item.id !== workObject?.id);
  const projectDocs = projectLinkedObjects.filter(
    (item) => item.id !== workObject?.id && item.workspaceFamilyId === "document_knowledge"
  );
  const projectAssets = projectLinkedObjects.filter(
    (item) => item.id !== workObject?.id && ["image", "video", "audio", "dataset", "presentation", "document"].includes(item.objectKind || item.kind)
  );

  const insertProjectAsset = (assetWorkObject) => {
    if (!shell || !assetWorkObject) {
      return;
    }
    const assetType = assetWorkObject.objectKind || assetWorkObject.kind || "";
    const assetUrl = buildWorkObjectAssetUrl(assetWorkObject);
    let node = null;

    if (assetType === "image" && assetUrl) {
      const figure = document.createElement("figure");
      figure.className = "workspace-docs-figure";
      const image = document.createElement("img");
      image.src = assetUrl;
      image.alt = assetWorkObject.title || "Project image";
      image.className = "workspace-inline-image";
      const caption = document.createElement("figcaption");
      caption.textContent = assetWorkObject.title || "Project image";
      bindEditable(caption, { multiline: true });
      figure.append(image, caption);
      node = figure;
      activeEditable = caption;
    } else if (assetType === "video" && assetUrl) {
      const figure = document.createElement("figure");
      figure.className = "workspace-docs-figure";
      const video = document.createElement("video");
      video.src = assetUrl;
      video.controls = true;
      video.className = "workspace-inline-video";
      const caption = document.createElement("figcaption");
      caption.textContent = assetWorkObject.title || "Project video";
      bindEditable(caption, { multiline: true });
      figure.append(video, caption);
      node = figure;
      activeEditable = caption;
    } else if (assetType === "dataset") {
      const callout = document.createElement("blockquote");
      callout.textContent = `Table linked from project: ${assetWorkObject.title || "Dataset"} (${assetWorkObject.primaryFile || "table.csv"})`;
      bindEditable(callout, { multiline: true });
      node = callout;
      activeEditable = callout;
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = `Linked project asset: ${assetWorkObject.title || "Project object"} (${assetWorkObject.primaryFile || assetType})`;
      bindEditable(paragraph, { multiline: true });
      node = paragraph;
      activeEditable = paragraph;
    }

    shell.appendChild(node);
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    activeEditable?.focus?.();
    commitDocumentShell();
    updateDocsToolbarStatus(`${assetWorkObject.title || "Asset"} inserted`);
  };

  const updateDocsToolbarStatus = (label = "Click in the page, then use the tools above.") => {
    if (docsToolbarStatus) {
      docsToolbarStatus.textContent = label;
    }
  };

  const bindEditable = (element, options = {}) => {
    if (isDocsClone) {
      return;
    }
    wireInlineEditable(element, {
      ...options,
      onFocus: () => {
        activeEditable = element;
        updateDocsToolbarStatus(`Editing ${element.tagName.toLowerCase()} block`);
      },
      onCommit: () => {
        commitDocumentShell();
        updateDocsToolbarStatus("Saved automatically");
      }
    });
  };

  const replaceEditableNode = (currentNode, nextNode) => {
    if (!currentNode || !nextNode || !currentNode.parentElement) {
      return;
    }
    currentNode.parentElement.replaceChild(nextNode, currentNode);
    activeEditable = nextNode;
    bindEditable(nextNode, { multiline: nextNode.tagName.toLowerCase() === "p" });
    nextNode.focus();
    commitDocumentShell();
  };

  const convertActiveBlockTag = (nextTag) => {
    const currentTarget = getActiveBlockTarget();
    if (!currentTarget) {
      updateDocsToolbarStatus("Click a paragraph or heading first.");
      return;
    }
    const currentTag = currentTarget.tagName?.toLowerCase?.() || "";
    if (!["p", "h1", "h2", "h3", "h4"].includes(currentTag)) {
      updateDocsToolbarStatus("This formatting works on headings and paragraphs.");
      return;
    }
    if (currentTag === nextTag) {
      return;
    }
    const nextNode = document.createElement(nextTag);
    nextNode.textContent = currentTarget.textContent || "";
    replaceEditableNode(currentTarget, nextNode);
  };

  const convertActiveBlockToList = (ordered = false) => {
    const currentTarget = getActiveBlockTarget();
    if (!currentTarget) {
      updateDocsToolbarStatus("Click a paragraph or list item first.");
      return;
    }
    const currentTag = currentTarget.tagName?.toLowerCase?.() || "";
    if (currentTag === "li") {
      const parent = currentTarget.parentElement;
      if (!parent) {
        return;
      }
      const nextListTag = ordered ? "ol" : "ul";
      if (parent.tagName.toLowerCase() === nextListTag) {
        return;
      }
      const nextList = document.createElement(nextListTag);
      Array.from(parent.children).forEach((child) => nextList.appendChild(child));
      parent.parentElement?.replaceChild(nextList, parent);
      Array.from(nextList.querySelectorAll(":scope > li")).forEach((li) => bindEditable(li));
      currentTarget.focus?.();
      commitDocumentShell();
      return;
    }
    if (!["p", "h1", "h2", "h3", "h4"].includes(currentTag)) {
      updateDocsToolbarStatus("This list tool works on headings, paragraphs and list items.");
      return;
    }
    const list = document.createElement(ordered ? "ol" : "ul");
    const item = document.createElement("li");
    item.textContent = currentTarget.textContent || "";
    list.appendChild(item);
    currentTarget.parentElement?.replaceChild(list, currentTarget);
    activeEditable = item;
    bindEditable(item);
    item.focus();
    commitDocumentShell();
  };

  const runInlineCommand = (command) => {
    const target = getActiveBlockTarget();
    if (!target) {
      updateDocsToolbarStatus("Click in the page first.");
      return;
    }
    target.focus();
    document.execCommand(command, false);
    commitDocumentShell();
    updateDocsToolbarStatus("Saved automatically");
  };

  const insertChecklist = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const list = document.createElement("ul");
    list.dataset.listStyle = "checklist";
    list.className = "workspace-checklist";
    ["First task", "Second task"].forEach((label) => {
      const item = document.createElement("li");
      item.dataset.checked = "false";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "workspace-checklist-box";
      checkbox.addEventListener("change", () => {
        item.dataset.checked = checkbox.checked ? "true" : "false";
        commitDocumentShell();
      });
      const text = document.createElement("span");
      text.textContent = label;
      bindEditable(text, { multiline: true });
      item.append(checkbox, text);
      list.appendChild(item);
    });
    shell.appendChild(list);
    const firstText = list.querySelector("span");
    if (firstText) {
      activeEditable = firstText;
      firstText.focus();
    }
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Checklist added");
  };

  const insertQuote = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const quote = document.createElement("blockquote");
    quote.textContent = "Add the key quote, insight or principle here.";
    bindEditable(quote, { multiline: true });
    shell.appendChild(quote);
    activeEditable = quote;
    quote.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Quote block added");
  };

  const insertDivider = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    shell.appendChild(document.createElement("hr"));
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Divider added");
  };

  const insertTable = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const table = document.createElement("table");
    table.className = "workspace-docs-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Column A", "Column B", "Column C"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      bindEditable(th);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      const row = document.createElement("tr");
      ["Value 1", "Value 2", "Value 3"].forEach((label) => {
        const td = document.createElement("td");
        td.textContent = label;
        bindEditable(td);
        row.appendChild(td);
      });
      tbody.appendChild(row);
    }
    table.append(thead, tbody);
    shell.appendChild(table);
    const firstCell = table.querySelector("td");
    if (firstCell) {
      activeEditable = firstCell;
      firstCell.focus();
    }
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Table inserted");
  };

  const insertImagePlaceholder = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const figure = document.createElement("figure");
    figure.className = "workspace-docs-figure";
    const image = document.createElement("img");
    image.src = "https://placehold.co/1200x720?text=Visual";
    image.alt = "Visual";
    image.className = "workspace-inline-image";
    const caption = document.createElement("figcaption");
    caption.textContent = "Add the image caption here.";
    bindEditable(caption, { multiline: true });
    figure.append(image, caption);
    shell.appendChild(figure);
    activeEditable = caption;
    caption.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Image placeholder inserted");
  };

  const insertImageFromUrl = () => {
    if (!shell) {
      return;
    }
    const url = window.prompt("Image URL");
    if (!url) {
      return;
    }
    unwrapDocsPageShell();
    const figure = document.createElement("figure");
    figure.className = "workspace-docs-figure";
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Inserted image";
    image.className = "workspace-inline-image";
    const caption = document.createElement("figcaption");
    caption.textContent = "Image caption";
    bindEditable(caption, { multiline: true });
    figure.append(image, caption);
    shell.appendChild(figure);
    activeEditable = caption;
    caption.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("Image inserted");
  };

  const insertPageBreak = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const breakNode = document.createElement("div");
    breakNode.className = "workspace-docs-page-break";
    breakNode.textContent = "Page break";
    const heading = document.createElement("h1");
    heading.textContent = "New page";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Start writing on the next page here.";
    bindEditable(heading);
    bindEditable(paragraph, { multiline: true });
    shell.append(breakNode, heading, paragraph);
    activeEditable = paragraph;
    paragraph.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("New page added");
  };

  const insertNewSection = () => {
    if (!shell) {
      return;
    }
    unwrapDocsPageShell();
    const heading = document.createElement("h2");
    heading.textContent = "New section";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Write the next section here.";
    bindEditable(heading);
    bindEditable(paragraph, { multiline: true });
    shell.append(heading, paragraph);
    activeEditable = paragraph;
    paragraph.focus();
    if (isDocsClone) {
      rebuildDocsPageShell();
    }
    commitDocumentShell();
    updateDocsToolbarStatus("New section added");
  };

  if (isDocsClone) {
    const docsMenuBar = document.createElement("div");
    docsMenuBar.className = "workspace-docs-menubar";
    docsMenuPanel = document.createElement("div");
    docsMenuPanel.className = "workspace-docs-menu-panel hidden";

    const renderDocsMenu = (menuId = "") => {
      if (!docsMenuPanel) {
        return;
      }
      docsMenuPanel.innerHTML = "";
      docsMenuButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.menu === menuId));
      if (!menuId) {
        docsMenuPanel.classList.add("hidden");
        return;
      }
      docsMenuPanel.classList.remove("hidden");

      const addMenuAction = (label, onClick, accent = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `workspace-docs-menu-action${accent ? " accent" : ""}`;
        button.textContent = label;
        button.addEventListener("click", () => {
          onClick?.();
          renderDocsMenu("");
        });
        docsMenuPanel.appendChild(button);
      };

      const addMenuLabel = (label) => {
        const span = document.createElement("span");
        span.className = "workspace-docs-menu-label";
        span.textContent = label;
        docsMenuPanel.appendChild(span);
      };

      if (menuId === "File") {
        addMenuAction("New page", insertPageBreak);
        addMenuAction("New section", insertNewSection);
        addMenuAction("New document in project", createNewProjectDoc, true);
        if (projectDocs.length) {
          addMenuLabel("Other docs in this project");
          projectDocs.slice(0, 6).forEach((item) => addMenuAction(item.title || "Document", () => onProjectObjectSelect?.(item)));
        }
        if (projectLinkedObjects.length) {
          addMenuLabel("Project objects");
          projectLinkedObjects.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project object", () => onProjectObjectSelect?.(item)));
        }
        return;
      }

      if (menuId === "Edit") {
        addMenuAction("Undo", () => runInlineCommand("undo"));
        addMenuAction("Redo", () => runInlineCommand("redo"));
        return;
      }

      if (menuId === "View") {
        addMenuAction("Scroll to outline", () => outline.scrollIntoView({ behavior: "smooth", block: "start" }));
        addMenuAction("Scroll to page", () => shell?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }

      if (menuId === "Insert") {
        addMenuAction("Checklist", insertChecklist);
        addMenuAction("Quote", insertQuote);
        addMenuAction("Divider", insertDivider);
        addMenuAction("Table", insertTable);
        addMenuAction("Image placeholder", insertImagePlaceholder);
        addMenuAction("Page", insertPageBreak);
        if (projectAssets.length) {
          addMenuLabel("Project assets");
          projectAssets.slice(0, 6).forEach((item) => addMenuAction(`Insert ${item.title || item.objectKind || "asset"}`, () => insertProjectAsset(item)));
        }
        return;
      }

      if (menuId === "Format") {
        addMenuAction("Text", () => convertActiveBlockTag("p"));
        addMenuAction("Title", () => convertActiveBlockTag("h1"));
        addMenuAction("Heading", () => convertActiveBlockTag("h2"));
        addMenuAction("Subhead", () => convertActiveBlockTag("h3"));
        addMenuAction("Left align", () => applyBlockAlignment("left"));
        addMenuAction("Center align", () => applyBlockAlignment("center"));
        return;
      }

      if (menuId === "Tools") {
        addMenuAction("Ask Hydria to improve this page", focusPromptForDocs, true);
        addMenuAction("Insert project image", () => {
          const imageAsset = projectAssets.find((item) => (item.objectKind || item.kind) === "image");
          if (imageAsset) {
            insertProjectAsset(imageAsset);
          }
        });
        return;
      }

      if (menuId === "Extensions") {
        if (projectAssets.length) {
          addMenuLabel("Connected project objects");
          projectAssets.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project asset", () => insertProjectAsset(item)));
        } else {
          addMenuLabel("No reusable project assets yet");
        }
        if (projectLinkedObjects.length) {
          addMenuLabel("Open any project object");
          projectLinkedObjects.slice(0, 8).forEach((item) => addMenuAction(item.title || "Project object", () => onProjectObjectSelect?.(item)));
        }
        return;
      }

      if (menuId === "Help") {
        addMenuLabel("Click in the page, then use the toolbar or menus.");
        addMenuLabel("Use Page to create another A4 sheet.");
        addMenuLabel("Use Extensions to reuse assets from the project.");
      }
    };

    ["File", "Edit", "View", "Insert", "Format", "Tools", "Extensions", "Help"].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-docs-menu-item";
      button.textContent = label;
      button.dataset.menu = label;
      button.addEventListener("click", () => {
        renderDocsMenu(docsMenuPanel?.dataset.openMenu === label ? "" : label);
        if (docsMenuPanel) {
          docsMenuPanel.dataset.openMenu = docsMenuPanel.dataset.openMenu === label ? "" : label;
        }
      });
      docsMenuButtons.push(button);
      docsMenuBar.appendChild(button);
    });
    const docsMenuStatus = document.createElement("span");
    docsMenuStatus.className = "workspace-docs-menubar-status";
    docsMenuStatus.textContent = "Saved to Hydria";
    docsMenuBar.appendChild(docsMenuStatus);
    previewShell.appendChild(docsMenuBar);
    previewShell.appendChild(docsMenuPanel);

    docsToolbar = document.createElement("div");
    docsToolbar.className = "workspace-docs-toolbar";

    const makeButton = (label, onClick, modifierClass = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-docs-tool${modifierClass ? ` ${modifierClass}` : ""}`;
      button.textContent = label;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", onClick);
      return button;
    };

    const styleGroup = document.createElement("div");
    styleGroup.className = "workspace-docs-tool-group";
    styleGroup.append(
      makeButton("Text", () => convertActiveBlockTag("p")),
      makeButton("Title", () => convertActiveBlockTag("h1")),
      makeButton("Heading", () => convertActiveBlockTag("h2")),
      makeButton("Subhead", () => convertActiveBlockTag("h3")),
      makeButton("Bullets", () => convertActiveBlockToList(false)),
      makeButton("Numbered", () => convertActiveBlockToList(true))
    );

    const inlineGroup = document.createElement("div");
    inlineGroup.className = "workspace-docs-tool-group";
    inlineGroup.append(
      makeButton("Bold", () => runInlineCommand("bold")),
      makeButton("Italic", () => runInlineCommand("italic")),
      makeButton("Underline", () => runInlineCommand("underline")),
      makeButton("Left", () => applyBlockAlignment("left")),
      makeButton("Center", () => applyBlockAlignment("center")),
      makeButton("Undo", () => runInlineCommand("undo")),
      makeButton("Redo", () => runInlineCommand("redo"))
    );

    const actionGroup = document.createElement("div");
    actionGroup.className = "workspace-docs-tool-group";
    actionGroup.append(
      makeButton("Checklist", insertChecklist),
      makeButton("Quote", insertQuote),
      makeButton("Divider", insertDivider),
      makeButton("Table", insertTable),
      makeButton("Image", insertImagePlaceholder),
      makeButton("Image URL", insertImageFromUrl),
      makeButton("Page", insertPageBreak),
      makeButton("New section", insertNewSection),
      makeButton("Ask Hydria", focusPromptForDocs, "workspace-docs-tool-accent")
    );

    const typographyGroup = document.createElement("div");
    typographyGroup.className = "workspace-docs-tool-group";

    const fontSelect = document.createElement("select");
    fontSelect.className = "workspace-docs-select";
    [
      { label: "Default font", value: "" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Georgia", value: "Georgia, serif" },
      { label: "IBM Plex Sans", value: "\"IBM Plex Sans\", sans-serif" },
      { label: "Times New Roman", value: "\"Times New Roman\", serif" }
    ].forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      fontSelect.appendChild(option);
    });
    fontSelect.addEventListener("change", (event) => applyBlockFontFamily(event.target.value));

    const sizeSelect = document.createElement("select");
    sizeSelect.className = "workspace-docs-select";
    [
      { label: "Auto size", value: "" },
      { label: "12", value: "12px" },
      { label: "14", value: "14px" },
      { label: "16", value: "16px" },
      { label: "18", value: "18px" },
      { label: "24", value: "24px" },
      { label: "32", value: "32px" }
    ].forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener("change", (event) => applyBlockFontSize(event.target.value));

    typographyGroup.append(fontSelect, sizeSelect);

    docsToolbarStatus = document.createElement("span");
    docsToolbarStatus.className = "workspace-docs-toolbar-status";
    docsToolbarStatus.textContent = "Click in the page, then use the tools above.";

    docsToolbar.append(styleGroup, inlineGroup, typographyGroup, actionGroup, docsToolbarStatus);
    previewShell.appendChild(docsToolbar);

    const quickActions = document.createElement("div");
    quickActions.className = "workspace-docs-quick-actions";
    const quickLabel = document.createElement("span");
    quickLabel.className = "tiny";
    quickLabel.textContent = "Quick actions";
    const quickGroup = document.createElement("div");
    quickGroup.className = "workspace-docs-tool-group";
    quickGroup.append(
      makeButton("Add page", insertPageBreak),
      makeButton("New doc", createNewProjectDoc, "workspace-docs-tool-accent"),
      makeButton("Insert image", insertImageFromUrl)
    );
    quickActions.append(quickLabel, quickGroup);
    previewShell.appendChild(quickActions);

    const ruler = document.createElement("div");
    ruler.className = "workspace-docs-ruler";
    for (let index = 0; index < 12; index += 1) {
      const tick = document.createElement("span");
      tick.className = "workspace-docs-ruler-tick";
      tick.textContent = `${(index + 1) * 10}`;
      ruler.appendChild(tick);
    }
    previewShell.appendChild(ruler);
  }

  if (!isDocsClone) {
    const previewContext = document.createElement("div");
    previewContext.className = "workspace-document-context-grid";
    [
      {
        label: profile.contextLabelA,
        value: headings.length > 3 ? profile.contextValueA : "Short page"
      },
      {
        label: profile.contextLabelB,
        value:
          blocks.find((block) => !/^#{1,3}\s+/.test(block))?.replace(/^[-*]\s+|^\d+\.\s+/, "") ||
          "Use the editor to sharpen the first insight."
      }
    ].forEach((item) => {
      const card = document.createElement("article");
      card.className = "workspace-document-context-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = item.label;
      const text = document.createElement("p");
      text.textContent = item.value;
      card.append(label, text);
      previewContext.appendChild(card);
    });
    previewShell.appendChild(previewContext);

    const previewRibbon = document.createElement("div");
    previewRibbon.className = "workspace-flow-chip-list";
    [
      profile.ribbon[0],
      `${headings.length || 1} sections`,
      listCount ? profile.ribbon[2] : profile.ribbon[1],
      profile.ribbon[3]
    ].forEach((label, index) => {
      const chip = document.createElement("span");
      chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
      chip.textContent = label;
      previewRibbon.appendChild(chip);
    });
    previewShell.appendChild(previewRibbon);
  }

  const previewLayout = document.createElement("div");
  previewLayout.className = `workspace-document-preview-layout${isDocsClone ? " workspace-document-preview-layout-docs" : ""}`;
  const outline = document.createElement("aside");
  outline.className = `workspace-document-preview-outline${isDocsClone ? " workspace-document-preview-outline-docs" : ""}`;
  const outlineHeader = document.createElement("span");
  outlineHeader.className = "tiny";
  outlineHeader.textContent = isDocsClone ? "Document outline" : "Outline";
  outline.appendChild(outlineHeader);
  const outlineItems = (sections || []).filter((section) => section.id !== "whole-file");
  const fallbackOutlineItems = usesRichDocument
    ? extractRichDocumentHeadings(normalized)
    : (headings.length ? headings : ["# Document"]).slice(0, 8).map((heading, index) => ({
        id: `heading-${index + 1}`,
        label: heading.replace(/^#{1,3}\s+/, "")
      }));
  (outlineItems.length
    ? outlineItems.map((section, index) => ({
        id: section.id,
        label: section.title || `Section ${index + 1}`
      }))
    : fallbackOutlineItems).forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-mini-list-item${
      (selectedSectionId && selectedSectionId === entry.id) || (!selectedSectionId && index === 0) ? " active" : ""
    }`;
    button.textContent = entry.label;
    button.disabled = !outlineItems.length && !usesRichDocument && (!onSectionFocus || !outlineItems.length);
    if (usesRichDocument) {
      button.addEventListener("click", () => {
        const target = shell?.querySelector?.(`#${entry.id}`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          target.focus?.();
        }
      });
    } else if (onSectionFocus && outlineItems.length) {
      button.addEventListener("click", () => onSectionFocus(entry.id));
    }
    outline.appendChild(button);
  });

  if (isDocsClone && projectDocs.length) {
    const docsLabel = document.createElement("span");
    docsLabel.className = "tiny workspace-docs-side-label";
    docsLabel.textContent = "Project docs";
    outline.appendChild(docsLabel);
    projectDocs.slice(0, 6).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || "Document";
      button.addEventListener("click", () => onProjectObjectSelect?.(item));
      outline.appendChild(button);
    });
  }

  if (isDocsClone && projectLinkedObjects.length) {
    const linkedLabel = document.createElement("span");
    linkedLabel.className = "tiny workspace-docs-side-label";
    linkedLabel.textContent = "Project objects";
    outline.appendChild(linkedLabel);
    projectLinkedObjects.slice(0, 8).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || item.objectKind || "Object";
      button.addEventListener("click", () => onProjectObjectSelect?.(item));
      outline.appendChild(button);
    });
  }

  if (isDocsClone && projectAssets.length) {
    const assetsLabel = document.createElement("span");
    assetsLabel.className = "tiny workspace-docs-side-label";
    assetsLabel.textContent = "Project assets";
    outline.appendChild(assetsLabel);
    projectAssets.slice(0, 6).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-mini-list-item";
      button.textContent = item.title || item.objectKind || "Asset";
      button.addEventListener("click", () => insertProjectAsset(item));
      outline.appendChild(button);
    });
  }

  shell = document.createElement("article");
  shell.className = `workspace-document-shell workspace-document-preview-body${isDocsClone ? " workspace-document-preview-body-docs" : ""}`;
  if (isDocsClone) {
    shell.dataset.richDocument = "true";
  }

  if (usesRichDocument) {
    const template = document.createElement("template");
    template.innerHTML = normalized;
    shell.appendChild(template.content.cloneNode(true));
    let headingIndex = 0;
    shell.querySelectorAll("h1, h2, h3, h4").forEach((node) => {
      if (!node.id) {
        node.id = `heading-${headingIndex + 1}`;
      }
      headingIndex += 1;
      bindEditable(node, { multiline: true });
    });
    shell.querySelectorAll("p, blockquote, figcaption, th, td").forEach((node) => {
      bindEditable(node, { multiline: true });
    });
    shell.querySelectorAll("li").forEach((node) => {
      const editableTarget = node.querySelector("span") || node;
      bindEditable(editableTarget, { multiline: true });
    });
    shell.querySelectorAll(".workspace-checklist-box").forEach((checkbox) => {
      const item = checkbox.closest("li");
      if (item) {
        const shouldBeChecked = checkbox.hasAttribute("checked") || item.dataset.checked === "true";
        checkbox.checked = shouldBeChecked;
        item.dataset.checked = shouldBeChecked ? "true" : "false";
      }
      checkbox.addEventListener("change", () => {
        const currentItem = checkbox.closest("li");
        if (currentItem) {
          currentItem.dataset.checked = checkbox.checked ? "true" : "false";
        }
        commitDocumentShell();
      });
    });
  } else {
    for (const block of blocks) {
      if (/^#{1,4}\s+/.test(block)) {
        const heading = document.createElement(
          block.startsWith("####") ? "h4" : block.startsWith("###") ? "h3" : block.startsWith("##") ? "h2" : "h1"
        );
        appendInlineContent(heading, block.replace(/^#{1,4}\s+/, ""));
        bindEditable(heading);
        shell.appendChild(heading);
        continue;
      }

      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length && lines.every((line) => /^>\s*/.test(line))) {
        const quote = document.createElement("blockquote");
        quote.textContent = lines.map((line) => line.replace(/^>\s*/, "")).join("\n");
        bindEditable(quote, { multiline: true });
        shell.appendChild(quote);
        continue;
      }

      if (lines.length === 1 && /^(---|\*\*\*)$/.test(lines[0])) {
        shell.appendChild(document.createElement("hr"));
        continue;
      }

      if (lines.length >= 2 && lines[0].startsWith("|") && lines[1].startsWith("|")) {
        const rows = lines
          .filter((line, index) => !(index === 1 && /^\|\s*[-:| ]+\|\s*$/.test(line)))
          .map((line) =>
            line
              .split("|")
              .map((cell) => cell.trim())
              .filter(Boolean)
          );
        if (rows.length) {
          const table = document.createElement("table");
          table.className = "workspace-docs-table";
          const thead = document.createElement("thead");
          const headerRow = document.createElement("tr");
          rows[0].forEach((cell) => {
            const th = document.createElement("th");
            th.textContent = cell;
            bindEditable(th);
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          const tbody = document.createElement("tbody");
          rows.slice(1).forEach((cells) => {
            const row = document.createElement("tr");
            cells.forEach((cell) => {
              const td = document.createElement("td");
              td.textContent = cell;
              bindEditable(td);
              row.appendChild(td);
            });
            tbody.appendChild(row);
          });
          table.append(thead, tbody);
          shell.appendChild(table);
          continue;
        }
      }

      if (lines.length && lines.every((line) => /^-\s+\[[ xX]\]\s+/.test(line))) {
        const list = document.createElement("ul");
        list.dataset.listStyle = "checklist";
        list.className = "workspace-checklist";
        for (const line of lines) {
          const item = document.createElement("li");
          item.dataset.checked = /\[[xX]\]/.test(line) ? "true" : "false";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "workspace-checklist-box";
          checkbox.checked = item.dataset.checked === "true";
          checkbox.addEventListener("change", () => {
            item.dataset.checked = checkbox.checked ? "true" : "false";
            commitDocumentShell();
          });
          const text = document.createElement("span");
          appendInlineContent(text, line.replace(/^-\s+\[[ xX]\]\s+/, ""));
          bindEditable(text, { multiline: true });
          item.append(checkbox, text);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
        const list = document.createElement("ul");
        for (const line of lines) {
          const item = document.createElement("li");
          appendInlineContent(item, line.replace(/^[-*]\s+/, ""));
          bindEditable(item);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      if (lines.length && lines.every((line) => /^\d+\.\s+/.test(line))) {
        const list = document.createElement("ol");
        for (const line of lines) {
          const item = document.createElement("li");
          appendInlineContent(item, line.replace(/^\d+\.\s+/, ""));
          bindEditable(item);
          list.appendChild(item);
        }
        shell.appendChild(list);
        continue;
      }

      const paragraph = document.createElement("p");
      appendInlineContent(paragraph, block);
      bindEditable(paragraph, { multiline: true });
      shell.appendChild(paragraph);
    }
  }

  if (isDocsClone) {
    if (!shell.childNodes.length) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      shell.appendChild(paragraph);
    }
    rebuildDocsPageShell();
    const canvas = document.createElement("div");
    canvas.className = "workspace-document-page-canvas";
    canvas.appendChild(shell);
    previewLayout.append(outline, canvas);
    shell.contentEditable = "true";
    shell.spellcheck = true;
    shell.classList.add("workspace-inline-editable");
    shell.dataset.placeholder = "Start typing here";
    shell.addEventListener("input", () => {
      if (docsCommitHandle) {
        window.clearTimeout(docsCommitHandle);
      }
      docsCommitHandle = window.setTimeout(() => {
        commitDocumentShell();
        updateDocsToolbarStatus("Saved automatically");
      }, 120);
    });
    shell.addEventListener("click", () => {
      updateDocsToolbarStatus("Editing page");
    });
  } else {
    previewLayout.append(outline, shell);
  }
  previewShell.appendChild(previewLayout);
  container.appendChild(previewShell);
}

function wireInlineEditable(element, { multiline = false, onCommit = null, onFocus = null } = {}) {
  if (!element || typeof onCommit !== "function") {
    return;
  }

  element.contentEditable = "true";
  element.spellcheck = true;
  element.classList.add("workspace-inline-editable");
  element.dataset.placeholder = multiline ? "Edit directly here" : "Edit";

  const commit = () => {
    onCommit();
  };

  element.addEventListener("focus", () => {
    if (typeof onFocus === "function") {
      onFocus();
    }
  });
  element.addEventListener("blur", commit);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      element.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  });
}

function serializeDocumentPreviewShell(shell) {
  if (shell?.dataset?.richDocument === "true") {
    const clone = shell.cloneNode(true);
    clone.querySelectorAll(".workspace-document-page-sheet").forEach((page) => {
      page.replaceWith(...Array.from(page.childNodes));
    });
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    clone.querySelectorAll("[spellcheck]").forEach((node) => node.removeAttribute("spellcheck"));
    clone.querySelectorAll("[data-placeholder]").forEach((node) => node.removeAttribute("data-placeholder"));
    clone.querySelectorAll(".workspace-inline-editable").forEach((node) => {
      node.classList.remove("workspace-inline-editable");
    });
    clone.querySelectorAll(".workspace-checklist-box").forEach((checkbox) => {
      const checked = checkbox.checked || checkbox.closest("li")?.dataset?.checked === "true";
      if (checked) {
        checkbox.setAttribute("checked", "checked");
      } else {
        checkbox.removeAttribute("checked");
      }
    });
    return String(clone.innerHTML || "").trim();
  }
  return Array.from(shell.children)
    .map((node) => {
      const tagName = node.tagName?.toLowerCase?.() || "";
      if (!tagName) {
        return "";
      }

      if (/^h[1-4]$/.test(tagName)) {
        const level = Number(tagName.slice(1));
        return `${"#".repeat(level)} ${String(node.textContent || "").trim()}`;
      }

      if (tagName === "p") {
        return String(node.textContent || "").trim();
      }

      if (tagName === "blockquote") {
        return String(node.textContent || "")
          .split("\n")
          .map((line) => `> ${line.trim()}`)
          .join("\n");
      }

      if (tagName === "hr") {
        return "---";
      }

      if (tagName === "ul") {
        if (node.dataset.listStyle === "checklist") {
          return Array.from(node.querySelectorAll(":scope > li"))
            .map((item) => {
              const checked = item.dataset.checked === "true" ? "x" : " ";
              return `- [${checked}] ${String(item.textContent || "").trim()}`;
            })
            .join("\n");
        }
        return Array.from(node.querySelectorAll(":scope > li"))
          .map((item) => `- ${String(item.textContent || "").trim()}`)
          .join("\n");
      }

      if (tagName === "ol") {
        return Array.from(node.querySelectorAll(":scope > li"))
          .map((item, index) => `${index + 1}. ${String(item.textContent || "").trim()}`)
          .join("\n");
      }

      if (tagName === "table") {
        const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
          Array.from(row.children).map((cell) => String(cell.textContent || "").trim())
        );
        if (!rows.length) {
          return "";
        }
        const [headerRow, ...bodyRows] = rows;
        const divider = headerRow.map(() => "---");
        return [
          `| ${headerRow.join(" | ")} |`,
          `| ${divider.join(" | ")} |`,
          ...bodyRows.map((row) => `| ${row.join(" | ")} |`)
        ].join("\n");
      }

      return String(node.textContent || "").trim();
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function renderCodePreview(container, content = "", filePath = "") {
  const normalized = normalizeText(content);
  const lines = normalized.split("\n");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const symbolItems = blocks.slice(0, 8).map((block, index) => {
    const firstLine = block.split("\n")[0] || "";
    const titleMatch = firstLine.match(/(?:function|class|const|let|var|export\s+function|export\s+const)\s+([A-Za-z0-9_$-]+)/);
    return {
      title: titleMatch?.[1] || firstLine.replace(/[{}]/g, "").trim() || `Block ${index + 1}`,
      meta: `${block.split("\n").length} lines`
    };
  });
  const diagnostics = {
    imports: lines.filter((line) => /^\s*(import|const .*require\()/.test(line)).length,
    functions: lines.filter((line) => /\b(function\s+\w+|\w+\s*=>|async\s+function|\w+\([^)]*\)\s*\{)/.test(line)).length,
    todos: lines.filter((line) => /todo|fixme/i.test(line)).length,
    tests: lines.filter((line) => /\b(describe|it|test|expect)\b/.test(line)).length
  };
  const insightGrid = createPreviewInsightGrid([
    { label: "Language", value: inferPreviewLanguage(filePath), meta: friendlyPathLabel(filePath) || "Source file" },
    { label: "Lines", value: lines.length, meta: `${lines.filter((line) => line.trim()).length} non-empty lines` },
    { label: "Blocks", value: blocks.length || 1, meta: "Hydria can focus edits block by block" }
  ]);
  if (insightGrid) {
    container.appendChild(insightGrid);
  }

  const shell = document.createElement("div");
  shell.className = "workspace-code-shell";
  const toolbar = document.createElement("div");
  toolbar.className = "workspace-code-toolbar";
  const toolbarMeta = document.createElement("div");
  toolbarMeta.className = "workspace-code-toolbar-meta";
  const fileLabel = document.createElement("strong");
  fileLabel.textContent = friendlyPathLabel(filePath) || "Source file";
  const fileHint = document.createElement("span");
  fileHint.className = "tiny";
  fileHint.textContent = `${inferPreviewLanguage(filePath)} · ${lines.length} lines`;
  toolbarMeta.append(fileLabel, fileHint);
  const toolbarTabs = document.createElement("div");
  toolbarTabs.className = "workspace-code-tabs";
  ["Explorer", "Source", "Checks"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 1 ? " is-active" : ""}`;
    tab.textContent = label;
    toolbarTabs.appendChild(tab);
  });
  toolbar.append(toolbarMeta, toolbarTabs);

  const chrome = document.createElement("div");
  chrome.className = "workspace-code-chrome";
  const activityBar = document.createElement("div");
  activityBar.className = "workspace-code-activity-bar";
  ["Files", "Search", "Run", "Git"].forEach((label, index) => {
    const item = document.createElement("span");
    item.className = `workspace-code-activity-item${index === 0 ? " is-active" : ""}`;
    item.textContent = label;
    activityBar.appendChild(item);
  });
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-code-sidebar";

  const symbolHeader = document.createElement("div");
  symbolHeader.className = "workspace-code-sidebar-header";
  symbolHeader.textContent = "Symbols";
  sidebar.appendChild(symbolHeader);

  const symbolList = document.createElement("div");
  symbolList.className = "workspace-code-symbol-list";
  if (symbolItems.length) {
    symbolItems.forEach((item) => {
      const symbol = document.createElement("div");
      symbol.className = "workspace-code-symbol";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = item.meta;
      symbol.append(title, meta);
      symbolList.appendChild(symbol);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = "Hydria will expose functions and blocks here as the file grows.";
    symbolList.appendChild(empty);
  }
  sidebar.appendChild(symbolList);

  const checks = document.createElement("div");
  checks.className = "workspace-code-checks";
  [
    { label: "Imports", value: diagnostics.imports },
    { label: "Functions", value: diagnostics.functions },
    { label: "TODOs", value: diagnostics.todos },
    { label: "Tests", value: diagnostics.tests }
  ].forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-code-check";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = String(item.value);
    card.append(label, value);
    checks.appendChild(card);
  });

  const wrapper = document.createElement("div");
  wrapper.className = "workspace-code-lines";

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "workspace-code-line";

    const gutter = document.createElement("span");
    gutter.className = "workspace-code-gutter";
    gutter.textContent = String(index + 1);

    const code = document.createElement("code");
    code.className = "workspace-code-content";
    code.textContent = line || " ";

    row.append(gutter, code);
    wrapper.appendChild(row);
  });

  const main = document.createElement("div");
  main.className = "workspace-code-main";
  main.append(checks, wrapper);

  chrome.append(activityBar, sidebar, main);
  const statusBar = document.createElement("div");
  statusBar.className = "workspace-code-statusbar";
  const statusMeta = document.createElement("span");
  statusMeta.textContent = `${inferPreviewLanguage(filePath)} | ${symbolItems.length || 1} symbols`;
  const statusHint = document.createElement("span");
  statusHint.textContent = diagnostics.todos ? `${diagnostics.todos} TODOs open` : "Ready to iterate with Hydria";
  statusBar.append(statusMeta, statusHint);
  shell.append(toolbar, chrome, statusBar);
  container.appendChild(shell);
}

function renderProjectOverview(container, { project = null, workObject = null, blocks = [] } = {}) {
  const grid = document.createElement("div");
  grid.className = "workspace-overview-grid";

  const items = [
    { label: "Project", value: project?.name || workObject?.title || "Hydria Project" },
    { label: "Status", value: project?.status || workObject?.status || "draft" },
    {
      label: "Dimensions",
      value: (project?.dimensions || workObject?.projectDimensions || []).join(", ") || "text"
    },
    {
      label: "Objects",
      value: String(project?.workObjectCount || 1)
    },
    {
      label: "Capabilities",
      value:
        (project?.internalCapabilities || workObject?.internalCapabilities || []).join(", ") ||
        "standard"
    },
    { label: "Blocks", value: String(blocks.length || 1) }
  ];

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value;
    card.append(label, value);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function renderOutline(container, sections = [], currentSectionId = "") {
  if (!sections.length) {
    return;
  }

  const outline = document.createElement("div");
  outline.className = "workspace-outline";

  for (const section of sections) {
    const item = document.createElement("span");
    item.className = `workspace-outline-item${currentSectionId === section.id ? " active" : ""}`;
    item.textContent = section.title;
    outline.appendChild(item);
  }

  container.appendChild(outline);
}

function previewWordCount(value = "") {
  const matches = normalizeText(value).match(/\b[\p{L}\p{N}_'-]+\b/gu);
  return matches ? matches.length : 0;
}

function inferPreviewLanguage(filePath = "") {
  const normalized = String(filePath || "").toLowerCase();
  if (/(^|\/)package\.json$/.test(normalized)) {
    return "Package manifest";
  }
  if (/\.tsx?$/.test(normalized)) {
    return "TypeScript";
  }
  if (/\.jsx?$/.test(normalized)) {
    return "JavaScript";
  }
  if (/\.css$/.test(normalized)) {
    return "CSS";
  }
  if (/\.html$/.test(normalized)) {
    return "HTML";
  }
  if (/\.ya?ml$/.test(normalized)) {
    return "YAML";
  }
  if (/\.json$/.test(normalized)) {
    return "JSON";
  }
  return "Code";
}

function createPreviewInsightGrid(items = []) {
  const visibleItems = items.filter((item) => item && item.value !== undefined && item.value !== null && String(item.value).trim());
  if (!visibleItems.length) {
    return null;
  }

  const grid = document.createElement("div");
  grid.className = "workspace-preview-insight-grid";

  visibleItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-preview-insight-card";

    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = String(item.value);

    card.append(label, value);

    if (item.meta) {
      const meta = document.createElement("p");
      meta.className = "workspace-preview-insight-meta";
      meta.textContent = item.meta;
      card.appendChild(meta);
    }

    grid.appendChild(card);
  });

  return grid;
}

function parseCsvRows(content = "") {
  const text = normalizeText(content);
  if (!text.trim()) {
    return [];
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => String(value || "").trim().length));
}

function normalizeSpreadsheetPreviewModel(model = {}, { defaultSheetName = "Sheet 1" } = {}) {
  const normalizeSheet = (sheet = {}, index = 0) => {
    const columns = Array.isArray(sheet.columns) && sheet.columns.length
      ? sheet.columns.map((value) => String(value || ""))
      : ["Column 1", "Column 2", "Column 3"];
    const width = columns.length;
    const rows = (Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]]).map((row) =>
      Array.from({ length: width }, (_, columnIndex) => String(row?.[columnIndex] || ""))
    );
    return {
      id: String(sheet.id || `sheet-${index + 1}`),
      name: String(sheet.name || `${defaultSheetName.replace(/\s+\d+$/, "") || "Sheet"} ${index + 1}`),
      hidden: Boolean(sheet.hidden),
      columns,
      rows,
      columnWidths:
        sheet.columnWidths && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
          ? { ...sheet.columnWidths }
          : {},
      rowHeights:
        sheet.rowHeights && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
          ? { ...sheet.rowHeights }
          : {},
      merges: Array.isArray(sheet.merges)
        ? sheet.merges
            .filter(
              (merge) =>
                merge &&
                Number.isInteger(merge.startRowIndex) &&
                Number.isInteger(merge.startColumnIndex) &&
                Number.isInteger(merge.rowSpan) &&
                Number.isInteger(merge.columnSpan) &&
                merge.rowSpan > 0 &&
                merge.columnSpan > 0
            )
            .map((merge) => ({
              startRowIndex: Number(merge.startRowIndex),
              startColumnIndex: Number(merge.startColumnIndex),
              rowSpan: Number(merge.rowSpan),
              columnSpan: Number(merge.columnSpan)
            }))
        : [],
      cellFormats:
        sheet.cellFormats && typeof sheet.cellFormats === "object" && !Array.isArray(sheet.cellFormats)
          ? { ...sheet.cellFormats }
          : {},
      cellNotes: normalizeSpreadsheetNotes(sheet.cellNotes || sheet.notes || sheet.comments),
      dataValidations: normalizeSpreadsheetDataValidations(sheet.dataValidations || sheet.validations),
      conditionalFormats: normalizeSpreadsheetConditionalFormats(sheet.conditionalFormats || sheet.conditionalFormatting),
      tables: normalizeSpreadsheetTables(sheet.tables),
      pivotTables: normalizeSpreadsheetPivotTables(sheet.pivotTables),
      charts: normalizeSpreadsheetCharts(sheet.charts),
      sparklines: normalizeSpreadsheetSparklines(sheet.sparklines),
      slicers: normalizeSpreadsheetSlicers(sheet.slicers),
      filterQuery: String(sheet.filterQuery || ""),
      filterColumnIndex: Number.isInteger(sheet.filterColumnIndex) ? Number(sheet.filterColumnIndex) : -1,
      tableFilters: normalizeSpreadsheetTableFilters(sheet.tableFilters),
      sort:
        sheet.sort && Number.isInteger(sheet.sort.columnIndex)
          ? {
              columnIndex: Number(sheet.sort.columnIndex),
              direction: sheet.sort.direction === "desc" ? "desc" : "asc"
            }
          : null,
      protected: Boolean(sheet.protected || sheet.protection?.sheet),
      protectedRanges: normalizeSpreadsheetProtectionRanges(sheet.protectedRanges || sheet.protection?.ranges),
      zoomLevel: Math.max(0.5, Math.min(2, Number(sheet.zoomLevel || 1) || 1)),
      showGridlines: sheet.showGridlines !== false,
      frozenRows: Math.max(0, Number(sheet.frozenRows || 0)),
      frozenColumns: Math.max(0, Number(sheet.frozenColumns || 0))
    };
  };

  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeSheet(sheet, index))
    : [normalizeSheet(model, 0)];
  if (!sheets.some((sheet) => !sheet.hidden) && sheets[0]) {
    sheets[0].hidden = false;
  }
  const visibleSheets = sheets.filter((sheet) => !sheet.hidden);
  const fallbackActiveSheet = visibleSheets[0] || sheets[0];
  const activeSheetId =
    sheets.some((sheet) => sheet.id === model.activeSheetId && !sheet.hidden) && model.activeSheetId
      ? model.activeSheetId
      : fallbackActiveSheet?.id || sheets[0].id;
  const activeSheet =
    sheets.find((sheet) => sheet.id === activeSheetId && !sheet.hidden) ||
    fallbackActiveSheet ||
    sheets[0];
  const validSheetIds = new Set(sheets.map((sheet) => sheet.id));
  const namedRanges = normalizeSpreadsheetNamedRanges(model.namedRanges || model.names).filter(
    (namedRange) => !namedRange.sheetId || validSheetIds.has(namedRange.sheetId)
  );

  return {
    kind: "hydria-sheet",
    version: 1,
    ...model,
    namedRanges,
    sheets,
    activeSheetId,
    activeSheet,
    columns: activeSheet.columns,
    rows: activeSheet.rows
  };
}

function parseSpreadsheetPreviewContent(content = "", { defaultSheetName = "Sheet 1" } = {}) {
  const raw = String(content || "").trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed.kind === "hydria-sheet" || Array.isArray(parsed.sheets))) {
        return normalizeSpreadsheetPreviewModel(parsed, { defaultSheetName });
      }
    } catch {
      // Fallback to CSV parsing below.
    }
  }

  const rows = parseCsvRows(content);
  if (!rows.length) {
    return normalizeSpreadsheetPreviewModel(
      {
        sheets: [
          {
            id: "sheet-1",
            name: defaultSheetName,
            columns: ["Column 1", "Column 2", "Column 3"],
            rows: [["", "", ""]]
          }
        ]
      },
      { defaultSheetName }
    );
  }

  const [header, ...bodyRows] = rows;
  const width = Math.max(header.length || 0, ...bodyRows.map((row) => row.length), 1);
  return normalizeSpreadsheetPreviewModel(
    {
      sheets: [
        {
          id: "sheet-1",
          name: defaultSheetName,
          columns: Array.from({ length: width }, (_, index) => header[index] || `Column ${index + 1}`),
          rows: (bodyRows.length ? bodyRows : [[""]]).map((row) =>
            Array.from({ length: width }, (_, index) => row[index] || "")
          )
        }
      ]
    },
    { defaultSheetName }
  );
}

function renderSpreadsheetClonePreview(
  container,
  {
    model = { columns: ["A"], rows: [[""]] },
    profile = null,
    workObject = null,
    filePath = "",
    onGridEdit = null
  } = {}
) {
  let workbookModel = normalizeSpreadsheetPreviewModel(model, {
    defaultSheetName: profile?.sheetName || "Sheet 1"
  });
  const historyKey = getSpreadsheetHistoryKey(workObject, filePath);
  const initialHistorySnapshot = cloneSpreadsheetSnapshot(workbookModel);
  const historyState = getSpreadsheetHistoryState(historyKey, initialHistorySnapshot);
  const activeSheet = workbookModel.activeSheet;
  const minVisibleColumns = Math.max(activeSheet.columns.length, SPREADSHEET_MIN_VISIBLE_COLUMNS);
  const minVisibleRows = Math.max(activeSheet.rows.length + 1, SPREADSHEET_MIN_VISIBLE_ROWS);
  let sheetGrid = Array.from({ length: minVisibleRows }, (_, rowIndex) =>
    Array.from({ length: minVisibleColumns }, (_, columnIndex) =>
      rowIndex === 0
        ? activeSheet.columns[columnIndex] || ""
        : activeSheet.rows[rowIndex - 1]?.[columnIndex] || ""
    )
  );
  const initialSelectionState = normalizeSpreadsheetSelectionState(
    spreadsheetSelectionStore.get(historyKey),
    sheetGrid.length,
    sheetGrid[0]?.length || 1
  );
  const columnLetter = (index) => {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  };

  const addressToCoords = (address = "") => {
    const match = String(address || "").trim().toUpperCase().match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      return null;
    }
    const [, absoluteColumn, letters, absoluteRow, rowText] = match;
    let columnIndex = 0;
    for (const letter of letters) {
      columnIndex = columnIndex * 26 + (letter.charCodeAt(0) - 64);
    }
    return {
      rowIndex: Math.max(0, Number(rowText) - 1),
      columnIndex: Math.max(0, columnIndex - 1),
      absoluteRow: absoluteRow === "$",
      absoluteColumn: absoluteColumn === "$"
    };
  };

  const coordsToAddress = (
    rowIndex = 0,
    columnIndex = 0,
    { absoluteRow = false, absoluteColumn = false } = {}
  ) => `${absoluteColumn ? "$" : ""}${columnLetter(columnIndex)}${absoluteRow ? "$" : ""}${rowIndex + 1}`;

  const ensureGridSize = (rowCount = 1, columnCount = 1) => {
    const targetRows = Math.max(1, rowCount, sheetGrid.length);
    const targetColumns = Math.max(1, columnCount, sheetGrid[0]?.length || 0);
    let didGrow = false;

    while (sheetGrid.length < targetRows) {
      sheetGrid.push(Array.from({ length: targetColumns }, () => ""));
      didGrow = true;
    }

    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      while (nextRow.length < targetColumns) {
        nextRow.push("");
        didGrow = true;
      }
      return nextRow;
    });
    return didGrow;
  };

  const getRawCellValue = (rowIndex = 0, columnIndex = 0) =>
    String(sheetGrid[rowIndex]?.[columnIndex] || "");

  const setRawCellValue = (rowIndex = 0, columnIndex = 0, value = "") => {
    ensureGridSize(rowIndex + 1, columnIndex + 1);
    sheetGrid[rowIndex][columnIndex] = String(value || "");
  };

  const trimGridToModel = () => {
    const cloned = sheetGrid.map((row) => [...row]);
    let lastColumn = 0;
    let lastRow = 0;

    cloned.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (String(value || "").trim()) {
          lastColumn = Math.max(lastColumn, columnIndex);
          lastRow = Math.max(lastRow, rowIndex);
        }
      });
    });

    const width = Math.max(1, lastColumn + 1);
    const height = Math.max(1, lastRow + 1);
    const normalized = Array.from({ length: height }, (_, rowIndex) =>
      Array.from({ length: width }, (_, columnIndex) => cloned[rowIndex]?.[columnIndex] || "")
    );

    const [columns = [""], ...rows] = normalized;
    return {
      columns,
      rows: rows.length ? rows : [[""]]
    };
  };

  const normalizeNumeric = (value = "") => {
    const numeric = Number(String(value || "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  const getViewportStoreKey = () => `${historyKey}::${getActiveSheetState()?.id || "sheet"}`;

  const getVirtualWindowSize = () => Math.max(80, Math.min(VIRTUAL_WINDOW_SIZE, sheetGrid.length));

  const isWindowedRenderingEnabled = () => sheetGrid.length > 260;

  const setVirtualWindowStart = (nextStart = 0) => {
    virtualWindowStart = clamp(nextStart, 0, Math.max(0, sheetGrid.length - getVirtualWindowSize()));
    spreadsheetViewportStore.set(getViewportStoreKey(), virtualWindowStart);
    return virtualWindowStart;
  };

  const getVirtualWindowBounds = (selectionRowIndex = activeSelection.rowIndex) => {
    if (!isWindowedRenderingEnabled()) {
      return { startRowIndex: 0, endRowIndex: sheetGrid.length - 1 };
    }
    return {
      startRowIndex: clamp(virtualWindowStart, 0, Math.max(0, sheetGrid.length - getVirtualWindowSize())),
      endRowIndex: clamp(virtualWindowStart + getVirtualWindowSize() - 1, 0, sheetGrid.length - 1)
    };
  };

  const ensureVirtualWindowContainsRow = (rowIndex = activeSelection.rowIndex) => {
    if (!isWindowedRenderingEnabled()) {
      return false;
    }
    const { startRowIndex, endRowIndex } = getVirtualWindowBounds();
    if (rowIndex >= startRowIndex && rowIndex <= endRowIndex) {
      return false;
    }
    setVirtualWindowStart(Math.max(0, rowIndex - Math.floor(getVirtualWindowSize() / 3)));
    return true;
  };

  const coerceNumeric = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    const numeric = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  };

  const isFormulaErrorValue = (value) => String(value ?? "").trim().startsWith("#");

  const coerceBoolean = (value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.startsWith("#")) {
      return false;
    }
    if (["true", "yes", "oui"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "non"].includes(normalized)) {
      return false;
    }
    const numeric = Number(normalized.replace(",", "."));
    if (Number.isFinite(numeric)) {
      return numeric !== 0;
    }
    return true;
  };

  const coerceText = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => coerceText(entry)).join(", ");
    }
    return String(value ?? "");
  };

  const serializeFormulaValue = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return JSON.stringify(coerceText(value));
  };

  const splitFormulaArgs = (value = "") => {
    const parts = [];
    let depth = 0;
    let current = "";
    let inQuotes = false;
    const source = String(value || "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === "\"") {
        current += char;
        if (inQuotes && next === "\"") {
          current += next;
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "(") {
        depth += 1;
        current += char;
        continue;
      }
      if (char === ")") {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }
      if ((char === "," || char === ";") && depth === 0 && !inQuotes) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
  };

  const getWorkbookNamedRanges = () => normalizeSpreadsheetNamedRanges(workbookModel.namedRanges || workbookModel.names);

  const setWorkbookNamedRanges = (namedRanges = []) => {
    workbookModel.namedRanges = normalizeSpreadsheetNamedRanges(namedRanges);
    delete workbookModel.names;
    return workbookModel.namedRanges;
  };

  const getNamedRangeByName = (name = "", { sheetId = workbookModel.activeSheetId } = {}) => {
    const lookup = String(name || "").trim().toLowerCase();
    if (!lookup) {
      return null;
    }
    const matches = getWorkbookNamedRanges().filter((namedRange) => namedRange.name.toLowerCase() === lookup);
    return (
      matches.find((namedRange) => namedRange.sheetId && namedRange.sheetId === sheetId) ||
      matches.find((namedRange) => !namedRange.sheetId || namedRange.scope === "workbook") ||
      matches[0] ||
      null
    );
  };

  const resolveNamedRangeAddress = (reference = "", options = {}) =>
    getNamedRangeByName(reference, options)?.range || "";

  const getFormulaTableByName = (name = "") => {
    const lookup = String(name || "").trim().toLowerCase();
    const activeFormulaSheet =
      workbookModel.sheets.find((sheet) => sheet.id === workbookModel.activeSheetId) ||
      workbookModel.activeSheet ||
      activeSheet;
    return normalizeSpreadsheetTables(activeFormulaSheet?.tables).find((table) => table.name.toLowerCase() === lookup) || null;
  };

  const getFormulaTableHeaderNames = (table = {}) => {
    const bounds = normalizeSpreadsheetStructureBounds(table);
    return Array.from({ length: bounds.endColumnIndex - bounds.startColumnIndex + 1 }, (_, offset) => {
      const columnIndex = bounds.startColumnIndex + offset;
      const header = table.showHeaderRow === false ? "" : getRawCellValue(bounds.startRowIndex, columnIndex);
      return String(header || `Column ${offset + 1}`).trim() || `Column ${offset + 1}`;
    });
  };

  const getFormulaTableColumnIndex = (table = {}, columnName = "") => {
    const lookup = String(columnName || "").trim().toLowerCase();
    const bounds = normalizeSpreadsheetStructureBounds(table);
    const headers = getFormulaTableHeaderNames(table);
    const offset = headers.findIndex((header) => header.toLowerCase() === lookup);
    return offset >= 0 ? bounds.startColumnIndex + offset : -1;
  };

  const getFormulaTableDataStartRow = (table = {}) => {
    const bounds = normalizeSpreadsheetStructureBounds(table);
    return bounds.startRowIndex + (table.showHeaderRow === false ? 0 : 1);
  };

  const getFormulaTableDataEndRow = (table = {}) => {
    const bounds = normalizeSpreadsheetStructureBounds(table);
    return table.showTotalRow ? Math.max(getFormulaTableDataStartRow(table) - 1, bounds.endRowIndex - 1) : bounds.endRowIndex;
  };

  const resolveStructuredTableReferenceAddress = (reference = "") => {
    const text = String(reference || "").trim();
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_.]*)\[(.+)\]$/);
    if (!match) {
      return "";
    }
    const [, tableName, rawSelector] = match;
    const table = getFormulaTableByName(tableName);
    if (!table) {
      return "";
    }
    const bounds = normalizeSpreadsheetStructureBounds(table);
    const selectorParts = rawSelector
      .split(/\]\s*,\s*\[/)
      .map((part) => part.replace(/^\[/, "").replace(/\]$/, "").trim())
      .filter(Boolean);
    const selector = selectorParts[selectorParts.length - 1] || rawSelector.trim();
    const hasAll = selectorParts.some((part) => part.toLowerCase() === "#all") || selector.toLowerCase() === "#all";
    const hasHeaders = selector.toLowerCase() === "#headers";
    const hasTotals = selector.toLowerCase() === "#totals";
    const hasData = selectorParts.some((part) => part.toLowerCase() === "#data") || selector.toLowerCase() === "#data";
    let minRow = hasAll ? bounds.startRowIndex : getFormulaTableDataStartRow(table);
    let maxRow = hasAll ? bounds.endRowIndex : getFormulaTableDataEndRow(table);
    if (hasHeaders) {
      minRow = bounds.startRowIndex;
      maxRow = bounds.startRowIndex;
    } else if (hasTotals) {
      minRow = table.showTotalRow ? bounds.endRowIndex : bounds.endRowIndex + 1;
      maxRow = minRow;
    } else if (hasData) {
      minRow = getFormulaTableDataStartRow(table);
      maxRow = getFormulaTableDataEndRow(table);
    }
    let minColumn = bounds.startColumnIndex;
    let maxColumn = bounds.endColumnIndex;
    const columnSelector = selectorParts.find((part) => !part.startsWith("#")) || (!selector.startsWith("#") ? selector : "");
    if (columnSelector) {
      const columnIndex = getFormulaTableColumnIndex(table, columnSelector);
      if (columnIndex < 0) {
        return "";
      }
      minColumn = columnIndex;
      maxColumn = columnIndex;
    }
    if (maxRow < minRow || maxColumn < minColumn) {
      return "";
    }
    const startAddress = coordsToAddress(minRow, minColumn);
    const endAddress = coordsToAddress(maxRow, maxColumn);
    return startAddress === endAddress ? startAddress : `${startAddress}:${endAddress}`;
  };

  const resolveReferenceAddress = (reference = "", options = {}) =>
    resolveStructuredTableReferenceAddress(reference) ||
    resolveNamedRangeAddress(reference, options) ||
    String(reference || "").trim();

  const getRangeBoundsFromAddress = (range = "") => {
    const [start, end = start] = String(range || "").split(":");
    const startCoords = addressToCoords(start);
    const endCoords = addressToCoords(end);
    if (!startCoords || !endCoords) {
      return null;
    }
    return {
      minRow: Math.min(startCoords.rowIndex, endCoords.rowIndex),
      maxRow: Math.max(startCoords.rowIndex, endCoords.rowIndex),
      minColumn: Math.min(startCoords.columnIndex, endCoords.columnIndex),
      maxColumn: Math.max(startCoords.columnIndex, endCoords.columnIndex)
    };
  };

  const collectRangeMatrix = (range = "", stack = new Set()) => {
    const bounds = getRangeBoundsFromAddress(resolveReferenceAddress(range));
    if (!bounds) {
      return [];
    }
    return Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, rowOffset) =>
      Array.from({ length: bounds.maxColumn - bounds.minColumn + 1 }, (_, columnOffset) =>
        evaluateCellValue(bounds.minRow + rowOffset, bounds.minColumn + columnOffset, stack)
      )
    );
  };

  const flattenFormulaMatrix = (matrix = []) =>
    matrix.flatMap((row) => (Array.isArray(row) ? row : [row]));

  const collectRangeValues = (range = "", stack = new Set()) => flattenFormulaMatrix(collectRangeMatrix(range, stack));

  const getIntersectionAddress = (leftReference = "", rightReference = "") => {
    const leftBounds = getRangeBoundsFromAddress(resolveReferenceAddress(leftReference));
    const rightBounds = getRangeBoundsFromAddress(resolveReferenceAddress(rightReference));
    if (!leftBounds || !rightBounds) {
      return "";
    }
    const minRow = Math.max(leftBounds.minRow, rightBounds.minRow);
    const maxRow = Math.min(leftBounds.maxRow, rightBounds.maxRow);
    const minColumn = Math.max(leftBounds.minColumn, rightBounds.minColumn);
    const maxColumn = Math.min(leftBounds.maxColumn, rightBounds.maxColumn);
    if (minRow > maxRow || minColumn > maxColumn) {
      return "";
    }
    const startAddress = coordsToAddress(minRow, minColumn);
    const endAddress = coordsToAddress(maxRow, maxColumn);
    return startAddress === endAddress ? startAddress : `${startAddress}:${endAddress}`;
  };

  const resolveReferenceIntersections = (value = "") => {
    const referencePattern = "\\$?[A-Z]+\\$?\\d+(?::\\$?[A-Z]+\\$?\\d+)?";
    const intersectionPattern = new RegExp(`(${referencePattern})\\s+(${referencePattern})`, "gi");
    let output = String(value || "");
    let safety = 0;
    while (safety < 50) {
      let foundEmptyIntersection = false;
      let changed = false;
      output = replaceFormulaOutsideQuotes(output, (segment) =>
        segment.replace(intersectionPattern, (match, leftReference, rightReference) => {
          const intersection = getIntersectionAddress(leftReference, rightReference);
          if (!intersection) {
            foundEmptyIntersection = true;
            return match;
          }
          changed = true;
          return intersection;
        })
      );
      if (foundEmptyIntersection) {
        return { error: "#NUL!", expression: output };
      }
      if (!changed) {
        return { error: "", expression: output };
      }
      safety += 1;
    }
    return { error: "#ERROR!", expression: output };
  };

  const formatFormulaResult = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (Number.isInteger(value)) {
        return String(value);
      }
      return value.toFixed(2).replace(/\.?0+$/, "");
    }
    return String(value ?? "");
  };

  // Excel operators are normalized only outside string literals, so formulas like ="A&B" stay intact.
  const replaceFormulaOutsideQuotes = (value = "", replacer = (segment) => segment) => {
    const source = String(value || "");
    let output = "";
    let current = "";
    let inQuotes = false;
    const flush = () => {
      output += inQuotes ? current : replacer(current);
      current = "";
    };

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (inQuotes && char === "\\") {
        current += char;
        if (next !== undefined) {
          current += next;
          index += 1;
        }
        continue;
      }
      if (char === "\"") {
        if (inQuotes && next === "\"") {
          current += `${char}${next}`;
          index += 1;
          continue;
        }
        flush();
        output += char;
        inQuotes = !inQuotes;
        continue;
      }
      current += char;
    }
    flush();
    return output;
  };

  const normalizeFormulaExpression = (value = "") =>
    replaceFormulaOutsideQuotes(String(value || ""), (segment) =>
      segment
        .replace(/<>/g, "!=")
        .replace(/(^|[^><!=])=([^=]|$)/g, "$1==$2")
        .replace(/\^/g, "**")
        .replace(/&/g, "+")
        .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
        .replace(/\bTRUE\b/gi, "true")
        .replace(/\bFALSE\b/gi, "false")
        .replace(/\bVRAI\b/gi, "true")
        .replace(/\bFAUX\b/gi, "false")
    );

  const evaluateFormula = (expression = "", stack = new Set()) => {
    let expr = String(expression || "").trim();
    if (!expr) {
      return "";
    }
    const intersectionResult = resolveReferenceIntersections(expr);
    if (intersectionResult.error) {
      return intersectionResult.error;
    }
    expr = intersectionResult.expression;

    const evaluateFormulaArgument = (arg = "") => {
      const trimmed = String(arg || "").trim();
      if (!trimmed) {
        return "";
      }
      if (/^".*"$/.test(trimmed)) {
        return trimmed.slice(1, -1).replace(/""/g, "\"").replace(/\\"/g, "\"");
      }
      const resolvedReference = resolveReferenceAddress(trimmed);
      if (resolvedReference && resolvedReference !== trimmed) {
        if (/^\$?[A-Z]+\$?\d+$/i.test(resolvedReference)) {
          return evaluateCellValueByAddress(resolvedReference, stack);
        }
        if (/^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(resolvedReference)) {
          return collectRangeValues(resolvedReference, stack);
        }
      }
      if (/^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(trimmed)) {
        return collectRangeValues(trimmed, stack);
      }
      if (/^\$?[A-Z]+\$?\d+$/i.test(trimmed)) {
        return evaluateCellValueByAddress(trimmed, stack);
      }
      if (/^(TRUE|VRAI)$/i.test(trimmed)) {
        return true;
      }
      if (/^(FALSE|FAUX)$/i.test(trimmed)) {
        return false;
      }
      const numeric = Number(trimmed.replace(",", "."));
      if (Number.isFinite(numeric)) {
        return numeric;
      }
      return evaluateFormula(trimmed.startsWith("=") ? trimmed.slice(1) : trimmed, stack);
    };

    const collectAggregateValues = (args = []) =>
      args.flatMap((arg) => {
        const evaluated = evaluateFormulaArgument(arg);
        const values = Array.isArray(evaluated) ? evaluated : [evaluated];
        return values
          .map((entry) => coerceNumeric(entry))
          .filter((entry) => Number.isFinite(entry));
      });

    const matchesCriterion = (value, criterion = "") => {
      const rawCriterion = String(criterion ?? "").trim().replace(/^"(.*)"$/, "$1");
      if (!rawCriterion) {
        return String(value ?? "").trim() === "";
      }
      const normalizedValue = typeof value === "number" ? value : String(value ?? "").trim();
      const operatorMatch = rawCriterion.match(/^(<=|>=|<>|=|<|>)(.*)$/);
      if (!operatorMatch) {
        if (/[*?]/.test(rawCriterion)) {
          const pattern = new RegExp(
            `^${rawCriterion
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, ".*")
              .replace(/\?/g, ".")}$`,
            "i"
          );
          return pattern.test(String(normalizedValue));
        }
        return String(normalizedValue).toLowerCase() === rawCriterion.toLowerCase();
      }
      const [, operator, operandSource] = operatorMatch;
      const operandRaw = operandSource.trim();
      const leftNumeric = coerceNumeric(normalizedValue);
      const rightNumeric = coerceNumeric(operandRaw);
      const useNumeric = Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric);
      const left = useNumeric ? leftNumeric : String(normalizedValue).toLowerCase();
      const right = useNumeric ? rightNumeric : operandRaw.toLowerCase();
      switch (operator) {
        case "=":
          return left === right;
        case "<>":
          return left !== right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        default:
          return false;
      }
    };

    const resolveCriterionArgument = (criterionArg = "") => {
      const trimmed = String(criterionArg ?? "").trim();
      if (!trimmed) {
        return "";
      }
      if (/^".*"$/.test(trimmed)) {
        return trimmed.slice(1, -1).replace(/""/g, "\"").replace(/\\"/g, "\"");
      }
      if (/^(<=|>=|<>|=|<|>)/.test(trimmed)) {
        return trimmed;
      }
      const evaluated = evaluateFormulaArgument(trimmed);
      return Array.isArray(evaluated) ? coerceText(evaluated[0]) : coerceText(evaluated);
    };

    const valuesForFormulaArgument = (arg = "") => {
      const evaluated = evaluateFormulaArgument(arg);
      return Array.isArray(evaluated) ? evaluated : [evaluated];
    };

    const matrixForFormulaArgument = (arg = "") => {
      const trimmed = String(arg || "").trim();
      const rangeReference = resolveReferenceAddress(trimmed);
      if (/^\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?$/i.test(rangeReference)) {
        return collectRangeMatrix(rangeReference, stack);
      }
      const evaluated = evaluateFormulaArgument(trimmed);
      return Array.isArray(evaluated) ? [evaluated] : [[evaluated]];
    };

    const serializeFormulaMatrix = (matrix = []) => {
      const rows = Array.isArray(matrix?.[0]) ? matrix : [matrix];
      return serializeFormulaValue(rows.map((row) => row.map((entry) => coerceText(entry)).join(", ")).join("; "));
    };

    const evaluateCriteriaMask = (includeArg = "", rowCount = 0) => {
      const trimmed = String(includeArg || "").trim();
      const comparisonMatch = trimmed.match(/^(.+?)\s*(<=|>=|<>|=|<|>)\s*(.+)$/i);
      if (comparisonMatch) {
        const [, rangeAddress, operator, criterionSource] = comparisonMatch;
        const resolvedRangeAddress = resolveReferenceAddress(rangeAddress);
        if (!/^\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?$/i.test(resolvedRangeAddress)) {
          return Array.from({ length: rowCount }, () => false);
        }
        const criterion = `${operator}${resolveCriterionArgument(criterionSource)}`;
        return collectRangeValues(resolvedRangeAddress, stack).slice(0, rowCount).map((entry) => matchesCriterion(entry, criterion));
      }
      const includeValues = valuesForFormulaArgument(trimmed);
      return Array.from({ length: rowCount }, (_, index) => coerceBoolean(includeValues[index] ?? includeValues[0]));
    };

    const padFormulaNumber = (value = 0, length = 2) => String(Math.trunc(Math.abs(value))).padStart(length, "0");

    const dateToFormulaText = (date) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
      }
      return `${date.getFullYear()}-${padFormulaNumber(date.getMonth() + 1)}-${padFormulaNumber(date.getDate())}`;
    };

    const parseFormulaDate = (value) => {
      if (value instanceof Date) {
        return value;
      }
      const numeric = coerceNumeric(value);
      if (Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
        const date = new Date(Date.UTC(1899, 11, 30));
        date.setUTCDate(date.getUTCDate() + Math.trunc(numeric));
        return date;
      }
      const parsed = new Date(coerceText(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const valueFromText = (value = "") => {
      const text = coerceText(value).trim();
      const percent = text.endsWith("%");
      const cleaned = text.replace(/[%\s\u00a0]/g, "").replace(/[€$£¥]/g, "").replace(",", ".");
      const numeric = Number(cleaned);
      if (!Number.isFinite(numeric)) {
        return Number.NaN;
      }
      return percent ? numeric / 100 : numeric;
    };

    const formatTextValue = (value, format = "") => {
      const formatText = coerceText(format);
      const numeric = coerceNumeric(value);
      const dateValue = parseFormulaDate(value);
      if (/y{2,4}|d{1,2}|m{1,2}/i.test(formatText) && dateValue) {
        return formatText
          .replace(/yyyy/gi, String(dateValue.getFullYear()))
          .replace(/yy/gi, String(dateValue.getFullYear()).slice(-2))
          .replace(/mm/g, padFormulaNumber(dateValue.getMonth() + 1))
          .replace(/m/g, String(dateValue.getMonth() + 1))
          .replace(/dd/gi, padFormulaNumber(dateValue.getDate()))
          .replace(/d/gi, String(dateValue.getDate()));
      }
      if (Number.isFinite(numeric)) {
        const decimalMatch = formatText.match(/0\.([0]+)/);
        const decimals = decimalMatch ? decimalMatch[1].length : 0;
        const scaled = formatText.includes("%") ? numeric * 100 : numeric;
        const formatted = decimals ? scaled.toFixed(decimals) : String(Math.round(scaled));
        if (/[$€]/.test(formatText)) {
          return `${formatted} EUR`;
        }
        return formatText.includes("%") ? `${formatted}%` : formatted;
      }
      return coerceText(value);
    };

    // Function arguments can contain nested functions and arithmetic groups; a regex is too brittle here.
    const findFormulaClosingParen = (source = "", openIndex = 0) => {
      let depth = 0;
      let inQuotes = false;
      for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];
        if (inQuotes && char === "\\") {
          index += 1;
          continue;
        }
        if (char === "\"") {
          if (inQuotes && next === "\"") {
            index += 1;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }
        if (inQuotes) {
          continue;
        }
        if (char === "(") {
          depth += 1;
          continue;
        }
        if (char === ")") {
          depth -= 1;
          if (depth === 0) {
            return index;
          }
        }
      }
      return -1;
    };

    const findNextFormulaFunctionCall = (source = "") => {
      let inQuotes = false;
      for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];
        if (inQuotes && char === "\\") {
          index += 1;
          continue;
        }
        if (char === "\"") {
          if (inQuotes && next === "\"") {
            index += 1;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }
        if (inQuotes || !/[A-Za-z_]/.test(char)) {
          continue;
        }
        const previous = source[index - 1] || "";
        if (/[A-Za-z0-9_.]/.test(previous)) {
          continue;
        }
        let endName = index + 1;
        while (endName < source.length && /[A-Za-z0-9_.]/.test(source[endName])) {
          endName += 1;
        }
        const rawName = source.slice(index, endName);
        const name = normalizeSpreadsheetFormulaName(rawName);
        if (!SPREADSHEET_BUILTIN_FORMULA_NAMES.has(name)) {
          index = endName - 1;
          continue;
        }
        let openIndex = endName;
        while (openIndex < source.length && /\s/.test(source[openIndex])) {
          openIndex += 1;
        }
        if (source[openIndex] !== "(") {
          index = endName - 1;
          continue;
        }
        const closeIndex = findFormulaClosingParen(source, openIndex);
        if (closeIndex < 0) {
          return { error: true, start: index };
        }
        return {
          start: index,
          end: closeIndex + 1,
          name,
          argsSource: source.slice(openIndex + 1, closeIndex)
        };
      }
      return null;
    };

    const evaluateFormulaFunction = (rawName = "", argsSource = "") => {
      const fn = normalizeSpreadsheetFormulaName(rawName);
      const args = splitFormulaArgs(argsSource);
      const values = collectAggregateValues(args);

      switch (fn) {
          case "SUM":
            return serializeFormulaValue(values.reduce((sum, value) => sum + value, 0));
          case "SUMIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            const sumValues = args.length >= 3
              ? valuesForFormulaArgument(args[2])
              : criteriaRange;
            let total = 0;
            criteriaRange.forEach((entry, index) => {
              if (matchesCriterion(entry, criterion)) {
                total += normalizeNumeric(sumValues[index] ?? sumValues[0] ?? 0);
              }
            });
            return serializeFormulaValue(total);
          }
          case "SUMIFS": {
            const sumValues = valuesForFormulaArgument(args[0]);
            const criteriaPairs = [];
            for (let index = 1; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const total = sumValues.reduce((sum, value, index) => {
              const matches = criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion));
              return matches ? sum + normalizeNumeric(value) : sum;
            }, 0);
            return serializeFormulaValue(total);
          }
          case "COUNTIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            return serializeFormulaValue(criteriaRange.filter((entry) => matchesCriterion(entry, criterion)).length);
          }
          case "COUNTIFS": {
            const criteriaPairs = [];
            for (let index = 0; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const length = Math.max(0, ...criteriaPairs.map((pair) => pair.range.length));
            let count = 0;
            for (let index = 0; index < length; index += 1) {
              if (criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion))) {
                count += 1;
              }
            }
            return serializeFormulaValue(count);
          }
          case "AVERAGEIF": {
            const criteriaRange = valuesForFormulaArgument(args[0]);
            const criterion = resolveCriterionArgument(args[1] || "");
            const averageValues = args.length >= 3 ? valuesForFormulaArgument(args[2]) : criteriaRange;
            const matchedValues = averageValues
              .filter((value, index) => matchesCriterion(criteriaRange[index], criterion))
              .map((value) => coerceNumeric(value))
              .filter((value) => Number.isFinite(value));
            return serializeFormulaValue(
              matchedValues.length ? matchedValues.reduce((sum, value) => sum + value, 0) / matchedValues.length : 0
            );
          }
          case "AVERAGEIFS": {
            const averageValues = valuesForFormulaArgument(args[0]);
            const criteriaPairs = [];
            for (let index = 1; index < args.length; index += 2) {
              criteriaPairs.push({
                range: valuesForFormulaArgument(args[index]),
                criterion: resolveCriterionArgument(args[index + 1] || "")
              });
            }
            const matchedValues = averageValues
              .filter((value, index) => criteriaPairs.every((pair) => matchesCriterion(pair.range[index], pair.criterion)))
              .map((value) => coerceNumeric(value))
              .filter((value) => Number.isFinite(value));
            return serializeFormulaValue(
              matchedValues.length ? matchedValues.reduce((sum, value) => sum + value, 0) / matchedValues.length : 0
            );
          }
          case "AVERAGE":
          case "AVG":
            return serializeFormulaValue(
              values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
            );
          case "MIN":
            return serializeFormulaValue(values.length ? Math.min(...values) : 0);
          case "MAX":
            return serializeFormulaValue(values.length ? Math.max(...values) : 0);
          case "COUNT":
            return serializeFormulaValue(values.length);
          case "COUNTA": {
            const entries = args.flatMap((arg) => valuesForFormulaArgument(arg));
            return serializeFormulaValue(entries.filter((entry) => String(entry ?? "").trim()).length);
          }
          case "COUNTBLANK": {
            const entries = args.flatMap((arg) => valuesForFormulaArgument(arg));
            return serializeFormulaValue(entries.filter((entry) => !String(entry ?? "").trim()).length);
          }
          case "PRODUCT":
            return serializeFormulaValue(values.length ? values.reduce((product, value) => product * value, 1) : 0);
          case "MEDIAN": {
            const sortedValues = [...values].sort((left, right) => left - right);
            if (!sortedValues.length) {
              return serializeFormulaValue(0);
            }
            const middle = Math.floor(sortedValues.length / 2);
            return serializeFormulaValue(
              sortedValues.length % 2
                ? sortedValues[middle]
                : (sortedValues[middle - 1] + sortedValues[middle]) / 2
            );
          }
          case "SUBTOTAL": {
            const functionNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[0])) || 0) % 100;
            const subtotalValues = collectAggregateValues(args.slice(1));
            switch (functionNumber) {
              case 1:
                return serializeFormulaValue(
                  subtotalValues.length
                    ? subtotalValues.reduce((sum, value) => sum + value, 0) / subtotalValues.length
                    : 0
                );
              case 2:
                return serializeFormulaValue(subtotalValues.length);
              case 3: {
                const countAValues = args.slice(1).flatMap((arg) => valuesForFormulaArgument(arg));
                return serializeFormulaValue(countAValues.filter((entry) => String(entry ?? "").trim()).length);
              }
              case 4:
                return serializeFormulaValue(subtotalValues.length ? Math.max(...subtotalValues) : 0);
              case 5:
                return serializeFormulaValue(subtotalValues.length ? Math.min(...subtotalValues) : 0);
              case 9:
              default:
                return serializeFormulaValue(subtotalValues.reduce((sum, value) => sum + value, 0));
            }
          }
          case "INDEX": {
            const matrix = matrixForFormulaArgument(args[0]);
            const rowNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0);
            const columnNumber = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            if (!matrix.length) {
              return serializeFormulaValue("#REF!");
            }
            if (rowNumber === 0) {
              return serializeFormulaMatrix(matrix.map((row) => [row[Math.max(0, columnNumber - 1)] ?? ""]));
            }
            if (columnNumber === 0) {
              return serializeFormulaMatrix([matrix[Math.max(0, rowNumber - 1)] || []]);
            }
            return serializeFormulaValue(matrix[rowNumber - 1]?.[columnNumber - 1] ?? "#REF!");
          }
          case "MATCH": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const lookupValues = valuesForFormulaArgument(args[1]);
            const matchType = args[2] === undefined ? 0 : Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 0);
            if (matchType === 0) {
              const exactIndex = lookupValues.findIndex(
                (entry) => String(entry ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
              );
              return serializeFormulaValue(exactIndex >= 0 ? exactIndex + 1 : "#N/A");
            }
            const lookupNumeric = coerceNumeric(lookupValue);
            const matches = lookupValues
              .map((entry, index) => ({ value: coerceNumeric(entry), index }))
              .filter((entry) => Number.isFinite(entry.value));
            const candidate = matchType < 0
              ? matches.filter((entry) => entry.value >= lookupNumeric).sort((left, right) => left.value - right.value)[0]
              : matches.filter((entry) => entry.value <= lookupNumeric).sort((left, right) => right.value - left.value)[0];
            return serializeFormulaValue(candidate ? candidate.index + 1 : "#N/A");
          }
          case "FILTER": {
            const matrix = matrixForFormulaArgument(args[0]);
            const mask = evaluateCriteriaMask(args[1], matrix.length);
            const filtered = matrix.filter((row, index) => mask[index]);
            if (!filtered.length) {
              return serializeFormulaValue(args[2] !== undefined ? evaluateFormulaArgument(args[2]) : "#CALC!");
            }
            return serializeFormulaMatrix(filtered);
          }
          case "SORT": {
            const matrix = matrixForFormulaArgument(args[0]);
            const sortIndex = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1)) - 1;
            const sortOrder = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            const sorted = [...matrix].sort((leftRow, rightRow) => {
              const left = leftRow[sortIndex] ?? "";
              const right = rightRow[sortIndex] ?? "";
              const result = String(left).localeCompare(String(right), "fr", { numeric: true, sensitivity: "base" });
              return sortOrder < 0 ? -result : result;
            });
            return serializeFormulaMatrix(sorted);
          }
          case "UNIQUE": {
            const matrix = matrixForFormulaArgument(args[0]);
            const seen = new Set();
            const uniqueRows = matrix.filter((row) => {
              const key = row.map((entry) => String(entry ?? "").toLowerCase()).join("\u001f");
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });
            return serializeFormulaMatrix(uniqueRows);
          }
          case "TODAY":
            return serializeFormulaValue(dateToFormulaText(new Date()));
          case "NOW": {
            const now = new Date();
            return serializeFormulaValue(
              `${dateToFormulaText(now)} ${padFormulaNumber(now.getHours())}:${padFormulaNumber(now.getMinutes())}`
            );
          }
          case "DATE": {
            const year = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[0])) || 0);
            const month = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1);
            const day = Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1);
            return serializeFormulaValue(dateToFormulaText(new Date(year, month - 1, day)));
          }
          case "TEXT":
            return serializeFormulaValue(formatTextValue(evaluateFormulaArgument(args[0]), evaluateFormulaArgument(args[1])));
          case "LEFT": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const length = args[1] === undefined ? 1 : Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            return serializeFormulaValue(text.slice(0, length));
          }
          case "RIGHT": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const length = args[1] === undefined ? 1 : Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            return serializeFormulaValue(text.slice(Math.max(0, text.length - length)));
          }
          case "MID": {
            const text = coerceText(evaluateFormulaArgument(args[0]));
            const start = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 1));
            const length = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 0));
            return serializeFormulaValue(text.slice(start - 1, start - 1 + length));
          }
          case "TRIM":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).replace(/\s+/g, " ").trim());
          case "VALUE": {
            const parsed = valueFromText(evaluateFormulaArgument(args[0]));
            return serializeFormulaValue(Number.isFinite(parsed) ? parsed : "#VALUE!");
          }
          case "ABS": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            return serializeFormulaValue(Number.isFinite(source) ? Math.abs(source) : 0);
          }
          case "ROUND": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.round(source * factor) / factor : 0);
          }
          case "ROUNDUP": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.ceil(source * factor) / factor : 0);
          }
          case "ROUNDDOWN": {
            const source = coerceNumeric(evaluateFormulaArgument(args[0]));
            const digits = Math.max(0, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[1])) || 0));
            const factor = 10 ** digits;
            return serializeFormulaValue(Number.isFinite(source) ? Math.floor(source * factor) / factor : 0);
          }
          case "IF": {
            const condition = evaluateFormulaArgument(args[0]);
            if (isFormulaErrorValue(condition)) {
              return serializeFormulaValue(condition);
            }
            const truthy = evaluateFormulaArgument(args[1]);
            const falsy = evaluateFormulaArgument(args[2]);
            return serializeFormulaValue(coerceBoolean(condition) ? truthy : falsy);
          }
          case "IFERROR": {
            const primary = evaluateFormulaArgument(args[0]);
            const fallback = evaluateFormulaArgument(args[1]);
            return serializeFormulaValue(String(primary).startsWith("#") ? fallback : primary);
          }
          case "AND":
            return serializeFormulaValue(args.every((arg) => coerceBoolean(evaluateFormulaArgument(arg))));
          case "OR":
            return serializeFormulaValue(args.some((arg) => coerceBoolean(evaluateFormulaArgument(arg))));
          case "NOT":
            return serializeFormulaValue(!coerceBoolean(evaluateFormulaArgument(args[0])));
          case "CONCAT":
            return serializeFormulaValue(args.map((arg) => coerceText(evaluateFormulaArgument(arg))).join(""));
          case "LEN":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).length);
          case "UPPER":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).toUpperCase());
          case "LOWER":
            return serializeFormulaValue(coerceText(evaluateFormulaArgument(args[0])).toLowerCase());
          case "VLOOKUP": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const tableValues = Array.isArray(evaluateFormulaArgument(args[1]))
              ? evaluateFormulaArgument(args[1])
              : [];
            const columnOffset = Math.max(1, Math.trunc(coerceNumeric(evaluateFormulaArgument(args[2])) || 1)) - 1;
            const exactMatch = args[3] === undefined ? true : coerceBoolean(evaluateFormulaArgument(args[3]));
            if (!tableValues.length) {
              return serializeFormulaValue("#N/A");
            }
            const rows = [];
            const tableReference = resolveReferenceAddress(args[1]);
            const [rangeStart, rangeEnd = rangeStart] = String(tableReference || "").split(":");
            const startCoords = addressToCoords(rangeStart);
            const endCoords = addressToCoords(rangeEnd);
            if (startCoords && endCoords) {
              const minRow = Math.min(startCoords.rowIndex, endCoords.rowIndex);
              const maxRow = Math.max(startCoords.rowIndex, endCoords.rowIndex);
              const minColumn = Math.min(startCoords.columnIndex, endCoords.columnIndex);
              const maxColumn = Math.max(startCoords.columnIndex, endCoords.columnIndex);
              for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
                rows.push(
                  Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
                    evaluateCellValue(rowIndex, minColumn + offset, stack)
                  )
                );
              }
            }
            const targetRow = rows.find((row) =>
              exactMatch
                ? String(row[0] ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
                : String(row[0] ?? "").toLowerCase().includes(String(lookupValue ?? "").toLowerCase())
            );
            return serializeFormulaValue(targetRow?.[columnOffset] ?? "#N/A");
          }
          case "XLOOKUP": {
            const lookupValue = evaluateFormulaArgument(args[0]);
            const lookupRange = Array.isArray(evaluateFormulaArgument(args[1]))
              ? evaluateFormulaArgument(args[1])
              : [evaluateFormulaArgument(args[1])];
            const returnRange = Array.isArray(evaluateFormulaArgument(args[2]))
              ? evaluateFormulaArgument(args[2])
              : [evaluateFormulaArgument(args[2])];
            const matchIndex = lookupRange.findIndex(
              (entry) => String(entry ?? "").toLowerCase() === String(lookupValue ?? "").toLowerCase()
            );
            return serializeFormulaValue(matchIndex >= 0 ? returnRange[matchIndex] ?? "#N/A" : "#N/A");
          }
          default:
            return serializeFormulaValue(0);
        }
      };

    let functionSafety = 0;
    while (functionSafety < 200) {
      const call = findNextFormulaFunctionCall(expr);
      if (!call) {
        break;
      }
      if (call.error) {
        return "#ERROR!";
      }
      const replacement = evaluateFormulaFunction(call.name, call.argsSource);
      expr = `${expr.slice(0, call.start)}${replacement}${expr.slice(call.end)}`;
      functionSafety += 1;
    }
    if (functionSafety >= 200) {
      return "#ERROR!";
    }

    expr = expr.replace(/(^|[^A-Z0-9_])(\$?[A-Z]+\$?\d+)(?=[^A-Z0-9_]|$)/gi, (match, prefix, address) => {
      const evaluated = evaluateCellValueByAddress(address, stack);
      return `${prefix}${serializeFormulaValue(evaluated)}`;
    });

    expr = expr.replace(/(^|[^A-Z0-9_."])([A-Z_][A-Z0-9_.]*)(?=[^A-Z0-9_.]|$)/gi, (match, prefix, name) => {
      if (isSpreadsheetBuiltinFormulaName(name)) {
        return match;
      }
      const namedReference = resolveNamedRangeAddress(name);
      const bounds = namedReference ? getRangeBoundsFromAddress(namedReference) : null;
      if (!bounds) {
        return match;
      }
      if (bounds.minRow !== bounds.maxRow || bounds.minColumn !== bounds.maxColumn) {
        return `${prefix}${serializeFormulaValue("#VALUE!")}`;
      }
      const evaluated = evaluateCellValue(bounds.minRow, bounds.minColumn, stack);
      return `${prefix}${serializeFormulaValue(evaluated)}`;
    });

    expr = normalizeFormulaExpression(expr);
    const sanitized = expr
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "0")
      .replace(/\btrue\b/gi, "1")
      .replace(/\bfalse\b/gi, "0");

    if (/[^0-9+\-*/().,<>=!&|\s]/.test(sanitized)) {
      return "#ERROR!";
    }

    try {
      const result = Function(`"use strict"; return (${expr});`)();
      if (typeof result === "number") {
        return Number.isFinite(result) ? result : "#ERROR!";
      }
      if (typeof result === "string" || typeof result === "boolean") {
        return result;
      }
      return result ?? "";
    } catch {
      return "#ERROR!";
    }
  };

  function evaluateCellValueByAddress(address = "", stack = new Set()) {
    const coords = addressToCoords(address);
    if (!coords) {
      return "";
    }
    return evaluateCellValue(coords.rowIndex, coords.columnIndex, stack);
  }

  function evaluateCellValue(rowIndex = 0, columnIndex = 0, stack = new Set()) {
    const key = `${rowIndex}:${columnIndex}`;
    if (stack.has(key)) {
      return "#CYCLE!";
    }
    const rawValue = getRawCellValue(rowIndex, columnIndex);
    if (!rawValue.startsWith("=")) {
      return rawValue;
    }
    const nextStack = new Set(stack);
    nextStack.add(key);
    return evaluateFormula(rawValue.slice(1), nextStack);
  }

  const previewShell = document.createElement("section");
  previewShell.className = "workspace-sheet-app";
  const ribbonTabIds = ["File", "Home", "Insert", "Formulas", "Data", "Review", "View", "Sheet"];
  let activeRibbonTab = ribbonTabIds.includes(spreadsheetRibbonTabStore.get(historyKey))
    ? spreadsheetRibbonTabStore.get(historyKey)
    : "Home";
  let isRibbonVisible = spreadsheetRibbonVisibilityStore.get(historyKey) === true;
  let isSheetExpanded = spreadsheetExpandedStore.get(historyKey) === true;

  const menuBar = document.createElement("div");
  menuBar.className = "workspace-sheet-menubar";
  const sheetMenuButtons = new Map();
  ribbonTabIds.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-menu-button";
    button.textContent = label;
    button.setAttribute("aria-pressed", label === activeRibbonTab && isRibbonVisible ? "true" : "false");
    sheetMenuButtons.set(label, button);
    menuBar.appendChild(button);
  });
  previewShell.appendChild(menuBar);
  document.querySelectorAll(".workspace-sheet-menu-panel").forEach((panel) => {
    if (panel.dataset.historyKey === historyKey) {
      panel.remove();
    }
  });
  document.querySelectorAll(".workspace-sheet-formula-help").forEach((panel) => {
    if (panel.dataset.historyKey === historyKey) {
      panel.remove();
    }
  });
  const sheetMenuPanel = document.createElement("div");
  sheetMenuPanel.className = "workspace-sheet-menu-panel";
  sheetMenuPanel.dataset.historyKey = historyKey;
  sheetMenuPanel.hidden = true;
  sheetMenuPanel.setAttribute("role", "menu");
  // Menus live outside the sheet DOM to stay above the full-screen overlay;
  // these guards stop clicks from falling through to cells underneath.
  ["pointerdown", "mousedown", "click"].forEach((eventName) => {
    sheetMenuPanel.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  });
  sheetMenuPanel.addEventListener(
    "wheel",
    (event) => {
      if (sheetMenuPanel.hidden || !sheetMenuPanel.contains(event.target)) {
        return;
      }
      if (!sheetMenuPanel.classList.contains("is-chart-gallery")) {
        event.stopPropagation();
        return;
      }
      const scrollHost = sheetMenuPanel.querySelector(".workspace-sheet-chart-gallery") || sheetMenuPanel;
      const maxScrollTop = Math.max(0, scrollHost.scrollHeight - scrollHost.clientHeight);
      const nextScrollTop = clamp(scrollHost.scrollTop + event.deltaY, 0, maxScrollTop);
      event.preventDefault();
      event.stopPropagation();
      scrollHost.scrollTop = nextScrollTop;
    },
    { passive: false, capture: true }
  );
  document.body.appendChild(sheetMenuPanel);
  const xlsxImportInput = document.createElement("input");
  xlsxImportInput.type = "file";
  xlsxImportInput.className = "workspace-sheet-xlsx-input";
  xlsxImportInput.accept = ".xlsx,.xlsm,.xlsb,.xls";
  xlsxImportInput.hidden = true;
  previewShell.appendChild(xlsxImportInput);

  const topBar = document.createElement("div");
  topBar.className = "workspace-sheet-topbar";
  const titleGroup = document.createElement("div");
  titleGroup.className = "workspace-sheet-title-group";
  const title = document.createElement("strong");
  title.textContent = workObject?.title || friendlyPathLabel(filePath) || profile?.sheetName || "Sheet";
  const subtitle = document.createElement("span");
  subtitle.className = "tiny";
  const hiddenSheetCount = workbookModel.sheets.filter((sheet) => sheet.hidden).length;
  subtitle.textContent = `${activeSheet.rows.length + 1} rows | ${activeSheet.columns.length} columns | ${workbookModel.sheets.length} sheet${workbookModel.sheets.length > 1 ? "s" : ""}${hiddenSheetCount ? ` | ${hiddenSheetCount} hidden` : ""}`;
  titleGroup.append(title, subtitle);
  const commandSearch = document.createElement("label");
  commandSearch.className = "workspace-sheet-command-search";
  const commandSearchIcon = document.createElement("span");
  commandSearchIcon.className = "workspace-sheet-command-search-icon";
  commandSearchIcon.setAttribute("aria-hidden", "true");
  const commandSearchInput = document.createElement("input");
  commandSearchInput.type = "search";
  commandSearchInput.placeholder = "Rechercher dans la feuille ou les commandes";
  commandSearchInput.setAttribute("aria-label", "Search sheet cells and commands");
  const commandSearchStatus = document.createElement("span");
  commandSearchStatus.className = "workspace-sheet-command-search-status";
  commandSearchStatus.hidden = true;
  commandSearch.append(commandSearchIcon, commandSearchInput, commandSearchStatus);
  const topTabs = document.createElement("div");
  topTabs.className = "workspace-sheet-tabs";
  [(profile?.primaryTab || "Sheet"), profile?.secondaryTab || "Summary"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
    tab.textContent = label;
    topTabs.appendChild(tab);
  });
  const topBarActions = document.createElement("div");
  topBarActions.className = "workspace-sheet-topbar-actions";
  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.className = "workspace-sheet-topbar-button";
  topBarActions.append(topTabs, expandButton);
  topBar.append(titleGroup, commandSearch, topBarActions);
  previewShell.appendChild(topBar);
  previewShell.insertBefore(topBar, menuBar);
  const ribbonPopup = document.createElement("div");
  ribbonPopup.className = "workspace-sheet-ribbon-popup";
  ribbonPopup.hidden = true;
  previewShell.appendChild(ribbonPopup);

  let activeSelection = { ...initialSelectionState.activeSelection };
  let commitHandle = null;
  let chartFrameDraftSyncHandle = null;
  let chartFrameBeforeSnapshot = null;
  let activeChartFrameGestureCount = 0;
  const CHART_FRAME_DRAFT_SYNC_DELAY = 260;
  let editFocusGuardHandle = null;
  const committedCellBlurSkipSet = new WeakSet();
  let gridValueRefreshFrame = null;
  let pendingGridValueRefreshOptions = null;
  let suppressFormulaActivation = false;
  let formulaInputOriginalValue = "";
  let fillDragState = {
    active: false,
    startRowIndex: 0,
    startColumnIndex: 0,
    endRowIndex: 0,
    endColumnIndex: 0,
    targetRowIndex: 0,
    targetColumnIndex: 0
  };
  let formulaEditState = {
    mode: null,
    rowIndex: 0,
    columnIndex: 0,
    input: null,
    selectionStart: 0,
    selectionEnd: 0
  };
  let formulaHelpCollapsed = true;
  let formulaHelpDetailsExpanded = false;
  let formulaHelpClosedForName = "";
  let cellTextEditState = {
    active: false,
    rowIndex: -1,
    columnIndex: -1,
    originalValue: ""
  };
  let preserveRangeOnNextFocus = false;
  let findReplaceState = {
    visible: false,
    showReplace: false,
    query: "",
    replaceValue: "",
    matches: [],
    activeMatchIndex: 0
  };
  const VIRTUAL_WINDOW_SIZE = 180;
  let virtualWindowStart = Math.max(
    0,
    Number(spreadsheetViewportStore.get(`${historyKey}::${activeSheet.id}`) || Math.max(0, initialSelectionState.activeSelection.rowIndex - 20))
  );

  let selectionRange = { ...initialSelectionState.selectionRange };
  let selectionDragState = {
    active: false,
    anchorRowIndex: 0,
    anchorColumnIndex: 0
  };
  let resizeState = {
    active: false,
    kind: "",
    index: -1,
    startClientX: 0,
    startClientY: 0,
    startSize: 0
  };
  let ribbonOutsidePointerHandler = null;

  const saveCurrentSelectionState = () => {
    saveSpreadsheetSelectionState(
      historyKey,
      { activeSelection, selectionRange },
      sheetGrid.length,
      sheetGrid[0]?.length || 1
    );
  };

  const getWorkbookActiveSheet = () =>
    workbookModel.sheets.find((sheet) => sheet.id === workbookModel.activeSheetId) || workbookModel.sheets[0];

  let expandedOverlay = null;
  let expandedDialog = null;
  let expandedScaleFrame = null;
  // The expanded host survives sheet rerenders so menu actions do not create
  // stacked full-screen popups while a workbook is open.
  const getStoredExpandedPopupHost = () => {
    const host = spreadsheetExpandedPopupHostStore.get(historyKey);
    if (
      host?.overlay?.isConnected &&
      host?.dialog?.isConnected &&
      host?.scaleFrame?.isConnected
    ) {
      return host;
    }
    spreadsheetExpandedPopupHostStore.delete(historyKey);
    return null;
  };

  const destroyExpandedPopup = ({ preserveHost = false } = {}) => {
    if (!preserveHost) {
      document.body.classList.remove("workspace-sheet-expanded");
    }
    if (expandedScaleFrame?.contains(previewShell)) {
      expandedScaleFrame.removeChild(previewShell);
    }
    if (preserveHost) {
      return;
    }
    const storedHost = getStoredExpandedPopupHost();
    if (!expandedOverlay && storedHost) {
      expandedOverlay = storedHost.overlay;
      expandedDialog = storedHost.dialog;
      expandedScaleFrame = storedHost.scaleFrame;
    }
    if (expandedOverlay) {
      expandedOverlay.remove();
      expandedOverlay = null;
      expandedDialog = null;
      expandedScaleFrame = null;
    }
    spreadsheetExpandedPopupHostStore.delete(historyKey);
  };

  const ensureExpandedPopup = () => {
    if (expandedOverlay?.isConnected && expandedDialog && expandedScaleFrame) {
      return expandedScaleFrame;
    }
    const storedHost = getStoredExpandedPopupHost();
    if (storedHost) {
      expandedOverlay = storedHost.overlay;
      expandedDialog = storedHost.dialog;
      expandedScaleFrame = storedHost.scaleFrame;
      return expandedScaleFrame;
    }
    expandedOverlay = document.createElement("div");
    expandedOverlay.className = "workspace-sheet-modal-overlay";
    const backdrop = document.createElement("div");
    backdrop.className = "workspace-sheet-modal-backdrop";
    backdrop.addEventListener("click", () => setExpandedMode(false));
    expandedDialog = document.createElement("div");
    expandedDialog.className = "workspace-sheet-modal-dialog";
    expandedScaleFrame = document.createElement("div");
    expandedScaleFrame.className = "workspace-sheet-modal-scale-frame";
    expandedDialog.appendChild(expandedScaleFrame);
    expandedOverlay.append(backdrop, expandedDialog);
    document.body.appendChild(expandedOverlay);
    spreadsheetExpandedPopupHostStore.set(historyKey, {
      overlay: expandedOverlay,
      dialog: expandedDialog,
      scaleFrame: expandedScaleFrame
    });
    return expandedScaleFrame;
  };

  const mountPreviewShell = () => {
    previewShell.classList.toggle("is-expanded", isSheetExpanded);
    expandButton.textContent = isSheetExpanded ? "Exit full screen" : "Full screen";
    expandButton.title = isSheetExpanded ? "Exit full screen" : "Open full screen";
    expandButton.setAttribute("aria-pressed", isSheetExpanded ? "true" : "false");
    if (isSheetExpanded) {
      const scaleFrame = ensureExpandedPopup();
      document.body.classList.add("workspace-sheet-expanded");
      if (
        previewShell.parentElement !== scaleFrame ||
        scaleFrame.childElementCount !== 1 ||
        scaleFrame.firstElementChild !== previewShell
      ) {
        scaleFrame.replaceChildren(previewShell);
      }
      return;
    }
    if (previewShell.parentElement !== container) {
      container.appendChild(previewShell);
    }
    destroyExpandedPopup();
  };

  const syncExpandedUi = () => {
    mountPreviewShell();
  };

  const setExpandedMode = (nextExpanded = false) => {
    isSheetExpanded = Boolean(nextExpanded);
    spreadsheetExpandedStore.set(historyKey, isSheetExpanded);
    closeSheetMenu();
    syncExpandedUi();
    return isSheetExpanded;
  };

  const toggleExpandedMode = () => setExpandedMode(!isSheetExpanded);

  expandButton.addEventListener("click", () => {
    toggleExpandedMode();
  });
  syncExpandedUi();

  const getActiveSheetState = () => getWorkbookActiveSheet();

  const getVisibleSheets = () => workbookModel.sheets.filter((sheet) => !sheet.hidden);

  const getHiddenSheets = () => workbookModel.sheets.filter((sheet) => sheet.hidden);

  const getActiveSheetIndex = () =>
    Math.max(
      0,
      workbookModel.sheets.findIndex((sheet) => sheet.id === workbookModel.activeSheetId)
    );

  const normalizeSelectionBounds = (bounds = {}) => ({
    minRow: Math.max(0, Number(bounds.minRow ?? bounds.startRowIndex ?? 0)),
    maxRow: Math.max(0, Number(bounds.maxRow ?? bounds.endRowIndex ?? 0)),
    minColumn: Math.max(0, Number(bounds.minColumn ?? bounds.startColumnIndex ?? 0)),
    maxColumn: Math.max(0, Number(bounds.maxColumn ?? bounds.endColumnIndex ?? 0))
  });

  const formatBoundsAddress = (bounds = {}) => {
    const normalized = normalizeSelectionBounds(bounds);
    const startAddress = coordsToAddress(normalized.minRow, normalized.minColumn);
    const endAddress = coordsToAddress(normalized.maxRow, normalized.maxColumn);
    return startAddress === endAddress ? startAddress : `${startAddress}:${endAddress}`;
  };

  const getActiveSheetProtectedRanges = () => normalizeSpreadsheetProtectionRanges(getActiveSheetState().protectedRanges);

  const getProtectionConflict = (bounds = null) => {
    if (getActiveSheetState().protected) {
      return { type: "sheet" };
    }
    if (!bounds) {
      return null;
    }
    const normalized = normalizeSelectionBounds(bounds);
    const intersectingRanges = getActiveSheetProtectedRanges().filter((range) => {
      const rangeBounds = normalizeSelectionBounds(range);
      return !(
        rangeBounds.maxRow < normalized.minRow ||
        rangeBounds.minRow > normalized.maxRow ||
        rangeBounds.maxColumn < normalized.minColumn ||
        rangeBounds.minColumn > normalized.maxColumn
      );
    });
    return intersectingRanges.length ? { type: "ranges", ranges: intersectingRanges } : null;
  };

  const isBoundsEditable = (bounds = null) => !getProtectionConflict(bounds);

  const isCellProtected = (rowIndex = 0, columnIndex = 0) =>
    !isBoundsEditable({
      minRow: rowIndex,
      maxRow: rowIndex,
      minColumn: columnIndex,
      maxColumn: columnIndex
    });

  const describeProtectionConflict = (actionLabel = "edit", bounds = null) => {
    const conflict = getProtectionConflict(bounds);
    if (!conflict) {
      return "";
    }
    if (conflict.type === "sheet") {
      return `Can't ${actionLabel}. This sheet is protected.`;
    }
    const [firstRange] = conflict.ranges || [];
    const rangeLabel = firstRange?.label || formatBoundsAddress(firstRange || bounds || {});
    const extraCount = Math.max(0, (conflict.ranges?.length || 0) - 1);
    return `Can't ${actionLabel}. Protected range: ${rangeLabel}${extraCount ? ` (+${extraCount})` : ""}.`;
  };

  const ensureEditableBounds = (bounds = null, actionLabel = "edit") => {
    const conflict = getProtectionConflict(bounds);
    if (!conflict) {
      return true;
    }
    window.alert(describeProtectionConflict(actionLabel, bounds));
    return false;
  };

  const ensureEditableSelection = (actionLabel = "edit") => ensureEditableBounds(getSelectionBounds(), actionLabel);

  const ensureActiveCellEditable = (actionLabel = "edit") =>
    ensureEditableBounds(
      {
        minRow: activeSelection.rowIndex,
        maxRow: activeSelection.rowIndex,
        minColumn: activeSelection.columnIndex,
        maxColumn: activeSelection.columnIndex
      },
      actionLabel
    );

  const ensureSheetStructureEditable = (actionLabel = "change sheet structure") => {
    if (getActiveSheetState().protected) {
      window.alert(`Can't ${actionLabel}. This sheet is protected.`);
      return false;
    }
    const protectedRanges = getActiveSheetProtectedRanges();
    if (protectedRanges.length) {
      window.alert(`Can't ${actionLabel}. Remove protected ranges on this sheet first.`);
      return false;
    }
    return true;
  };

  const getWorkbookSnapshot = (sourceModel = workbookModel) =>
    cloneSpreadsheetSnapshot(
      normalizeSpreadsheetPreviewModel(sourceModel, {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      })
    );

  let editHistorySnapshot = null;
  let suppressRerenderBlurCommit = false;

  const recordSpreadsheetHistory = (beforeSnapshot = null, afterModel = workbookModel) => {
    const before = cloneSpreadsheetSnapshot(beforeSnapshot || historyState.current || workbookModel);
    const after = getWorkbookSnapshot(afterModel);
    if (areSpreadsheetSnapshotsEqual(before, after)) {
      historyState.current = after;
      return false;
    }

    historyState.past.push(before);
    if (historyState.past.length > SPREADSHEET_HISTORY_LIMIT) {
      historyState.past.splice(0, historyState.past.length - SPREADSHEET_HISTORY_LIMIT);
    }
    historyState.future = [];
    historyState.current = after;
    return true;
  };

  const beginSpreadsheetHistoryTransaction = () => {
    if (!editHistorySnapshot) {
      persistGridIntoActiveSheet();
      editHistorySnapshot = getWorkbookSnapshot();
    }
    return editHistorySnapshot;
  };

  const clearScheduledCommit = () => {
    if (commitHandle) {
      window.clearTimeout(commitHandle);
      commitHandle = null;
    }
  };

  const applySpreadsheetHistorySnapshot = (snapshot = {}) => {
    clearScheduledCommit();
    clearQueuedGridValueRefresh();
    editHistorySnapshot = null;
    workbookModel = normalizeSpreadsheetPreviewModel(cloneSpreadsheetSnapshot(snapshot), {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    historyState.current = getWorkbookSnapshot(workbookModel);
    suppressRerenderBlurCommit = true;
    try {
      const preserveExpandedHost = isSheetExpanded;
      disposeRibbonPopup();
      disposeSheetMenu();
      destroyExpandedPopup({ preserveHost: preserveExpandedHost });
      container.innerHTML = "";
      renderSpreadsheetClonePreview(container, {
        model: cloneSpreadsheetSnapshot(workbookModel),
        profile,
        workObject,
        filePath,
        onGridEdit
      });
      onGridEdit?.(workbookModel, { refreshWorkspace: false });
    } finally {
      suppressRerenderBlurCommit = false;
    }
  };

  const undoSpreadsheetAction = () => {
    clearScheduledCommit();
    if (editHistorySnapshot) {
      const previousEditSnapshot = cloneSpreadsheetSnapshot(editHistorySnapshot);
      persistGridIntoActiveSheet();
      const currentEditSnapshot = getWorkbookSnapshot();
      editHistorySnapshot = null;
      if (!areSpreadsheetSnapshotsEqual(previousEditSnapshot, currentEditSnapshot)) {
        historyState.future.push(currentEditSnapshot);
        applySpreadsheetHistorySnapshot(previousEditSnapshot);
        return;
      }
    }
    if (!historyState.past.length) {
      return;
    }
    const previousSnapshot = historyState.past.pop();
    historyState.future.push(getWorkbookSnapshot(historyState.current));
    applySpreadsheetHistorySnapshot(previousSnapshot);
  };

  const redoSpreadsheetAction = () => {
    clearScheduledCommit();
    editHistorySnapshot = null;
    if (!historyState.future.length) {
      return;
    }
    const nextSnapshot = historyState.future.pop();
    historyState.past.push(getWorkbookSnapshot(historyState.current));
    if (historyState.past.length > SPREADSHEET_HISTORY_LIMIT) {
      historyState.past.splice(0, historyState.past.length - SPREADSHEET_HISTORY_LIMIT);
    }
    applySpreadsheetHistorySnapshot(nextSnapshot);
  };

  const captureRenderedChartLayoutsIntoActiveSheet = () => {
    if (!previewShell) {
      return;
    }
    const currentSheet = getActiveSheetState();
    if (!Array.isArray(currentSheet?.charts) || !currentSheet.charts.length) {
      return;
    }
    const layoutById = new Map(
      Array.from(previewShell.querySelectorAll(".workspace-sheet-chart-object[data-chart-id]"))
        .map((node) => {
          const chartId = String(node.dataset.chartId || "");
          if (!chartId) {
            return null;
          }
          return [
            chartId,
            {
              x: Math.max(16, Number.parseFloat(node.dataset.chartX || node.style.left || "0") || 16),
              y: Math.max(16, Number.parseFloat(node.dataset.chartY || node.style.top || "0") || 16),
              width: Math.max(280, Number.parseFloat(node.dataset.chartWidth || node.style.width || "0") || 280),
              height: Math.max(180, Number.parseFloat(node.dataset.chartHeight || node.style.height || "0") || 180)
            }
          ];
        })
        .filter(Boolean)
    );
    if (!layoutById.size) {
      return;
    }
    currentSheet.charts = normalizeSpreadsheetCharts(
      currentSheet.charts.map((chart) =>
        layoutById.has(chart.id)
          ? {
              ...chart,
              ...layoutById.get(chart.id)
            }
          : chart
      )
    );
  };

  const persistGridIntoActiveSheet = () => {
    captureRenderedChartLayoutsIntoActiveSheet();
    const trimmed = trimGridToModel();
    const currentSheet = getActiveSheetState();
    currentSheet.columns = trimmed.columns;
    currentSheet.rows = trimmed.rows;
    syncActiveSheetChartsFromLinkedRanges();
    workbookModel = normalizeSpreadsheetPreviewModel(workbookModel, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    return workbookModel;
  };

  const persistWorkbookState = (
    refreshWorkspace = false,
    {
      trackHistory = true,
      beforeSnapshot = null,
      updateHistoryBaseline = true,
      suppressPreviewRefresh = false
    } = {}
  ) => {
    saveCurrentSelectionState();
    workbookModel = normalizeSpreadsheetPreviewModel(workbookModel, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    if (trackHistory) {
      recordSpreadsheetHistory(beforeSnapshot || historyState.current, workbookModel);
      editHistorySnapshot = null;
    } else if (updateHistoryBaseline) {
      historyState.current = getWorkbookSnapshot(workbookModel);
    }
    onGridEdit?.(workbookModel, { refreshWorkspace, suppressPreviewRefresh });
    return workbookModel;
  };

  const clearChartFrameDraftSync = ({ resetGestures = false } = {}) => {
    if (chartFrameDraftSyncHandle) {
      window.clearTimeout(chartFrameDraftSyncHandle);
      chartFrameDraftSyncHandle = null;
    }
    if (resetGestures) {
      activeChartFrameGestureCount = 0;
    }
  };

  const scheduleChartFramePersist = () => {
    clearChartFrameDraftSync();
    const beforeSnapshot = chartFrameBeforeSnapshot;
    chartFrameBeforeSnapshot = null;
    persistWorkbookState(
      false,
      beforeSnapshot
        ? { beforeSnapshot, suppressPreviewRefresh: true }
        : { trackHistory: false, suppressPreviewRefresh: true }
    );
  };

  // During chart drags the DOM moves every frame; draft sync is intentionally
  // slower so autosave cannot fight the pointer and snap the chart backwards.
  const scheduleChartFrameDraftSync = () => {
    if (chartFrameDraftSyncHandle) {
      return;
    }
    chartFrameDraftSyncHandle = window.setTimeout(() => {
      chartFrameDraftSyncHandle = null;
      onGridEdit?.(workbookModel, { refreshWorkspace: false, suppressPreviewRefresh: true });
      if (activeChartFrameGestureCount > 0) {
        scheduleChartFrameDraftSync();
      }
    }, CHART_FRAME_DRAFT_SYNC_DELAY);
  };

  const beginChartFrameGesture = () => {
    activeChartFrameGestureCount += 1;
    scheduleChartFrameDraftSync();
  };

  const endChartFrameGesture = () => {
    activeChartFrameGestureCount = Math.max(0, activeChartFrameGestureCount - 1);
  };

  const rerenderPreview = ({ persistGrid = true } = {}) => {
    clearChartFrameDraftSync({ resetGestures: true });
    clearQueuedGridValueRefresh();
    if (persistGrid) {
      persistGridIntoActiveSheet();
    }
    const preserveExpandedHost = isSheetExpanded;
    disposeRibbonPopup();
    disposeSheetMenu();
    destroyExpandedPopup({ preserveHost: preserveExpandedHost });
    container.innerHTML = "";
    renderSpreadsheetClonePreview(container, {
      model: workbookModel,
      profile,
      workObject,
      filePath,
      onGridEdit
    });
  };

  const rerenderAndFocusCell = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    window.setTimeout(() => {
      container
        .querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`)
        ?.focus?.();
    }, 0);
  };

  const commitModel = (
    refreshWorkspace = false,
    {
      trackHistory = true,
      beforeSnapshot = null,
      updateHistoryBaseline = true,
      suppressPreviewRefresh = false
    } = {}
  ) => {
    saveCurrentSelectionState();
    const nextModel = persistGridIntoActiveSheet();
    if (trackHistory) {
      recordSpreadsheetHistory(beforeSnapshot || editHistorySnapshot || historyState.current, nextModel);
      editHistorySnapshot = null;
    } else if (updateHistoryBaseline) {
      historyState.current = getWorkbookSnapshot(nextModel);
    }
    onGridEdit?.(nextModel, { refreshWorkspace, suppressPreviewRefresh });
  };

  const scheduleCommit = () => {
    if (commitHandle) {
      window.clearTimeout(commitHandle);
    }
    commitHandle = window.setTimeout(() => {
      commitModel(false, { trackHistory: false, updateHistoryBaseline: false });
      commitHandle = null;
    }, 140);
  };

  const buildColumnFormula = (name = "SUM") => {
    const columnRef = columnLetter(activeSelection.columnIndex);
    let startRow = 1;
    let endRow = Math.max(1, sheetGrid.length);
    if (activeSelection.rowIndex + 1 >= startRow && activeSelection.rowIndex + 1 <= endRow) {
      endRow = Math.max(startRow, activeSelection.rowIndex);
    }
    return `=${name}(${columnRef}${startRow}:${columnRef}${endRow})`;
  };

  const getSelectionBounds = () => ({
    minRow: Math.min(selectionRange.startRowIndex, selectionRange.endRowIndex),
    maxRow: Math.max(selectionRange.startRowIndex, selectionRange.endRowIndex),
    minColumn: Math.min(selectionRange.startColumnIndex, selectionRange.endColumnIndex),
    maxColumn: Math.max(selectionRange.startColumnIndex, selectionRange.endColumnIndex)
  });

  const setSelectionRange = ({
    startRowIndex = activeSelection.rowIndex,
    startColumnIndex = activeSelection.columnIndex,
    endRowIndex = activeSelection.rowIndex,
    endColumnIndex = activeSelection.columnIndex
  } = {}) => {
    selectionRange = {
      startRowIndex,
      startColumnIndex,
      endRowIndex,
      endColumnIndex
    };
    saveCurrentSelectionState();
  };

  const forEachSelectedCell = (callback) => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        callback(rowIndex, columnIndex);
      }
    }
  };

  const getLastUsedCell = () => {
    let rowIndex = 0;
    let columnIndex = 0;
    sheetGrid.forEach((row, currentRowIndex) => {
      row.forEach((value, currentColumnIndex) => {
        if (String(value || "").trim()) {
          rowIndex = Math.max(rowIndex, currentRowIndex);
          columnIndex = Math.max(columnIndex, currentColumnIndex);
        }
      });
    });
    return { rowIndex, columnIndex };
  };

  const getRowLastUsedColumn = (rowIndex = activeSelection.rowIndex) => {
    const row = sheetGrid[rowIndex] || [];
    for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex -= 1) {
      if (String(row[columnIndex] || "").trim()) {
        return columnIndex;
      }
    }
    return Math.max(0, row.length - 1);
  };

  const getCellFormatKey = (rowIndex = 0, columnIndex = 0) => `${rowIndex}:${columnIndex}`;

  const getCellFormat = (rowIndex = 0, columnIndex = 0) =>
    normalizeSpreadsheetCellFormat(getActiveSheetState().cellFormats?.[getCellFormatKey(rowIndex, columnIndex)] || {});

  const getCellNote = (rowIndex = 0, columnIndex = 0) =>
    normalizeSpreadsheetNote(getActiveSheetState().cellNotes?.[getCellFormatKey(rowIndex, columnIndex)] || null);

  const getCellDataValidation = (rowIndex = 0, columnIndex = 0) =>
    normalizeSpreadsheetDataValidationRule(getActiveSheetState().dataValidations?.[getCellFormatKey(rowIndex, columnIndex)] || null);

  const setCellDataValidation = (rowIndex = 0, columnIndex = 0, rule = null) => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.dataValidations || typeof currentSheet.dataValidations !== "object") {
      currentSheet.dataValidations = {};
    }
    const key = getCellFormatKey(rowIndex, columnIndex);
    const normalized = normalizeSpreadsheetDataValidationRule(rule);
    if (normalized) {
      currentSheet.dataValidations[key] = normalized;
    } else {
      delete currentSheet.dataValidations[key];
    }
  };

  const setCellNote = (rowIndex = 0, columnIndex = 0, note = null) => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.cellNotes || typeof currentSheet.cellNotes !== "object") {
      currentSheet.cellNotes = {};
    }
    const key = getCellFormatKey(rowIndex, columnIndex);
    const normalized = normalizeSpreadsheetNote(note);
    if (normalized) {
      currentSheet.cellNotes[key] = normalized;
    } else {
      delete currentSheet.cellNotes[key];
    }
  };

  const getCellSparkline = (rowIndex = 0, columnIndex = 0) =>
    normalizeSpreadsheetSparkline(getActiveSheetState().sparklines?.[getCellFormatKey(rowIndex, columnIndex)] || null);

  const setCellSparkline = (rowIndex = 0, columnIndex = 0, config = null) => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.sparklines || typeof currentSheet.sparklines !== "object") {
      currentSheet.sparklines = {};
    }
    const key = getCellFormatKey(rowIndex, columnIndex);
    const normalized = normalizeSpreadsheetSparkline(config);
    if (normalized) {
      currentSheet.sparklines[key] = normalized;
    } else {
      delete currentSheet.sparklines[key];
    }
  };

  const getActiveSheetCharts = () =>
    normalizeSpreadsheetCharts(getActiveSheetState().charts).map((chart) => materializeLinkedSpreadsheetChart(chart));

  const getActiveSheetTables = () => normalizeSpreadsheetTables(getActiveSheetState().tables);

  const getActiveSheetPivotTables = () => normalizeSpreadsheetPivotTables(getActiveSheetState().pivotTables);

  const getActiveSheetTableFilters = () => normalizeSpreadsheetTableFilters(getActiveSheetState().tableFilters);

  const getActiveSheetSlicers = () => normalizeSpreadsheetSlicers(getActiveSheetState().slicers);

  const getActiveSheetConditionalFormats = () =>
    normalizeSpreadsheetConditionalFormats(getActiveSheetState().conditionalFormats || getActiveSheetState().conditionalFormatting);

  const getActiveSheetZoomLevel = () => Math.max(0.5, Math.min(2, Number(getActiveSheetState().zoomLevel || 1) || 1));

  const getActiveSheetShowGridlines = () => getActiveSheetState().showGridlines !== false;

  const getStructureBounds = (source = {}) =>
    normalizeSelectionBounds({
      minRow: source.startRowIndex,
      maxRow: source.endRowIndex,
      minColumn: source.startColumnIndex,
      maxColumn: source.endColumnIndex
    });

  const boundsIntersect = (left = {}, right = {}) => {
    const a = normalizeSelectionBounds(left);
    const b = normalizeSelectionBounds(right);
    return !(
      a.maxRow < b.minRow ||
      a.minRow > b.maxRow ||
      a.maxColumn < b.minColumn ||
      a.minColumn > b.maxColumn
    );
  };

  const boundsContainsCell = (bounds = {}, rowIndex = 0, columnIndex = 0) => {
    const normalized = normalizeSelectionBounds(bounds);
    return (
      rowIndex >= normalized.minRow &&
      rowIndex <= normalized.maxRow &&
      columnIndex >= normalized.minColumn &&
      columnIndex <= normalized.maxColumn
    );
  };

  const getBoundsFromCellOrRangeAddress = (range = "") => {
    const text = String(range || "").trim();
    if (!text) {
      return null;
    }
    const rangeBounds = getRangeBoundsFromAddress(text);
    if (rangeBounds) {
      return rangeBounds;
    }
    const coords = addressToCoords(text);
    return coords
      ? {
          minRow: coords.rowIndex,
          maxRow: coords.rowIndex,
          minColumn: coords.columnIndex,
          maxColumn: coords.columnIndex
        }
      : null;
  };

  const getConditionalComparableValue = (rowIndex = 0, columnIndex = 0) => {
    const rawValue = getRawCellValue(rowIndex, columnIndex);
    return rawValue.startsWith("=") ? evaluateCellValue(rowIndex, columnIndex) : rawValue;
  };

  const conditionalValuesEqual = (left = "", right = "") => {
    const leftNumber = coerceNumeric(left);
    const rightNumber = coerceNumeric(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
    return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
  };

  const conditionalRuleMatchesCell = (rule = null, rowIndex = 0, columnIndex = 0) => {
    const normalizedRule = normalizeSpreadsheetConditionalFormatRule(rule);
    const bounds = getBoundsFromCellOrRangeAddress(normalizedRule?.range);
    if (!normalizedRule || !bounds || !boundsContainsCell(bounds, rowIndex, columnIndex)) {
      return false;
    }
    const cellValue = getConditionalComparableValue(rowIndex, columnIndex);
    const cellText = String(cellValue ?? "").trim();
    if (!cellText && normalizedRule.type !== "duplicate") {
      return false;
    }
    const cellNumber = coerceNumeric(cellValue);
    const value1Number = coerceNumeric(normalizedRule.value1);
    const value2Number = coerceNumeric(normalizedRule.value2);

    switch (normalizedRule.type) {
      case "greaterThan":
        return Number.isFinite(cellNumber) && Number.isFinite(value1Number) && cellNumber > value1Number;
      case "lessThan":
        return Number.isFinite(cellNumber) && Number.isFinite(value1Number) && cellNumber < value1Number;
      case "between":
        return (
          Number.isFinite(cellNumber) &&
          Number.isFinite(value1Number) &&
          Number.isFinite(value2Number) &&
          cellNumber >= Math.min(value1Number, value2Number) &&
          cellNumber <= Math.max(value1Number, value2Number)
        );
      case "equal":
        return conditionalValuesEqual(cellValue, normalizedRule.value1);
      case "textContains":
        return cellText.toLowerCase().includes(String(normalizedRule.value1 || "").trim().toLowerCase());
      case "duplicate": {
        const values = [];
        for (let currentRow = bounds.minRow; currentRow <= bounds.maxRow; currentRow += 1) {
          for (let currentColumn = bounds.minColumn; currentColumn <= bounds.maxColumn; currentColumn += 1) {
            const value = String(getConditionalComparableValue(currentRow, currentColumn) ?? "").trim().toLowerCase();
            if (value) {
              values.push(value);
            }
          }
        }
        const normalizedValue = cellText.toLowerCase();
        return normalizedValue ? values.filter((value) => value === normalizedValue).length > 1 : false;
      }
      default:
        return false;
    }
  };

  const describeConditionalFormatRule = (rule = null) => {
    const normalizedRule = normalizeSpreadsheetConditionalFormatRule(rule);
    if (!normalizedRule) {
      return "";
    }
    const rangeLabel = normalizedRule.range ? ` sur ${normalizedRule.range}` : "";
    switch (normalizedRule.type) {
      case "greaterThan":
        return `Superieur a ${normalizedRule.value1}${rangeLabel}`;
      case "lessThan":
        return `Inferieur a ${normalizedRule.value1}${rangeLabel}`;
      case "between":
        return `Entre ${normalizedRule.value1} et ${normalizedRule.value2}${rangeLabel}`;
      case "equal":
        return `Egal a ${normalizedRule.value1}${rangeLabel}`;
      case "textContains":
        return `Texte contient ${normalizedRule.value1}${rangeLabel}`;
      case "duplicate":
        return `Valeurs en double${rangeLabel}`;
      default:
        return `Mise en forme conditionnelle${rangeLabel}`;
    }
  };

  const getConditionalFormatForCell = (rowIndex = 0, columnIndex = 0) => {
    const matches = getActiveSheetConditionalFormats().filter((rule) =>
      conditionalRuleMatchesCell(rule, rowIndex, columnIndex)
    );
    if (!matches.length) {
      return null;
    }
    return matches.reduce(
      (format, rule) => ({
        fillColor: rule.fillColor || format.fillColor,
        textColor: rule.textColor || format.textColor,
        bold: Boolean(rule.bold || format.bold),
        labels: [...format.labels, rule.label || describeConditionalFormatRule(rule)]
      }),
      { fillColor: "", textColor: "", bold: false, labels: [] }
    );
  };

  const getActiveTableForSelection = () => {
    const selectionBounds = getSelectionBounds();
    return getActiveSheetTables().find((table) => boundsIntersect(getStructureBounds(table), selectionBounds)) || null;
  };

  const getTableCellInfo = (rowIndex = 0, columnIndex = 0) => {
    const table = getActiveSheetTables().find((candidate) =>
      boundsContainsCell(getStructureBounds(candidate), rowIndex, columnIndex)
    );
    if (!table) {
      return null;
    }
    const bounds = getStructureBounds(table);
    return {
      table,
      bounds,
      isHeader: table.showHeaderRow !== false && rowIndex === bounds.minRow,
      isTotal: table.showTotalRow && rowIndex === bounds.maxRow,
      isBanded: table.showBandedRows && rowIndex >= getTableDataStartRow(table) && (rowIndex - getTableDataStartRow(table)) % 2 === 1,
      isBandedColumn: table.showBandedColumns && columnIndex >= bounds.minColumn && (columnIndex - bounds.minColumn) % 2 === 1,
      isFirstColumn: table.showFirstColumn && columnIndex === bounds.minColumn,
      isLastColumn: table.showLastColumn && columnIndex === bounds.maxColumn
    };
  };

  const getValidationListValues = (rule = null) => {
    if (!rule || rule.type !== "list") {
      return [];
    }
    const source = String(rule.source || "");
    const rangeBounds = getRangeBoundsFromAddress(source);
    if (rangeBounds) {
      return collectRangeValues(source).map((value) => String(value ?? "")).filter((value) => value.length);
    }
    return source
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .filter(Boolean);
  };

  const coerceValidationNumber = (value = "") => {
    const numeric = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const coerceValidationDate = (value = "") => {
    const timestamp = Date.parse(String(value ?? "").trim());
    return Number.isNaN(timestamp) ? null : timestamp;
  };

  const compareValidationValue = (value, minValue, maxValue, operator = "between") => {
    switch (operator) {
      case "notBetween":
        return value < minValue || value > maxValue;
      case "equal":
        return value === minValue;
      case "notEqual":
        return value !== minValue;
      case "greaterThan":
        return value > minValue;
      case "lessThan":
        return value < minValue;
      case "greaterOrEqual":
        return value >= minValue;
      case "lessOrEqual":
        return value <= minValue;
      case "between":
      default:
        return value >= minValue && value <= maxValue;
    }
  };

  const getValidationErrorMessage = (rule = null) => {
    if (!rule) {
      return "";
    }
    if (rule.message) {
      return rule.message;
    }
    if (rule.type === "list") {
      return `Choose a value from: ${getValidationListValues(rule).join(", ")}`;
    }
    if (rule.type === "textLength") {
      return "Text length does not match the validation rule.";
    }
    return "This value does not match the validation rule.";
  };

  const describeDataValidationRule = (rule = null) => {
    if (!rule) {
      return "";
    }
    if (rule.type === "list") {
      const values = getValidationListValues(rule);
      return values.length ? `List: ${values.join(", ")}` : `List: ${rule.source || "empty"}`;
    }
    const operatorLabel = String(rule.operator || "between");
    const limits = [rule.minimum, rule.maximum].filter((value) => String(value ?? "").trim()).join(" and ");
    return `${rule.type} ${operatorLabel}${limits ? ` ${limits}` : ""}`;
  };

  const validateCellValueAgainstRule = (value = "", rule = null) => {
    if (!rule) {
      return { valid: true, message: "" };
    }
    const text = String(value ?? "").trim();
    if (!text && rule.allowBlank) {
      return { valid: true, message: "" };
    }
    let valid = true;
    if (rule.type === "list") {
      const allowedValues = getValidationListValues(rule);
      valid = allowedValues.some((allowed) => String(allowed).toLowerCase() === text.toLowerCase());
    } else if (rule.type === "whole" || rule.type === "decimal") {
      const numeric = coerceValidationNumber(text);
      const minValue = coerceValidationNumber(rule.minimum);
      const maxValue = coerceValidationNumber(rule.maximum || rule.minimum);
      valid =
        numeric !== null &&
        (rule.type !== "whole" || Number.isInteger(numeric)) &&
        minValue !== null &&
        maxValue !== null &&
        compareValidationValue(numeric, minValue, maxValue, rule.operator);
    } else if (rule.type === "date") {
      const date = coerceValidationDate(text);
      const minValue = coerceValidationDate(rule.minimum);
      const maxValue = coerceValidationDate(rule.maximum || rule.minimum);
      valid = date !== null && minValue !== null && maxValue !== null && compareValidationValue(date, minValue, maxValue, rule.operator);
    } else if (rule.type === "textLength") {
      const minValue = coerceValidationNumber(rule.minimum);
      const maxValue = coerceValidationNumber(rule.maximum || rule.minimum);
      valid = minValue !== null && maxValue !== null && compareValidationValue(text.length, minValue, maxValue, rule.operator);
    }
    return { valid, message: valid ? "" : getValidationErrorMessage(rule) };
  };

  const validateCellValue = (rowIndex = 0, columnIndex = 0, value = getRawCellValue(rowIndex, columnIndex)) =>
    validateCellValueAgainstRule(value, getCellDataValidation(rowIndex, columnIndex));

  const isCellValueValid = (rowIndex = 0, columnIndex = 0, value = getRawCellValue(rowIndex, columnIndex)) =>
    validateCellValue(rowIndex, columnIndex, value).valid;

  const alertValidationError = (rowIndex = 0, columnIndex = 0, value = "") => {
    const result = validateCellValue(rowIndex, columnIndex, value);
    if (result.valid) {
      return true;
    }
    window.alert(result.message || "This value does not match the validation rule.");
    return false;
  };

  const setValidatedCellValue = (rowIndex = 0, columnIndex = 0, value = "", { silent = false } = {}) => {
    const result = validateCellValue(rowIndex, columnIndex, value);
    if (!result.valid) {
      if (!silent) {
        window.alert(result.message || "This value does not match the validation rule.");
      }
      return false;
    }
    setRawCellValue(rowIndex, columnIndex, value);
    return true;
  };

  const showValidationBlockedAlert = (count = 0) => {
    if (count > 0) {
      window.alert(`${count} cell${count > 1 ? "s" : ""} did not match its data validation rule.`);
    }
  };

  const getPivotTableCellInfo = (rowIndex = 0, columnIndex = 0) => {
    const pivotTable = getActiveSheetPivotTables().find((candidate) => {
      const bounds = getRangeBoundsFromAddress(candidate.renderedRange) || {
        minRow: candidate.anchorRowIndex,
        maxRow: candidate.anchorRowIndex,
        minColumn: candidate.anchorColumnIndex,
        maxColumn: candidate.anchorColumnIndex
      };
      return boundsContainsCell(bounds, rowIndex, columnIndex);
    });
    if (!pivotTable) {
      return null;
    }
    return {
      pivotTable,
      isHeader: rowIndex === pivotTable.anchorRowIndex,
      isTotal:
        String(getRawCellValue(rowIndex, pivotTable.anchorColumnIndex)).trim().toLowerCase() === "grand total" ||
        String(getRawCellValue(pivotTable.anchorRowIndex, columnIndex)).trim().toLowerCase() === "grand total"
    };
  };

  const buildSparklineSvgDataUri = (values = [], { color = "#1a73e8", type = "line" } = {}) => {
    const numericValues = values.map((value) => coerceNumeric(value)).filter((value) => Number.isFinite(value));
    if (!numericValues.length) {
      return "";
    }
    const width = 90;
    const height = 22;
    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const range = Math.max(1, maxValue - minValue);
    const points = numericValues.map((value, index) => {
      const x = numericValues.length === 1 ? width / 2 : (index / Math.max(1, numericValues.length - 1)) * (width - 4) + 2;
      const y = height - 3 - (((value - minValue) / range) * (height - 6));
      return { x, y };
    });

    let body = `<rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>`;
    if (type === "column") {
      const maxAbs = Math.max(...numericValues.map((value) => Math.abs(value)), 1);
      const columnWidth = Math.max(2, Math.floor((width - 4) / numericValues.length) - 1);
      body += points
        .map((point, index) => {
          const value = numericValues[index];
          const barHeight = Math.max(2, Math.round((Math.abs(value) / maxAbs) * (height - 6)));
          const y = value >= 0 ? height - 3 - barHeight : height / 2;
          return `<rect x="${Math.max(1, point.x - columnWidth / 2)}" y="${y}" width="${columnWidth}" height="${barHeight}" rx="1" fill="${color}"/>`;
        })
        .join("");
    } else {
      body += `<polyline fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${points
        .map((point) => `${point.x},${point.y}`)
        .join(" ")}"/>`;
      body += points
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="1.6" fill="${color}"/>`)
        .join("");
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  };

  const getCellSparklineBackground = (rowIndex = 0, columnIndex = 0) => {
    const config = getCellSparkline(rowIndex, columnIndex);
    if (!config?.range) {
      return "";
    }
    const values = collectRangeValues(config.range)
      .map((value) => coerceNumeric(value))
      .filter((value) => Number.isFinite(value));
    return buildSparklineSvgDataUri(values, config);
  };

  const setCellFormat = (rowIndex = 0, columnIndex = 0, format = {}) => {
    const currentSheet = getActiveSheetState();
    if (!currentSheet.cellFormats || typeof currentSheet.cellFormats !== "object") {
      currentSheet.cellFormats = {};
    }
    const key = getCellFormatKey(rowIndex, columnIndex);
    const normalized = normalizeSpreadsheetCellFormat(format);
    if (!isSpreadsheetCellFormatEmpty(normalized)) {
      currentSheet.cellFormats[key] = normalized;
    } else {
      delete currentSheet.cellFormats[key];
    }
  };

  const updateSelectedCellFormats = (updater) => {
    if (typeof updater !== "function") {
      return;
    }
    if (!ensureEditableSelection("format the selection")) {
      return;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      const nextFormat = normalizeSpreadsheetCellFormat(updater(getCellFormat(rowIndex, columnIndex), rowIndex, columnIndex));
      setCellFormat(rowIndex, columnIndex, nextFormat);
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
  };

  const setSelectedRangeFormat = (format = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (format) {
        nextFormat.numberFormat = format;
      } else {
        delete nextFormat.numberFormat;
      }
      return nextFormat;
    });
  };

  const toggleSelectedTextStyle = (style = "") => {
    if (!["bold", "italic", "underline"].includes(style)) {
      return;
    }
    const nextValue = !getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex)[style];
    updateSelectedCellFormats((currentFormat) => ({
      ...currentFormat,
      [style]: nextValue
    }));
  };

  const setSelectedHorizontalAlign = (alignment = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (SPREADSHEET_HORIZONTAL_ALIGNMENTS.has(alignment)) {
        nextFormat.horizontalAlign = alignment;
      } else {
        delete nextFormat.horizontalAlign;
      }
      return nextFormat;
    });
  };

  const setSelectedVerticalAlign = (alignment = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      if (SPREADSHEET_VERTICAL_ALIGNMENTS.has(alignment)) {
        nextFormat.verticalAlign = alignment;
      } else {
        delete nextFormat.verticalAlign;
      }
      return nextFormat;
    });
  };

  const setSelectedFontSize = (fontSize = 11) => {
    updateSelectedCellFormats((currentFormat) => ({
      ...currentFormat,
      fontSize
    }));
  };

  const getActiveSelectionFontSizeValue = () => {
    const fontSize = Number(getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).fontSize);
    const normalizedSize = Number.isFinite(fontSize) ? fontSize : 11;
    return String(Math.max(8, Math.min(36, Math.round(normalizedSize))));
  };

  const adjustSelectedFontSize = (delta = 0) => {
    const currentSize = getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).fontSize || 11;
    setSelectedFontSize(currentSize + delta);
  };

  const setSelectedTextColor = (color = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      const normalizedColor = normalizeSpreadsheetColor(color);
      if (normalizedColor) {
        nextFormat.textColor = normalizedColor;
      } else {
        delete nextFormat.textColor;
      }
      return nextFormat;
    });
  };

  const setSelectedFillColor = (color = "") => {
    updateSelectedCellFormats((currentFormat) => {
      const nextFormat = { ...currentFormat };
      const normalizedColor = normalizeSpreadsheetColor(color);
      if (normalizedColor) {
        nextFormat.fillColor = normalizedColor;
      } else {
        delete nextFormat.fillColor;
      }
      return nextFormat;
    });
  };

  const getActiveBorderColorValue = () =>
    normalizeSpreadsheetBorderSpec(getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).border)?.color || "#202124";

  const getActiveBorderStyleValue = () =>
    normalizeSpreadsheetBorderSpec(getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).border)?.style || "medium";

  const setSelectedBorder = (kind = "all", { color = "", style = "" } = {}) => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const normalizedColor = normalizeSpreadsheetColor(color) || getActiveBorderColorValue();
    const normalizedStyle = SPREADSHEET_BORDER_STYLE_CSS[style] ? style : getActiveBorderStyleValue();
    updateSelectedCellFormats((currentFormat, rowIndex, columnIndex) => {
      const nextFormat = { ...currentFormat };
      if (kind === "clear") {
        delete nextFormat.border;
        return nextFormat;
      }

      const border = { ...(nextFormat.border || {}), color: normalizedColor, style: normalizedStyle };
      if (kind === "all") {
        SPREADSHEET_BORDER_EDGES.forEach((edge) => {
          border[edge] = true;
        });
      } else if (kind === "outer") {
        if (rowIndex === minRow) {
          border.top = true;
        }
        if (rowIndex === maxRow) {
          border.bottom = true;
        }
        if (columnIndex === minColumn) {
          border.left = true;
        }
        if (columnIndex === maxColumn) {
          border.right = true;
        }
      } else if (kind === "inside") {
        if (rowIndex < maxRow) {
          border.bottom = true;
        }
        if (columnIndex < maxColumn) {
          border.right = true;
        }
      } else if (kind === "insideHorizontal") {
        if (rowIndex < maxRow) {
          border.bottom = true;
        }
      } else if (kind === "insideVertical") {
        if (columnIndex < maxColumn) {
          border.right = true;
        }
      } else if (SPREADSHEET_BORDER_EDGES.includes(kind)) {
        border[kind] = true;
      }
      nextFormat.border = border;
      return nextFormat;
    });
  };

  const setSelectedBorderColor = (color = "") => {
    const normalizedColor = normalizeSpreadsheetColor(color);
    if (!normalizedColor) {
      return;
    }
    updateSelectedCellFormats((currentFormat) => {
      const currentBorder = normalizeSpreadsheetBorderSpec(currentFormat.border);
      const border = currentBorder
        ? { ...currentBorder, color: normalizedColor }
        : { top: true, right: true, bottom: true, left: true, color: normalizedColor, style: getActiveBorderStyleValue() };
      return { ...currentFormat, border };
    });
  };

  const setSelectedBorderStyle = (style = "medium") => {
    const normalizedStyle = SPREADSHEET_BORDER_STYLE_CSS[style] ? style : "medium";
    updateSelectedCellFormats((currentFormat) => {
      const currentBorder = normalizeSpreadsheetBorderSpec(currentFormat.border);
      const border = currentBorder
        ? { ...currentBorder, style: normalizedStyle }
        : { top: true, right: true, bottom: true, left: true, color: getActiveBorderColorValue(), style: normalizedStyle };
      return { ...currentFormat, border };
    });
  };

  const clearSelectedFormatting = () => {
    updateSelectedCellFormats(() => ({}));
  };

  const escapeClipboardHtml = (value = "") =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");

  const serializeClipboardCell = (value = "") => {
    const text = String(value ?? "");
    return /[\t\r\n"]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  };

  const serializeClipboardMatrix = (matrix = []) =>
    matrix.map((row) => row.map(serializeClipboardCell).join("\t")).join("\r\n");

  const serializeClipboardHtml = (matrix = []) =>
    `<table>${matrix
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeClipboardHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</table>`;

  const detectClipboardDelimiter = (text = "") => {
    if (text.includes("\t")) {
      return "\t";
    }
    const firstLine = text
      .split(/\n/)
      .find((line) => String(line || "").trim().length);
    if (firstLine && firstLine.includes(",") && !firstLine.trim().startsWith("=")) {
      return ",";
    }
    return "\t";
  };

  const parseClipboardText = (text = "") => {
    const source = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!source.length) {
      return [];
    }
    const delimiter = detectClipboardDelimiter(source);
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === "\"") {
        if (inQuotes && next === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === delimiter && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }
      if (char === "\n" && !inQuotes) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += char;
    }

    row.push(cell);
    rows.push(row);
    while (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
      rows.pop();
    }

    const width = Math.max(1, ...rows.map((entry) => entry.length));
    return rows.map((entry) => Array.from({ length: width }, (_, index) => entry[index] ?? ""));
  };

  const getStoredClipboardPayload = () => spreadsheetClipboardStore.get(historyKey) || null;

  const setStoredClipboardPayload = (payload = null) => {
    if (payload) {
      spreadsheetClipboardStore.set(historyKey, payload);
    } else {
      spreadsheetClipboardStore.delete(historyKey);
    }
  };

  const buildClipboardPayload = (mode = "copy") => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const matrix = [];
    const formats = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = [];
      const formatRow = [];
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        row.push(getRawCellValue(rowIndex, columnIndex));
        formatRow.push(getCellFormat(rowIndex, columnIndex));
      }
      matrix.push(row);
      formats.push(formatRow);
    }
    const text = serializeClipboardMatrix(matrix);
    return {
      kind: "hydria-sheet-clipboard",
      mode,
      source: {
        sheetId: workbookModel.activeSheetId,
        minRow,
        minColumn,
        rowCount: maxRow - minRow + 1,
        columnCount: maxColumn - minColumn + 1
      },
      matrix,
      formats,
      text,
      html: serializeClipboardHtml(matrix)
    };
  };

  const writeClipboardPayload = (payload = null, clipboardData = null) => {
    if (!payload) {
      return false;
    }
    setStoredClipboardPayload(payload);
    syncSelectionUi();
    if (clipboardData) {
      clipboardData.setData("text/plain", payload.text);
      clipboardData.setData("text/html", payload.html);
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload.text).catch(() => {});
    }
    return true;
  };

  const copySelectedCells = (clipboardData = null, { mode = "copy" } = {}) =>
    writeClipboardPayload(buildClipboardPayload(mode), clipboardData);

  const cutSelectedCells = (clipboardData = null) => {
    if (!ensureEditableSelection("cut the selection")) {
      return false;
    }
    clearScheduledCommit();
    copySelectedCells(clipboardData, { mode: "cut" });
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setRawCellValue(rowIndex, columnIndex, "");
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const clearSelectedCells = () => {
    if (!ensureEditableSelection("clear the selection")) {
      return false;
    }
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setRawCellValue(rowIndex, columnIndex, "");
    });
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const getClipboardPayloadForText = (text = "") => {
    const payload = getStoredClipboardPayload();
    if (payload && (!text || payload.text === text)) {
      return payload;
    }
    return null;
  };

  const pasteClipboardMatrix = (matrix = [], payload = null) => {
    const sourceHeight = matrix.length;
    const sourceWidth = Math.max(0, ...matrix.map((row) => row.length));
    if (!sourceHeight || !sourceWidth) {
      return false;
    }

    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const selectionHeight = maxRow - minRow + 1;
    const selectionWidth = maxColumn - minColumn + 1;
    const pasteHeight = selectionHeight > 1 || selectionWidth > 1
      ? Math.max(selectionHeight, sourceHeight)
      : sourceHeight;
    const pasteWidth = selectionHeight > 1 || selectionWidth > 1
      ? Math.max(selectionWidth, sourceWidth)
      : sourceWidth;
    const internalClipboard = payload?.kind === "hydria-sheet-clipboard";
    if (
      !ensureEditableBounds(
        {
          minRow,
          maxRow: minRow + pasteHeight - 1,
          minColumn,
          maxColumn: minColumn + pasteWidth - 1
        },
        "paste into the selection"
      )
    ) {
      return false;
    }

    ensureGridSize(minRow + pasteHeight, minColumn + pasteWidth);
    let blockedValidationCount = 0;
    for (let rowOffset = 0; rowOffset < pasteHeight; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < pasteWidth; columnOffset += 1) {
        const sourceRowOffset = rowOffset % sourceHeight;
        const sourceColumnOffset = columnOffset % sourceWidth;
        const targetRowIndex = minRow + rowOffset;
        const targetColumnIndex = minColumn + columnOffset;
        const sourceValue = String(matrix[sourceRowOffset]?.[sourceColumnOffset] ?? "");
        const sourceRowIndex = (payload?.source?.minRow ?? minRow) + sourceRowOffset;
        const sourceColumnIndex = (payload?.source?.minColumn ?? minColumn) + sourceColumnOffset;
        const nextValue =
          internalClipboard && payload.mode !== "cut" && sourceValue.startsWith("=")
            ? shiftFormulaReferences(
                sourceValue,
                targetRowIndex - sourceRowIndex,
                targetColumnIndex - sourceColumnIndex
              )
            : sourceValue;
        if (!setValidatedCellValue(targetRowIndex, targetColumnIndex, nextValue, { silent: true })) {
          blockedValidationCount += 1;
          continue;
        }
        if (internalClipboard && payload.formats) {
          setCellFormat(targetRowIndex, targetColumnIndex, payload.formats[sourceRowOffset]?.[sourceColumnOffset] || "");
        }
      }
    }

    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: minRow + pasteHeight - 1,
      endColumnIndex: minColumn + pasteWidth - 1
    });
    if (payload?.mode === "cut") {
      setStoredClipboardPayload(null);
    }
    showValidationBlockedAlert(blockedValidationCount);
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const pasteClipboardText = (text = "", payload = null) => {
    const clipboardPayload = payload || getClipboardPayloadForText(text);
    if (!clipboardPayload && text) {
      setStoredClipboardPayload(null);
    }
    const matrix = clipboardPayload?.matrix || parseClipboardText(text);
    return pasteClipboardMatrix(matrix, clipboardPayload);
  };

  const readSystemClipboardText = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {
      // The internal clipboard fallback still covers toolbar paste after in-app copy/cut.
    }
    return "";
  };

  const pasteFromClipboard = async (clipboardData = null) => {
    const eventText = clipboardData?.getData?.("text/plain") || "";
    if (eventText) {
      return pasteClipboardText(eventText, getClipboardPayloadForText(eventText));
    }
    if (clipboardData) {
      return pasteClipboardText("", getStoredClipboardPayload());
    }
    const systemText = await readSystemClipboardText();
    return pasteClipboardText(systemText, getClipboardPayloadForText(systemText) || (!systemText ? getStoredClipboardPayload() : null));
  };

  const shouldUseNativeTextClipboard = (event) => {
    const target = event.target;
    if (!target || !previewShell.contains(target)) {
      return false;
    }
    if (target === formulaInput || target === nameBox || target.isContentEditable) {
      return true;
    }
    if (target.matches?.("textarea")) {
      return true;
    }
    if (target.matches?.("input") && !target.classList.contains("workspace-sheet-cell-input")) {
      return true;
    }
    if (target.classList?.contains("workspace-sheet-cell-input")) {
      const isCellTextEdit = target.classList.contains("is-editing");
      if (!isCellTextEdit) {
        return false;
      }
      return event.type === "paste" || Number(target.selectionStart ?? 0) !== Number(target.selectionEnd ?? 0);
    }
    return false;
  };

  const formatCellDisplayValue = (value, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    const numberFormat = format.numberFormat || "";
    const normalizedValue = typeof value === "string" ? value : formatFormulaResult(value);
    if (!numberFormat || normalizedValue.startsWith("#")) {
      return normalizedValue;
    }

    const numericSource = String(normalizedValue ?? "").trim();
    if (!numericSource) {
      return normalizedValue;
    }

    const numeric = Number(numericSource.replace(",", "."));
    if (numberFormat === "number" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(numeric);
    }
    if (numberFormat === "currency" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(numeric);
    }
    if (numberFormat === "percent" && Number.isFinite(numeric)) {
      return new Intl.NumberFormat("fr-FR", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(numeric);
    }
    if (numberFormat === "date") {
      const dateValue = new Date(normalizedValue);
      if (!Number.isNaN(dateValue.getTime())) {
        return new Intl.DateTimeFormat("fr-FR").format(dateValue);
      }
    }
    return normalizedValue;
  };

  const applyCellVisualFormat = (input, wrapper, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    const note = getCellNote(rowIndex, columnIndex);
    const validationRule = getCellDataValidation(rowIndex, columnIndex);
    const validationResult = validateCellValueAgainstRule(getRawCellValue(rowIndex, columnIndex), validationRule);
    const conditionalFormat = getConditionalFormatForCell(rowIndex, columnIndex);
    const sparklineBackground = getCellSparklineBackground(rowIndex, columnIndex);
    const tableInfo = getTableCellInfo(rowIndex, columnIndex);
    const pivotInfo = getPivotTableCellInfo(rowIndex, columnIndex);
    const tablePalette = {
      blue: { header: "#1a73e8", banded: "#eef5ff", total: "#d8e9ff" },
      green: { header: "#188038", banded: "#e6f4ea", total: "#ceead6" },
      orange: { header: "#c26401", banded: "#fff4e5", total: "#fce8b2" },
      purple: { header: "#6f42c1", banded: "#f1eafe", total: "#e4d7fb" },
      gray: { header: "#5f6368", banded: "#f1f3f4", total: "#e8eaed" }
    };
    const activePalette = tablePalette[tableInfo?.table?.style] || tablePalette.blue;
    const structuralFill =
      tableInfo?.isHeader
        ? activePalette.header
          : tableInfo?.isTotal
            ? activePalette.total
            : tableInfo?.isBanded || tableInfo?.isBandedColumn
              ? activePalette.banded
            : pivotInfo?.isHeader
              ? "#f1f3f4"
              : pivotInfo?.isTotal
                ? "#e8f0fe"
                : "transparent";
    const structuralColor = tableInfo?.isHeader ? "#ffffff" : "#202124";
    const structuralBold =
      tableInfo?.isHeader ||
      tableInfo?.isTotal ||
      tableInfo?.isFirstColumn ||
      tableInfo?.isLastColumn ||
      pivotInfo?.isHeader ||
      pivotInfo?.isTotal;
    input.style.fontWeight = format.bold || conditionalFormat?.bold || structuralBold ? "700" : "";
    input.style.fontStyle = format.italic ? "italic" : "";
    input.style.textDecoration = format.underline ? "underline" : "";
    input.style.textAlign = format.horizontalAlign || "";
    input.style.fontSize = format.fontSize ? `${format.fontSize}px` : "";
    input.style.setProperty("--sheet-cell-color", conditionalFormat?.textColor || format.textColor || structuralColor);
    input.style.setProperty("--sheet-cell-fill", conditionalFormat?.fillColor || format.fillColor || structuralFill);
    input.style.backgroundImage = sparklineBackground ? sparklineBackground : "";
    input.style.backgroundRepeat = sparklineBackground ? "no-repeat" : "";
    input.style.backgroundPosition = sparklineBackground ? "right 6px center" : "";
    input.style.backgroundSize = sparklineBackground ? "90px 22px" : "";
    wrapper.style.verticalAlign =
      format.verticalAlign === "middle" ? "middle" : format.verticalAlign === "bottom" ? "bottom" : "top";
    wrapper.style.borderTop = "";
    wrapper.style.borderRight = "";
    wrapper.style.borderBottom = "";
    wrapper.style.borderLeft = "";
    wrapper.classList.toggle("has-note", Boolean(note));
    wrapper.classList.toggle("has-data-validation", Boolean(validationRule));
    wrapper.classList.toggle("is-sheet-validation-invalid", Boolean(validationRule && !validationResult.valid));
    wrapper.classList.toggle("has-conditional-format", Boolean(conditionalFormat));
    wrapper.classList.toggle("is-sheet-table-cell", Boolean(tableInfo));
    wrapper.classList.toggle("is-sheet-table-header", Boolean(tableInfo?.isHeader));
    wrapper.classList.toggle("is-sheet-table-banded", Boolean(tableInfo?.isBanded));
    wrapper.classList.toggle("is-sheet-table-banded-column", Boolean(tableInfo?.isBandedColumn));
    wrapper.classList.toggle("is-sheet-table-first-column", Boolean(tableInfo?.isFirstColumn));
    wrapper.classList.toggle("is-sheet-table-last-column", Boolean(tableInfo?.isLastColumn));
    wrapper.classList.toggle("is-sheet-table-total", Boolean(tableInfo?.isTotal));
    wrapper.classList.toggle("is-sheet-pivot-cell", Boolean(pivotInfo));
    wrapper.classList.toggle("is-sheet-pivot-header", Boolean(pivotInfo?.isHeader));
    wrapper.classList.toggle("is-sheet-pivot-total", Boolean(pivotInfo?.isTotal));
    wrapper.dataset.sheetTableStyle = tableInfo?.table?.style || "";
    input.title = [
      input.readOnly ? "Protected cell" : "",
      note?.text || "",
      validationRule ? `Data validation: ${describeDataValidationRule(validationRule)}` : "",
      validationRule && !validationResult.valid ? validationResult.message : "",
      conditionalFormat?.labels?.length ? `Conditional format: ${conditionalFormat.labels.join("; ")}` : ""
    ].filter(Boolean).join("\n");

    const border = normalizeSpreadsheetBorderSpec(format.border);
    if (!border) {
      return;
    }
    const borderStyle = `${SPREADSHEET_BORDER_STYLE_CSS[border.style] || SPREADSHEET_BORDER_STYLE_CSS.medium} ${border.color || "#202124"}`;
    if (border.top) {
      wrapper.style.borderTop = borderStyle;
    }
    if (border.right) {
      wrapper.style.borderRight = borderStyle;
    }
    if (border.bottom) {
      wrapper.style.borderBottom = borderStyle;
    }
    if (border.left) {
      wrapper.style.borderLeft = borderStyle;
    }
  };

  const getColumnWidth = (columnIndex = 0) => {
    const width = Number(getActiveSheetState().columnWidths?.[String(columnIndex)] || 132);
    return clamp(width, 72, 420);
  };

  const getRowHeight = (rowIndex = 0) => {
    const height = Number(getActiveSheetState().rowHeights?.[String(rowIndex)] || 34);
    return clamp(height, 28, 240);
  };

  const setColumnWidth = (columnIndex = 0, width = 132) => {
    const currentSheet = getActiveSheetState();
    currentSheet.columnWidths = currentSheet.columnWidths || {};
    currentSheet.columnWidths[String(columnIndex)] = clamp(width, 72, 420);
  };

  const setRowHeight = (rowIndex = 0, height = 34) => {
    const currentSheet = getActiveSheetState();
    currentSheet.rowHeights = currentSheet.rowHeights || {};
    currentSheet.rowHeights[String(rowIndex)] = clamp(height, 28, 240);
  };

  const getSheetMerges = () => getActiveSheetState().merges || [];

  const findMergeAt = (rowIndex = 0, columnIndex = 0) =>
    getSheetMerges().find(
      (merge) =>
        rowIndex >= merge.startRowIndex &&
        rowIndex < merge.startRowIndex + merge.rowSpan &&
        columnIndex >= merge.startColumnIndex &&
        columnIndex < merge.startColumnIndex + merge.columnSpan
    ) || null;

  const isMergeAnchor = (rowIndex = 0, columnIndex = 0) => {
    const merge = findMergeAt(rowIndex, columnIndex);
    return Boolean(merge && merge.startRowIndex === rowIndex && merge.startColumnIndex === columnIndex);
  };

  const mergeSelectionRange = () => {
    persistGridIntoActiveSheet();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const rowSpan = maxRow - minRow + 1;
    const columnSpan = maxColumn - minColumn + 1;
    if (rowSpan === 1 && columnSpan === 1) {
      return;
    }
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, "merge cells")) {
      return;
    }
    const currentSheet = getActiveSheetState();
    currentSheet.merges = (currentSheet.merges || []).filter(
      (merge) =>
        merge.startRowIndex + merge.rowSpan - 1 < minRow ||
        merge.startRowIndex > maxRow ||
        merge.startColumnIndex + merge.columnSpan - 1 < minColumn ||
        merge.startColumnIndex > maxColumn
    );
    currentSheet.merges.push({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      rowSpan,
      columnSpan
    });
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const unmergeSelectionRange = () => {
    persistGridIntoActiveSheet();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, "unmerge cells")) {
      return;
    }
    const currentSheet = getActiveSheetState();
    currentSheet.merges = (currentSheet.merges || []).filter(
      (merge) =>
        merge.startRowIndex + merge.rowSpan - 1 < minRow ||
        merge.startRowIndex > maxRow ||
        merge.startColumnIndex + merge.columnSpan - 1 < minColumn ||
        merge.startColumnIndex > maxColumn
    );
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const shiftFormulaReferences = (rawValue = "", rowOffset = 0, columnOffset = 0) => {
    if (!String(rawValue || "").startsWith("=")) {
      return String(rawValue || "");
    }
    return String(rawValue).replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_, colAbs, letters, rowAbs, rowText) => {
      const coords = addressToCoords(`${colAbs}${letters}${rowAbs}${rowText}`);
      if (!coords) {
        return `${colAbs}${letters}${rowAbs}${rowText}`;
      }
      const nextRowIndex = coords.absoluteRow ? coords.rowIndex : clamp(coords.rowIndex + rowOffset, 0, 9998);
      const nextColumnIndex = coords.absoluteColumn
        ? coords.columnIndex
        : clamp(coords.columnIndex + columnOffset, 0, 9998);
      return coordsToAddress(nextRowIndex, nextColumnIndex, {
        absoluteRow: coords.absoluteRow,
        absoluteColumn: coords.absoluteColumn
      });
    });
  };

  const getFillRangeBounds = () => ({
    minRow: Math.min(fillDragState.startRowIndex, fillDragState.targetRowIndex),
    maxRow: Math.max(fillDragState.endRowIndex, fillDragState.targetRowIndex),
    minColumn: Math.min(fillDragState.startColumnIndex, fillDragState.targetColumnIndex),
    maxColumn: Math.max(fillDragState.endColumnIndex, fillDragState.targetColumnIndex)
  });

  const clearFillPreview = () => {
    table?.querySelectorAll(".is-fill-preview").forEach((node) => node.classList.remove("is-fill-preview"));
  };

  const updateFillPreview = () => {
    clearFillPreview();
    if (!fillDragState.active) {
      return;
    }
    const { minRow, maxRow, minColumn, maxColumn } = getFillRangeBounds();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        table
          ?.querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`)
          ?.classList.add("is-fill-preview");
      }
    }
  };

  const findCellInputFromPointer = (clientX = 0, clientY = 0) => {
    const node = document.elementFromPoint(clientX, clientY);
    if (!node) {
      return null;
    }
    return node.matches?.("[data-sheet-grid-cell]") ? node : node.closest?.("[data-sheet-grid-cell]");
  };

  const applyFillDrag = () => {
    if (!fillDragState.active) {
      return;
    }
    const sourceMinRow = Math.min(fillDragState.startRowIndex, fillDragState.endRowIndex);
    const sourceMaxRow = Math.max(fillDragState.startRowIndex, fillDragState.endRowIndex);
    const sourceMinColumn = Math.min(fillDragState.startColumnIndex, fillDragState.endColumnIndex);
    const sourceMaxColumn = Math.max(fillDragState.startColumnIndex, fillDragState.endColumnIndex);
    const sourceHeight = sourceMaxRow - sourceMinRow + 1;
    const sourceWidth = sourceMaxColumn - sourceMinColumn + 1;
    const sourceMatrix = Array.from({ length: sourceHeight }, (_, rowOffset) =>
      Array.from({ length: sourceWidth }, (_, columnOffset) =>
        getRawCellValue(sourceMinRow + rowOffset, sourceMinColumn + columnOffset)
      )
    );
    const { minRow, maxRow, minColumn, maxColumn } = getFillRangeBounds();
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, "fill the selection")) {
      fillDragState.active = false;
      clearFillPreview();
      return;
    }
    const isVerticalSeries = sourceWidth === 1 && sourceHeight >= 2 && fillDragState.targetRowIndex !== sourceMaxRow;
    const isHorizontalSeries = sourceHeight === 1 && sourceWidth >= 2 && fillDragState.targetColumnIndex !== sourceMaxColumn;
    let blockedValidationCount = 0;

    const buildSeriesValue = (targetIndex = 0, values = []) => {
      const numericValues = values.map((value) => Number(String(value || "").replace(",", ".")));
      if (!numericValues.every((value) => Number.isFinite(value))) {
        return "";
      }
      const step = numericValues.length >= 2 ? numericValues[numericValues.length - 1] - numericValues[numericValues.length - 2] : 0;
      const nextValue = numericValues[numericValues.length - 1] + step * targetIndex;
      return Number.isInteger(nextValue) ? String(nextValue) : String(nextValue);
    };

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const isInsideSource =
          rowIndex >= sourceMinRow &&
          rowIndex <= sourceMaxRow &&
          columnIndex >= sourceMinColumn &&
          columnIndex <= sourceMaxColumn;
        if (isInsideSource) {
          continue;
        }

        if (isVerticalSeries && columnIndex >= sourceMinColumn && columnIndex <= sourceMaxColumn) {
          const sourceValues = sourceMatrix.map((row) => row[0]);
          const targetOffset =
            rowIndex > sourceMaxRow
              ? rowIndex - sourceMaxRow
              : -(sourceMinRow - rowIndex);
          const nextSeriesValue = buildSeriesValue(targetOffset, sourceValues);
          if (nextSeriesValue) {
            if (!setValidatedCellValue(rowIndex, columnIndex, nextSeriesValue, { silent: true })) {
              blockedValidationCount += 1;
            }
            continue;
          }
        }

        if (isHorizontalSeries && rowIndex >= sourceMinRow && rowIndex <= sourceMaxRow) {
          const sourceValues = sourceMatrix[0];
          const targetOffset =
            columnIndex > sourceMaxColumn
              ? columnIndex - sourceMaxColumn
              : -(sourceMinColumn - columnIndex);
          const nextSeriesValue = buildSeriesValue(targetOffset, sourceValues);
          if (nextSeriesValue) {
            if (!setValidatedCellValue(rowIndex, columnIndex, nextSeriesValue, { silent: true })) {
              blockedValidationCount += 1;
            }
            continue;
          }
        }

        const sourceRowOffset = ((rowIndex - sourceMinRow) % sourceHeight + sourceHeight) % sourceHeight;
        const sourceColumnOffset = ((columnIndex - sourceMinColumn) % sourceWidth + sourceWidth) % sourceWidth;
        const sourceValue = sourceMatrix[sourceRowOffset][sourceColumnOffset];
        const nextValue = String(sourceValue || "").startsWith("=")
          ? shiftFormulaReferences(
              sourceValue,
              rowIndex - (sourceMinRow + sourceRowOffset),
              columnIndex - (sourceMinColumn + sourceColumnOffset)
            )
          : sourceValue;
        if (!setValidatedCellValue(rowIndex, columnIndex, nextValue, { silent: true })) {
          blockedValidationCount += 1;
        }
      }
    }

    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: maxRow,
      endColumnIndex: maxColumn
    });
    fillDragState.active = false;
    clearFillPreview();
    showValidationBlockedAlert(blockedValidationCount);
    commitModel(false);
    refreshGridValues();
  };

  const handleSelectionDragMove = (event) => {
    const targetInput = findCellInputFromPointer(event.clientX, event.clientY);
    if (!selectionDragState.active || !targetInput) {
      return;
    }
    setSelectionRange({
      startRowIndex: selectionDragState.anchorRowIndex,
      startColumnIndex: selectionDragState.anchorColumnIndex,
      endRowIndex: Number(targetInput.dataset.rowIndex || selectionDragState.anchorRowIndex),
      endColumnIndex: Number(targetInput.dataset.columnIndex || selectionDragState.anchorColumnIndex)
    });
    activeSelection = {
      rowIndex: selectionRange.endRowIndex,
      columnIndex: selectionRange.endColumnIndex
    };
    saveCurrentSelectionState();
    syncSelectionUi();
  };

  const handleSelectionDragEnd = () => {
    if (!selectionDragState.active) {
      return;
    }
    selectionDragState.active = false;
    document.removeEventListener("mousemove", handleSelectionDragMove);
    document.removeEventListener("mouseup", handleSelectionDragEnd);
  };

  const handleResizeMove = (event) => {
    if (!resizeState.active) {
      return;
    }
    if (resizeState.kind === "column") {
      const nextWidth = resizeState.startSize + (event.clientX - resizeState.startClientX);
      setColumnWidth(resizeState.index, nextWidth);
    } else if (resizeState.kind === "row") {
      const nextHeight = resizeState.startSize + (event.clientY - resizeState.startClientY);
      setRowHeight(resizeState.index, nextHeight);
    }
    applyFreezeState();
    syncSelectionUi();
  };

  const handleResizeEnd = () => {
    if (!resizeState.active) {
      return;
    }
    resizeState.active = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const syncFormulaEditorState = ({
    mode = null,
    rowIndex = activeSelection.rowIndex,
    columnIndex = activeSelection.columnIndex,
    input = null
  } = {}) => {
    const targetInput = input || document.activeElement;
    const rawValue = String(getRawCellValue(rowIndex, columnIndex) || "");
    if (!targetInput || !rawValue.startsWith("=")) {
      formulaEditState = {
        mode: null,
        rowIndex,
        columnIndex,
        input: null,
        selectionStart: 0,
        selectionEnd: 0
      };
      hideFormulaHelpPanel();
      return false;
    }
    formulaEditState = {
      mode,
      rowIndex,
      columnIndex,
      input: targetInput,
      selectionStart: targetInput.selectionStart ?? rawValue.length,
      selectionEnd: targetInput.selectionEnd ?? targetInput.selectionStart ?? rawValue.length
    };
    updateFormulaHelpPanel();
    return true;
  };

  const formulaEditIsActive = () =>
    Boolean(
      formulaEditState.input &&
        document.activeElement === formulaEditState.input &&
        String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "").startsWith("=")
    );

  const formulaHelpCanUseEditState = () =>
    Boolean(
      formulaEditState.input?.isConnected &&
        String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "").startsWith("=")
    );

  const updateFormulaReferenceHighlights = () => {
    table?.querySelectorAll(".is-formula-reference").forEach((node) => node.classList.remove("is-formula-reference"));
    if (!formulaEditIsActive()) {
      hideFormulaHelpPanel();
      return;
    }
    const rawFormula = String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "");
    const references = [...new Set(rawFormula.match(/\$?[A-Z]+\$?\d+/gi) || [])];
    references.forEach((address) => {
      const coords = addressToCoords(address);
      if (!coords) {
        return;
      }
      table
        ?.querySelector(`[data-sheet-grid-cell="${coords.rowIndex}:${coords.columnIndex}"]`)
        ?.classList.add("is-formula-reference");
    });
    updateFormulaHelpPanel();
  };

  const restoreFormulaEditorFocus = () => {
    if (!formulaEditIsActive()) {
      return;
    }
    const { input, selectionStart, selectionEnd } = formulaEditState;
    window.requestAnimationFrame(() => {
      input?.focus();
      if (typeof input?.setSelectionRange === "function") {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const insertCellReferenceIntoFormula = (rowIndex = 0, columnIndex = 0) => {
    if (!formulaEditIsActive()) {
      return false;
    }
    beginSpreadsheetHistoryTransaction();
    const address = `${columnLetter(columnIndex)}${rowIndex + 1}`;
    const editor = formulaEditState.input;
    const baseValue = String(getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "=");
    const currentValue = editor?.value?.startsWith("=") ? editor.value : baseValue;
    const start = editor?.selectionStart ?? formulaEditState.selectionStart ?? currentValue.length;
    const end = editor?.selectionEnd ?? formulaEditState.selectionEnd ?? start;
    const nextValue = `${currentValue.slice(0, start)}${address}${currentValue.slice(end)}`;

    setRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex, nextValue);
    formulaInput.value = nextValue;
    if (editor) {
      editor.value = nextValue;
    }

    formulaEditState.selectionStart = start + address.length;
    formulaEditState.selectionEnd = start + address.length;
    activeSelection = {
      rowIndex: formulaEditState.rowIndex,
      columnIndex: formulaEditState.columnIndex
    };
    saveCurrentSelectionState();

    scheduleCommit();
    refreshGridValues();
    restoreFormulaEditorFocus();
    return true;
  };

  const maybeHandleFormulaReferencePointer = (event, rowIndex = 0, columnIndex = 0) => {
    if (!formulaEditIsActive()) {
      return false;
    }
    if (
      formulaEditState.mode === "cell" &&
      formulaEditState.rowIndex === rowIndex &&
      formulaEditState.columnIndex === columnIndex
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return insertCellReferenceIntoFormula(rowIndex, columnIndex);
  };

  const getFormulaDefinition = (name = "") =>
    SPREADSHEET_FORMULA_DEFINITIONS.find((definition) => definition.name === normalizeSpreadsheetFormulaName(name)) || null;

  const getFormulaHelp = (definition = null) => {
    if (!definition) {
      return null;
    }
    const fallbackArgs = String(definition.syntax || "")
      .replace(/^[^(]*\(|\)$/g, "")
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => [part.replace(/^\[|\]$/g, ""), "argument de la fonction."]);
    return {
      example: `=${definition.syntax}`,
      arguments: fallbackArgs,
      ...SPREADSHEET_FORMULA_HELP[definition.name]
    };
  };

  const getActiveFormulaHelpDefinition = () => {
    const editor = formulaEditState.input;
    const rawFormula = String(editor?.value || getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "");
    if (!rawFormula.startsWith("=")) {
      return null;
    }
    const caretIndex = Number(editor?.selectionStart ?? formulaEditState.selectionStart ?? rawFormula.length);
    const beforeCaret = rawFormula.slice(0, Math.max(0, caretIndex));
    const matches = [...beforeCaret.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/gi)];
    const formulaName = matches.length ? matches[matches.length - 1][1] : (rawFormula.match(/^=([A-Z][A-Z0-9.]*)/i)?.[1] || "");
    const definition = getFormulaDefinition(formulaName);
    return definition ? { ...definition, displayName: String(formulaName || definition.name).toUpperCase() } : null;
  };

  const getActiveFormulaArgumentIndex = () => {
    const editor = formulaEditState.input;
    const rawFormula = String(editor?.value || getRawCellValue(formulaEditState.rowIndex, formulaEditState.columnIndex) || "");
    const caretIndex = Number(editor?.selectionStart ?? formulaEditState.selectionStart ?? rawFormula.length);
    const beforeCaret = rawFormula.slice(0, Math.max(0, caretIndex));
    const matches = [...beforeCaret.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/gi)];
    if (!matches.length) {
      return 0;
    }
    const openParenIndex = (matches[matches.length - 1].index || 0) + matches[matches.length - 1][0].length - 1;
    const argumentText = rawFormula.slice(openParenIndex + 1, Math.max(openParenIndex + 1, caretIndex));
    let depth = 0;
    let index = 0;
    Array.from(argumentText).forEach((char) => {
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth = Math.max(0, depth - 1);
      } else if ((char === "," || char === ";") && depth === 0) {
        index += 1;
      }
    });
    return index;
  };

  const positionFormulaHelpPanel = () => {
    if (formulaHelpPanel.hidden || !formulaEditState.input?.isConnected) {
      return;
    }
    const margin = 10;
    const anchor = formulaEditState.input;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = formulaHelpPanel.getBoundingClientRect();
    const iconOnly = formulaHelpPanel.classList.contains("is-collapsed");
    const panelWidth = iconOnly ? Math.max(22, panelRect.width || 22) : Math.max(300, panelRect.width || 340);
    const panelHeight = iconOnly ? Math.max(22, panelRect.height || 22) : Math.max(80, panelRect.height || 240);
    const preferredLeft = anchor === formulaInput ? anchorRect.left + 4 : anchorRect.left;
    const preferredTop = anchor === formulaInput
      ? anchorRect.bottom + (iconOnly ? 2 : 6)
      : anchorRect.bottom + (iconOnly ? 2 : 10);
    const fallbackTop = anchorRect.top - panelHeight - 10;
    const top = preferredTop + panelHeight <= window.innerHeight - margin
      ? preferredTop
      : Math.max(margin, fallbackTop);
    const left = Math.max(margin, Math.min(preferredLeft, window.innerWidth - panelWidth - margin));
    formulaHelpPanel.style.left = `${Math.round(left)}px`;
    formulaHelpPanel.style.top = `${Math.round(top)}px`;
  };

  const hideFormulaHelpPanel = () => {
    formulaHelpPanel.hidden = true;
  };

  const updateFormulaHelpPanel = () => {
    const definition = formulaHelpCanUseEditState() ? getActiveFormulaHelpDefinition() : null;
    if (!definition || formulaHelpClosedForName === definition.name) {
      hideFormulaHelpPanel();
      return;
    }
    const help = getFormulaHelp(definition);
    const displayName = definition.displayName && normalizeSpreadsheetFormulaName(definition.displayName) === definition.name
      ? definition.displayName
      : definition.name;
    const displaySyntax = String(definition.syntax || "").replace(/^[^(]+/, displayName);
    const displayExample = String(help.example || `=${definition.syntax}`).replace(/^=([A-Z][A-Z0-9.]*)/i, `=${displayName}`);
    formulaHelpSignature.textContent = displaySyntax;
    formulaHelpPanel.classList.toggle("is-collapsed", formulaHelpCollapsed);
    formulaHelpPanel.classList.toggle("is-expanded", !formulaHelpCollapsed && formulaHelpDetailsExpanded);
    const toggleLabel = formulaHelpCollapsed
      ? "Afficher l'aide de formule"
      : formulaHelpDetailsExpanded
        ? "Masquer les details de formule"
        : "Afficher les details de formule";
    formulaHelpToggle.title = toggleLabel;
    formulaHelpToggle.setAttribute("aria-label", toggleLabel);
    formulaHelpToggle.innerHTML = "";
    if (formulaHelpCollapsed) {
      const helpMark = document.createElement("span");
      helpMark.className = "workspace-sheet-formula-help-mark";
      helpMark.textContent = "?";
      formulaHelpToggle.appendChild(helpMark);
    } else {
      formulaHelpToggle.appendChild(
        createSheetIconNode(formulaHelpDetailsExpanded ? "chevronUp" : "chevronDown", {
          className: "workspace-sheet-formula-help-icon",
          label: toggleLabel
        })
      );
    }
    formulaHelpBody.innerHTML = "";
    if (!formulaHelpCollapsed && formulaHelpDetailsExpanded) {
      const activeArgumentIndex = getActiveFormulaArgumentIndex();
      const descriptionTitle = document.createElement("h4");
      descriptionTitle.textContent = "Description";
      const description = document.createElement("p");
      description.textContent = definition.description;
      const exampleTitle = document.createElement("h4");
      exampleTitle.textContent = "Exemple";
      const example = document.createElement("code");
      example.textContent = displayExample;
      const args = document.createElement("dl");
      args.className = "workspace-sheet-formula-help-args";
      (help.arguments || []).forEach(([name, detail], index) => {
        const term = document.createElement("dt");
        term.classList.toggle("is-active", index === activeArgumentIndex);
        term.textContent = name;
        const descriptionNode = document.createElement("dd");
        descriptionNode.classList.toggle("is-active", index === activeArgumentIndex);
        descriptionNode.textContent = detail;
        args.append(term, descriptionNode);
      });
      const footer = document.createElement("div");
      footer.className = "workspace-sheet-formula-help-footer";
      const learn = document.createElement("span");
      learn.textContent = `En savoir plus sur ${displayName}`;
      const feedback = document.createElement("span");
      feedback.textContent = "Envoyer des commentaires";
      footer.append(learn, feedback);
      formulaHelpBody.append(descriptionTitle, description, exampleTitle, example, args, footer);
    }
    formulaHelpPanel.hidden = false;
    window.requestAnimationFrame(positionFormulaHelpPanel);
  };

  const rememberRecentFormula = (name = "") => {
    const formulaName = normalizeSpreadsheetFormulaName(name);
    if (!getFormulaDefinition(formulaName)) {
      return;
    }
    const previous = spreadsheetRecentFormulaStore.get(historyKey) || [];
    spreadsheetRecentFormulaStore.set(historyKey, [
      formulaName,
      ...previous.filter((entry) => entry !== formulaName)
    ].slice(0, 10));
  };

  const insertFormulaInActiveCell = (name = "SUM", refreshWorkspace = false) => {
    if (!ensureActiveCellEditable("insert a formula")) {
      return;
    }
    const normalizedName = normalizeSpreadsheetFormulaName(name || "SUM") || "SUM";
    rememberRecentFormula(normalizedName);
    const quickRangeFunctions = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT"]);
    const nextFormula = quickRangeFunctions.has(normalizedName)
      ? buildColumnFormula(normalizedName)
      : `=${normalizedName}()`;
    const caretIndex = quickRangeFunctions.has(normalizedName)
      ? nextFormula.length
      : Math.max(1, nextFormula.length - 1);

    beginSpreadsheetHistoryTransaction();
    beginCellTextEdit({
      initialValue: nextFormula,
      selectionStart: caretIndex,
      selectionEnd: caretIndex
    });
    if (refreshWorkspace) {
      commitModel(true, { beforeSnapshot: editHistorySnapshot, suppressPreviewRefresh: true });
    }
  };

  const compareDataValues = (leftValue = "", rightValue = "", direction = "asc") => {
    const leftText = String(leftValue ?? "").trim();
    const rightText = String(rightValue ?? "").trim();
    if (!leftText && !rightText) {
      return 0;
    }
    if (!leftText) {
      return 1;
    }
    if (!rightText) {
      return -1;
    }
    const leftNumber = Number(leftText.replace(",", "."));
    const rightNumber = Number(rightText.replace(",", "."));
    let result = 0;
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      result = leftNumber - rightNumber;
    } else {
      const leftDate = Date.parse(leftText);
      const rightDate = Date.parse(rightText);
      if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
        result = leftDate - rightDate;
      } else {
        result = leftText.localeCompare(rightText, "fr", { numeric: true, sensitivity: "base" });
      }
    }
    return direction === "desc" ? -result : result;
  };

  const getDefaultDataBounds = ({ includeHeader = false } = {}) => {
    const lastUsedCell = getLastUsedCell();
    return {
      minRow: includeHeader ? 0 : Math.min(1, Math.max(0, lastUsedCell.rowIndex)),
      maxRow: Math.max(1, lastUsedCell.rowIndex),
      minColumn: 0,
      maxColumn: Math.max(0, lastUsedCell.columnIndex, activeSelection.columnIndex)
    };
  };

  const getDataSelectionBounds = ({ preferTable = false, skipHeader = true } = {}) => {
    const bounds = getSelectionBounds();
    const hasRangeSelection = bounds.maxRow > bounds.minRow || bounds.maxColumn > bounds.minColumn;
    const activeTable = preferTable ? getActiveTableForSelection() : null;
    if (activeTable && !hasRangeSelection) {
      const tableBounds = getStructureBounds(activeTable);
      return {
        minRow: skipHeader ? getTableDataStartRow(activeTable) : tableBounds.minRow,
        maxRow: skipHeader ? getTableDataEndRow(activeTable) : tableBounds.maxRow,
        minColumn: tableBounds.minColumn,
        maxColumn: tableBounds.maxColumn
      };
    }
    const nextBounds = preferTable && !hasRangeSelection ? getDefaultDataBounds({ includeHeader: !skipHeader }) : { ...bounds };
    if (skipHeader && nextBounds.minRow === 0 && nextBounds.maxRow > 0) {
      nextBounds.minRow = 1;
    }
    return nextBounds;
  };

  const readDataRangeRow = (rowIndex = 0, minColumn = 0, maxColumn = 0) => ({
    values: Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
      getRawCellValue(rowIndex, minColumn + offset)
    ),
    formats: Array.from({ length: maxColumn - minColumn + 1 }, (_, offset) =>
      getCellFormat(rowIndex, minColumn + offset)
    )
  });

  const writeDataRangeRow = (rowIndex = 0, minColumn = 0, row = {}) => {
    (row.values || []).forEach((value, offset) => {
      setRawCellValue(rowIndex, minColumn + offset, value);
      setCellFormat(rowIndex, minColumn + offset, row.formats?.[offset] || {});
    });
  };

  const clearDataRange = (minRow = 0, maxRow = 0, minColumn = 0, maxColumn = 0) => {
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        setRawCellValue(rowIndex, columnIndex, "");
        setCellFormat(rowIndex, columnIndex, {});
      }
    }
  };

  const sortActiveColumn = (direction = "asc") => {
    const { minRow, maxRow, minColumn, maxColumn } = getDataSelectionBounds({
      preferTable: true,
      skipHeader: true
    });
    if (maxRow <= minRow || activeSelection.columnIndex < minColumn || activeSelection.columnIndex > maxColumn) {
      return false;
    }
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, `sort ${direction === "desc" ? "Z-A" : "A-Z"}`)) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const sortColumnOffset = activeSelection.columnIndex - minColumn;
    const rows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => {
      const rowIndex = minRow + offset;
      return {
        originalIndex: rowIndex,
        ...readDataRangeRow(rowIndex, minColumn, maxColumn)
      };
    });
    rows.sort((leftRow, rightRow) => {
      const result = compareDataValues(leftRow.values[sortColumnOffset], rightRow.values[sortColumnOffset], direction);
      return result || leftRow.originalIndex - rightRow.originalIndex;
    });
    rows.forEach((row, offset) => {
      writeDataRangeRow(minRow + offset, minColumn, row);
    });
    getActiveSheetState().sort = { columnIndex: activeSelection.columnIndex, direction };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const getTableFilterKey = (table = {}, columnIndex = 0) => `${table.id || "table"}:${columnIndex}`;

  const getTableDataStartRow = (table = {}) => {
    const bounds = getStructureBounds(table);
    return bounds.minRow + (table.showHeaderRow === false ? 0 : 1);
  };

  const getTableDataEndRow = (table = {}) => {
    const bounds = getStructureBounds(table);
    return table.showTotalRow ? Math.max(getTableDataStartRow(table) - 1, bounds.maxRow - 1) : bounds.maxRow;
  };

  const getTableHeaderLabel = (table = {}, columnIndex = 0) => {
    const bounds = getStructureBounds(table);
    const fallback = `Column ${Math.max(1, columnIndex - bounds.minColumn + 1)}`;
    if (table.showHeaderRow === false) {
      return fallback;
    }
    return String(getRawCellValue(bounds.minRow, columnIndex) || fallback).trim() || fallback;
  };

  const getTableColumnStructuredRef = (table = {}, columnIndex = 0) =>
    `${table.name}[${getTableHeaderLabel(table, columnIndex).replace(/\]/g, "")}]`;

  const normalizeTableTotalFunction = (value = "sum") => {
    const normalized = String(value || "sum").trim().toLowerCase();
    return SPREADSHEET_TABLE_TOTAL_FUNCTIONS.has(normalized) ? normalized : "sum";
  };

  const getTableTotalFunctionForColumn = (table = {}, columnIndex = 0) =>
    normalizeTableTotalFunction(table.totalFunctions?.[String(columnIndex)] || "sum");

  const tableColumnHasNumericValues = (table = {}, columnIndex = 0) => {
    const bounds = getStructureBounds(table);
    const startRow = getTableDataStartRow(table);
    const endRow = table.showTotalRow ? Math.max(startRow - 1, bounds.maxRow - 1) : bounds.maxRow;
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      const value = getRawCellValue(rowIndex, columnIndex);
      if (String(value || "").trim() && Number.isFinite(coerceNumeric(value))) {
        return true;
      }
    }
    return false;
  };

  const buildTableDefaultTotalFunctions = (table = {}) => {
    const bounds = getStructureBounds(table);
    const totalFunctions = { ...(table.totalFunctions || {}) };
    for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
      const key = String(columnIndex);
      if (!totalFunctions[key]) {
        totalFunctions[key] =
          columnIndex === bounds.minColumn ? "none" : tableColumnHasNumericValues(table, columnIndex) ? "sum" : "none";
      }
    }
    return totalFunctions;
  };

  const getTableTotalFormulaForColumn = (table = {}, columnIndex = 0) => {
    const functionName = getTableTotalFunctionForColumn(table, columnIndex);
    const subtotalCode = SPREADSHEET_TABLE_TOTAL_SUBTOTAL_CODES[functionName];
    if (!subtotalCode) {
      return "";
    }
    return `=SUBTOTAL(${subtotalCode},${getTableColumnStructuredRef(table, columnIndex)})`;
  };

  const writeTableTotalRowValues = (table = {}) => {
    if (!table?.showTotalRow) {
      return false;
    }
    const bounds = getStructureBounds(table);
    ensureGridSize(bounds.maxRow + 1, bounds.maxColumn + 1);
    for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
      if (columnIndex === bounds.minColumn) {
        setRawCellValue(bounds.maxRow, columnIndex, "Total");
        continue;
      }
      setRawCellValue(bounds.maxRow, columnIndex, getTableTotalFormulaForColumn(table, columnIndex));
    }
    return true;
  };

  const clearTableTotalRowValues = (table = {}) => {
    const bounds = getStructureBounds(table);
    for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
      setRawCellValue(bounds.maxRow, columnIndex, "");
    }
  };

  const tableRowHasData = (rowIndex = 0, minColumn = 0, maxColumn = 0) => {
    for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
      if (String(getRawCellValue(rowIndex, columnIndex) || "").trim()) {
        return true;
      }
    }
    return false;
  };

  const buildTableWithTotalRowVisibility = (table = {}, showTotalRow = true) => {
    const bounds = getStructureBounds(table);
    if (showTotalRow) {
      if (table.showTotalRow) {
        const nextTable = {
          ...table,
          totalFunctions: buildTableDefaultTotalFunctions(table)
        };
        writeTableTotalRowValues(nextTable);
        return nextTable;
      }
      const totalRowIndex = bounds.maxRow + 1;
      if (
        tableRowHasData(totalRowIndex, bounds.minColumn, bounds.maxColumn) &&
        !window.confirm("The row below this table contains values. Use it as the total row?")
      ) {
        return false;
      }
      const nextTable = {
        ...table,
        endRowIndex: totalRowIndex,
        showTotalRow: true,
        totalFunctions: buildTableDefaultTotalFunctions(table)
      };
      writeTableTotalRowValues(nextTable);
      return nextTable;
    }

    if (!table.showTotalRow) {
      return { ...table, showTotalRow: false };
    }
    clearTableTotalRowValues(table);
    return {
      ...table,
      endRowIndex: Math.max(bounds.minRow, bounds.maxRow - 1),
      showTotalRow: false
    };
  };

  const getTableColumnValues = (table = {}, columnIndex = 0) => {
    const bounds = getStructureBounds(table);
    const startRow = getTableDataStartRow(table);
    const endRow = getTableDataEndRow(table);
    const values = [];
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      values.push(String(getRawCellValue(rowIndex, columnIndex) ?? ""));
    }
    return Array.from(new Set(values)).sort((left, right) =>
      left.localeCompare(right, "fr", { numeric: true, sensitivity: "base" })
    );
  };

  const getTableColumnFilter = (table = {}, columnIndex = 0) =>
    getActiveSheetTableFilters()[getTableFilterKey(table, columnIndex)] || { query: "", active: false, selectedValues: [] };

  const isTableColumnFilterActive = (table = {}, columnIndex = 0) => {
    const allValues = getTableColumnValues(table, columnIndex);
    const filter = getTableColumnFilter(table, columnIndex);
    return Boolean(filter.query || (filter.active && filter.selectedValues.length < allValues.length));
  };

  const sortTableColumn = (table = {}, columnIndex = 0, direction = "asc") => {
    const bounds = getStructureBounds(table);
    const minRow = getTableDataStartRow(table);
    const maxRow = getTableDataEndRow(table);
    if (maxRow < minRow || columnIndex < bounds.minColumn || columnIndex > bounds.maxColumn) {
      return false;
    }
    if (!ensureEditableBounds({ minRow, maxRow, minColumn: bounds.minColumn, maxColumn: bounds.maxColumn }, "sort the table")) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const sortColumnOffset = columnIndex - bounds.minColumn;
    const rows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => {
      const rowIndex = minRow + offset;
      return {
        originalIndex: rowIndex,
        ...readDataRangeRow(rowIndex, bounds.minColumn, bounds.maxColumn)
      };
    });
    rows.sort((leftRow, rightRow) => {
      const result = compareDataValues(leftRow.values[sortColumnOffset], rightRow.values[sortColumnOffset], direction);
      return result || leftRow.originalIndex - rightRow.originalIndex;
    });
    rows.forEach((row, offset) => {
      writeDataRangeRow(minRow + offset, bounds.minColumn, row);
    });
    getActiveSheetState().sort = { columnIndex, direction, tableId: table.id || "" };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const setTableColumnFilter = (table = {}, columnIndex = 0, selectedValues = []) => {
    persistGridIntoActiveSheet();
    const allValues = getTableColumnValues(table, columnIndex);
    const normalizedSelected = Array.from(new Set(selectedValues.map((value) => String(value ?? ""))));
    const nextFilters = getActiveSheetTableFilters();
    const key = getTableFilterKey(table, columnIndex);
    if (normalizedSelected.length >= allValues.length) {
      delete nextFilters[key];
    } else {
      nextFilters[key] = { query: "", active: true, selectedValues: normalizedSelected };
    }
    const beforeSnapshot = getWorkbookSnapshot();
    getActiveSheetState().tableFilters = nextFilters;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const clearTableColumnFilter = (table = {}, columnIndex = 0) => {
    persistGridIntoActiveSheet();
    const nextFilters = getActiveSheetTableFilters();
    delete nextFilters[getTableFilterKey(table, columnIndex)];
    const beforeSnapshot = getWorkbookSnapshot();
    getActiveSheetState().tableFilters = nextFilters;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const filterBySelectedValue = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
    nextActiveSheet.filterColumnIndex = activeSelection.columnIndex;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const removeDuplicateRows = () => {
    const { minRow, maxRow, minColumn, maxColumn } = getDataSelectionBounds({
      preferTable: true,
      skipHeader: true
    });
    if (maxRow <= minRow) {
      return false;
    }
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, "remove duplicates")) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const seenRows = new Set();
    const uniqueRows = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = readDataRangeRow(rowIndex, minColumn, maxColumn);
      const key = row.values.map((value) => String(value ?? "").trim().toLocaleLowerCase("fr")).join("\u001f");
      if (seenRows.has(key)) {
        continue;
      }
      seenRows.add(key);
      uniqueRows.push(row);
    }
    uniqueRows.forEach((row, offset) => writeDataRangeRow(minRow + offset, minColumn, row));
    clearDataRange(minRow + uniqueRows.length, maxRow, minColumn, maxColumn);
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: Math.max(minRow, minRow + uniqueRows.length - 1),
      endColumnIndex: maxColumn
    });
    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const transformSelectedTextCells = (transformer) => {
    if (typeof transformer !== "function") {
      return false;
    }
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, "transform the selection")) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const value = getRawCellValue(rowIndex, columnIndex);
        if (String(value || "").startsWith("=")) {
          continue;
        }
        setRawCellValue(rowIndex, columnIndex, transformer(value));
      }
    }
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const trimSelectedWhitespace = () =>
    transformSelectedTextCells((value) => String(value ?? "").replace(/\u00a0/g, " ").trim());

  const cleanSelectedText = () =>
    transformSelectedTextCells((value) =>
      String(value ?? "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim()
    );

  const delimiterFromPromptValue = (value = "") => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    if (["tab", "\\t"].includes(normalized)) {
      return "\t";
    }
    if (["space", " "].includes(normalized)) {
      return " ";
    }
    if (["comma", ","].includes(normalized)) {
      return ",";
    }
    if (["semicolon", ";"].includes(normalized)) {
      return ";";
    }
    return String(value).slice(0, 1);
  };

  const splitTextToColumns = () => {
    const delimiterInput = window.prompt("Delimiter: comma, semicolon, tab, space or custom", ",");
    if (delimiterInput === null) {
      return false;
    }
    const delimiter = delimiterFromPromptValue(delimiterInput);
    if (!delimiter) {
      return false;
    }
    const { minRow, maxRow, minColumn } = getSelectionBounds();
    const sourceColumn = minColumn;
    const splitRows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => {
      const rowIndex = minRow + offset;
      return {
        rowIndex,
        parts: String(getRawCellValue(rowIndex, sourceColumn) ?? "").split(delimiter),
        format: getCellFormat(rowIndex, sourceColumn)
      };
    });
    const maxParts = Math.max(1, ...splitRows.map((row) => row.parts.length));
    if (
      !ensureEditableBounds(
        {
          minRow,
          maxRow,
          minColumn: sourceColumn,
          maxColumn: sourceColumn + maxParts - 1
        },
        "split text to columns"
      )
    ) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    ensureGridSize(maxRow + 1, sourceColumn + maxParts);
    splitRows.forEach(({ rowIndex, parts, format }) => {
      for (let offset = 0; offset < maxParts; offset += 1) {
        setRawCellValue(rowIndex, sourceColumn + offset, parts[offset] ?? "");
        setCellFormat(rowIndex, sourceColumn + offset, format);
      }
    });
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: sourceColumn,
      endRowIndex: maxRow,
      endColumnIndex: sourceColumn + maxParts - 1
    });
    activeSelection = { rowIndex: minRow, columnIndex: sourceColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const transposeSelectionRange = () => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    if (minRow === maxRow && minColumn === maxColumn) {
      return false;
    }
    const height = maxRow - minRow + 1;
    const width = maxColumn - minColumn + 1;
    const matrix = Array.from({ length: height }, (_, rowOffset) =>
      Array.from({ length: width }, (_, columnOffset) => ({
        value: getRawCellValue(minRow + rowOffset, minColumn + columnOffset),
        format: getCellFormat(minRow + rowOffset, minColumn + columnOffset)
      }))
    );
    if (
      !ensureEditableBounds(
        {
          minRow,
          maxRow: Math.max(maxRow, minRow + width - 1),
          minColumn,
          maxColumn: Math.max(maxColumn, minColumn + height - 1)
        },
        "transpose the selection"
      )
    ) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    clearDataRange(minRow, maxRow, minColumn, maxColumn);
    ensureGridSize(minRow + width, minColumn + height);
    for (let rowOffset = 0; rowOffset < width; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < height; columnOffset += 1) {
        const source = matrix[columnOffset][rowOffset];
        setRawCellValue(minRow + rowOffset, minColumn + columnOffset, source.value);
        setCellFormat(minRow + rowOffset, minColumn + columnOffset, source.format);
      }
    }
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: minRow + width - 1,
      endColumnIndex: minColumn + height - 1
    });
    activeSelection = { rowIndex: minRow, columnIndex: minColumn };
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const filterActiveColumn = () => {
    const nextQuery = window.prompt("Filter query", getActiveSheetState().filterQuery || "");
    if (nextQuery === null) {
      return;
    }
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = String(nextQuery || "");
    nextActiveSheet.filterColumnIndex = activeSelection.columnIndex;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const clearActiveFilter = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.filterQuery = "";
    nextActiveSheet.filterColumnIndex = -1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const freezeRowsToSelection = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenRows = activeSelection.rowIndex + 1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const freezeColumnsToSelection = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenColumns = activeSelection.columnIndex + 1;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const unfreezeSheet = () => {
    const nextModel = persistGridIntoActiveSheet();
    const nextActiveSheet = getWorkbookActiveSheet();
    nextActiveSheet.frozenRows = 0;
    nextActiveSheet.frozenColumns = 0;
    workbookModel = nextModel;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
  };

  const insertRowAtSelection = (offset = 1) => {
    if (!ensureSheetStructureEditable("insert rows")) {
      return;
    }
    const insertIndex = clamp(activeSelection.rowIndex + offset, 0, sheetGrid.length);
    sheetGrid.splice(insertIndex, 0, Array.from({ length: sheetGrid[0].length }, () => ""));
    activeSelection = {
      rowIndex: insertIndex,
      columnIndex: activeSelection.columnIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(false);
    rerenderPreview();
  };

  const insertColumnAtSelection = (offset = 1) => {
    if (!ensureSheetStructureEditable("insert columns")) {
      return;
    }
    const insertIndex = clamp(activeSelection.columnIndex + offset, 0, (sheetGrid[0] || []).length);
    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      nextRow.splice(insertIndex, 0, "");
      return nextRow;
    });
    activeSelection = {
      rowIndex: activeSelection.rowIndex,
      columnIndex: insertIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(false);
    rerenderPreview();
  };

  const deleteActiveRow = () => {
    if (sheetGrid.length <= 1) {
      return;
    }
    if (!ensureSheetStructureEditable("delete rows")) {
      return;
    }
    sheetGrid.splice(activeSelection.rowIndex, 1);
    activeSelection = {
      rowIndex: Math.max(0, Math.min(activeSelection.rowIndex, sheetGrid.length - 1)),
      columnIndex: activeSelection.columnIndex
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(false);
    rerenderPreview();
  };

  const deleteActiveColumn = () => {
    if ((sheetGrid[0] || []).length <= 1) {
      return;
    }
    if (!ensureSheetStructureEditable("delete columns")) {
      return;
    }
    sheetGrid = sheetGrid.map((row) => {
      const nextRow = [...row];
      nextRow.splice(activeSelection.columnIndex, 1);
      return nextRow;
    });
    activeSelection = {
      rowIndex: activeSelection.rowIndex,
      columnIndex: Math.max(0, Math.min(activeSelection.columnIndex, sheetGrid[0].length - 1))
    };
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: activeSelection.columnIndex
    });
    commitModel(false);
    rerenderPreview();
  };

  const getSheetStateById = (sheetId = "") =>
    workbookModel.sheets.find((sheet) => sheet.id === sheetId) || null;

  const getSheetIndexById = (sheetId = "") =>
    workbookModel.sheets.findIndex((sheet) => sheet.id === sheetId);

  const buildBlankSheetModel = (sourceSheet = null, name = "Sheet") => {
    const columnCount = Math.max(3, sourceSheet?.columns?.length || 3);
    return {
      id: `sheet-${Date.now()}`,
      name,
      hidden: false,
      columns: Array.from({ length: columnCount }, () => ""),
      rows: [Array.from({ length: columnCount }, () => "")],
      columnWidths: {},
      rowHeights: {},
      merges: [],
      cellFormats: {},
      cellNotes: {},
      dataValidations: {},
      conditionalFormats: [],
      tables: [],
      pivotTables: [],
      charts: [],
      sparklines: {},
      slicers: [],
      filterQuery: "",
      filterColumnIndex: -1,
      tableFilters: {},
      sort: null,
      protected: false,
      protectedRanges: [],
      zoomLevel: 1,
      showGridlines: true,
      frozenRows: 0,
      frozenColumns: 0
    };
  };

  const createSheetFromReference = (referenceSheetId = workbookModel.activeSheetId, { duplicate = false } = {}) => {
    persistGridIntoActiveSheet();
    const sourceSheet = getSheetStateById(referenceSheetId) || getActiveSheetState();
    const sourceIndex = Math.max(0, getSheetIndexById(sourceSheet.id));
    const nextIndex = workbookModel.sheets.length + 1;
    const nextSheet = duplicate
      ? {
          ...cloneSpreadsheetSnapshot(sourceSheet),
          id: `sheet-${Date.now()}`,
          name: `${sourceSheet.name || "Sheet"} copy`,
          hidden: false
        }
      : buildBlankSheetModel(sourceSheet, `Sheet ${nextIndex}`);
    workbookModel.sheets.splice(sourceIndex + 1, 0, nextSheet);
    workbookModel.activeSheetId = nextSheet.id;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
    return nextSheet;
  };

  const createSheetFromActive = ({ duplicate = false } = {}) => {
    createSheetFromReference(workbookModel.activeSheetId, { duplicate });
  };

  const renameSheetById = (sheetId = workbookModel.activeSheetId) => {
    const targetSheet = getSheetStateById(sheetId);
    if (!targetSheet) {
      return false;
    }
    const nextName = window.prompt("Sheet name", targetSheet.name || "Sheet");
    if (!nextName) {
      return false;
    }
    targetSheet.name = String(nextName).trim() || targetSheet.name;
    persistWorkbookState(false);
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const renameActiveSheet = () => {
    renameSheetById(workbookModel.activeSheetId);
  };

  const deleteSheetById = (sheetId = workbookModel.activeSheetId) => {
    if (workbookModel.sheets.length <= 1) {
      return false;
    }
    const targetSheet = getSheetStateById(sheetId);
    if (!targetSheet) {
      return false;
    }
    if (!window.confirm(`Delete "${targetSheet.name || "Sheet"}"?`)) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const targetIndex = Math.max(0, getSheetIndexById(sheetId));
    workbookModel.sheets.splice(targetIndex, 1);
    const nextActiveSheet =
      workbookModel.sheets.slice(targetIndex).find((sheet) => !sheet.hidden) ||
      [...workbookModel.sheets.slice(0, targetIndex)].reverse().find((sheet) => !sheet.hidden) ||
      workbookModel.sheets[0];
    if (workbookModel.activeSheetId === sheetId) {
      workbookModel.activeSheetId = nextActiveSheet?.id || workbookModel.sheets[0]?.id;
    }
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const deleteActiveSheet = () => {
    deleteSheetById(workbookModel.activeSheetId);
  };

  const moveSheetById = (sheetId = workbookModel.activeSheetId, offset = 0) => {
    if (!offset || workbookModel.sheets.length <= 1) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const sourceIndex = getSheetIndexById(sheetId);
    if (sourceIndex < 0) {
      return false;
    }
    const targetIndex = clamp(sourceIndex + offset, 0, workbookModel.sheets.length - 1);
    if (targetIndex === sourceIndex) {
      return false;
    }
    const [targetSheet] = workbookModel.sheets.splice(sourceIndex, 1);
    workbookModel.sheets.splice(targetIndex, 0, targetSheet);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const moveActiveSheet = (offset = 0) => moveSheetById(workbookModel.activeSheetId, offset);

  const hideSheetById = (sheetId = workbookModel.activeSheetId) => {
    if (getVisibleSheets().length <= 1) {
      window.alert("At least one sheet must stay visible.");
      return false;
    }
    const targetSheet = getSheetStateById(sheetId);
    if (!targetSheet || targetSheet.hidden) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const targetIndex = Math.max(0, getSheetIndexById(sheetId));
    targetSheet.hidden = true;
    const nextActiveSheet =
      workbookModel.sheets.slice(targetIndex + 1).find((sheet) => !sheet.hidden) ||
      [...workbookModel.sheets.slice(0, targetIndex)].reverse().find((sheet) => !sheet.hidden) ||
      workbookModel.sheets.find((sheet) => !sheet.hidden);
    if (workbookModel.activeSheetId === sheetId) {
      workbookModel.activeSheetId = nextActiveSheet?.id || workbookModel.sheets[0]?.id;
    }
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const hideActiveSheet = () => hideSheetById(workbookModel.activeSheetId);

  const unhideSheet = (sheetId = "", { activate = true } = {}) => {
    persistGridIntoActiveSheet();
    const targetSheet = workbookModel.sheets.find((sheet) => sheet.id === sheetId && sheet.hidden);
    if (!targetSheet) {
      return false;
    }
    const beforeSnapshot = getWorkbookSnapshot();
    targetSheet.hidden = false;
    if (activate) {
      workbookModel.activeSheetId = targetSheet.id;
    }
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const setSheetProtectionById = (sheetId = workbookModel.activeSheetId, protectedState = true) => {
    const targetSheet = getSheetStateById(sheetId);
    if (!targetSheet || Boolean(targetSheet.protected) === Boolean(protectedState)) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    targetSheet.protected = Boolean(protectedState);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const protectActiveSheet = () => setSheetProtectionById(workbookModel.activeSheetId, true);

  const unprotectActiveSheet = () => setSheetProtectionById(workbookModel.activeSheetId, false);

  const protectSelectionRange = () => {
    if (getActiveSheetState().protected) {
      window.alert("This sheet is already fully protected.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const bounds = normalizeSelectionBounds(getSelectionBounds());
    const rangeLabel = formatBoundsAddress(bounds);
    const currentSheet = getActiveSheetState();
    currentSheet.protectedRanges = normalizeSpreadsheetProtectionRanges(currentSheet.protectedRanges).filter(
      (range) =>
        range.startRowIndex !== bounds.minRow ||
        range.endRowIndex !== bounds.maxRow ||
        range.startColumnIndex !== bounds.minColumn ||
        range.endColumnIndex !== bounds.maxColumn
    );
    currentSheet.protectedRanges.push({
      id: `protected-range-${Date.now()}`,
      startRowIndex: bounds.minRow,
      endRowIndex: bounds.maxRow,
      startColumnIndex: bounds.minColumn,
      endColumnIndex: bounds.maxColumn,
      label: rangeLabel
    });
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const unprotectSelectionRange = () => {
    const bounds = normalizeSelectionBounds(getSelectionBounds());
    const ranges = getActiveSheetProtectedRanges();
    const nextRanges = ranges.filter((range) => {
      const rangeBounds = normalizeSelectionBounds(range);
      return (
        rangeBounds.maxRow < bounds.minRow ||
        rangeBounds.minRow > bounds.maxRow ||
        rangeBounds.maxColumn < bounds.minColumn ||
        rangeBounds.minColumn > bounds.maxColumn
      );
    });
    if (nextRanges.length === ranges.length) {
      window.alert("No protected range intersects the current selection.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    currentSheet.protectedRanges = nextRanges;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const clearActiveSheetProtectedRanges = () => {
    if (!getActiveSheetProtectedRanges().length) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    currentSheet.protectedRanges = [];
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const getSelectionRangeAddress = () => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const startAddress = coordsToAddress(minRow, minColumn);
    const endAddress = coordsToAddress(maxRow, maxColumn);
    return startAddress === endAddress ? startAddress : `${startAddress}:${endAddress}`;
  };

  const getNamedRangeDisplayLabel = (namedRange = null) => {
    if (!namedRange) {
      return "";
    }
    const sheet = getSheetStateById(namedRange.sheetId);
    return `${namedRange.name} = ${sheet?.name ? `${sheet.name}!` : ""}${namedRange.range}`;
  };

  const getSelectionNamedRange = () => {
    const selectionAddress = getSelectionRangeAddress().toUpperCase();
    return getWorkbookNamedRanges().find(
      (namedRange) =>
        namedRange.sheetId === workbookModel.activeSheetId &&
        String(namedRange.range || "").toUpperCase() === selectionAddress
    ) || null;
  };

  const getNameBoxSelectionLabel = () => getSelectionNamedRange()?.name || getSelectionRangeAddress();

  const isNamedRangeNameAvailable = (name = "", ignoreId = "") => {
    const lookup = String(name || "").trim().toLowerCase();
    return !getWorkbookNamedRanges().some(
      (namedRange) =>
        namedRange.id !== ignoreId &&
        (!namedRange.sheetId || namedRange.sheetId === workbookModel.activeSheetId) &&
        namedRange.name.toLowerCase() === lookup
    );
  };

  const buildDefaultNamedRangeName = () => {
    const { minRow, minColumn } = getSelectionBounds();
    const headerValue = String(getRawCellValue(minRow, minColumn) || "").trim();
    const base = headerValue
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^(\d)/, "_$1")
      .replace(/^_+|_+$/g, "");
    let candidate = isSpreadsheetDefinedNameValid(base) ? base : "Selection";
    let suffix = 1;
    while (!isNamedRangeNameAvailable(candidate)) {
      suffix += 1;
      candidate = `${base || "Selection"}${suffix}`;
    }
    return candidate;
  };

  const selectRangeBounds = (bounds = {}) => {
    const normalized = normalizeSelectionBounds(bounds);
    ensureGridSize(normalized.maxRow + 1, normalized.maxColumn + 1);
    activeSelection = {
      rowIndex: normalized.minRow,
      columnIndex: normalized.minColumn
    };
    setSelectionRange({
      startRowIndex: normalized.minRow,
      startColumnIndex: normalized.minColumn,
      endRowIndex: normalized.maxRow,
      endColumnIndex: normalized.maxColumn
    });
    focusSelection(normalized.minRow, normalized.minColumn, {
      suppressFormulaEdit: true,
      preserveRange: true
    });
    return true;
  };

  const focusNamedRange = (namedRange = null) => {
    const normalizedNamedRange = normalizeSpreadsheetNamedRange(namedRange);
    const bounds = getBoundsFromCellOrRangeAddress(normalizedNamedRange?.range);
    if (!normalizedNamedRange || !bounds) {
      return false;
    }
    if (normalizedNamedRange.sheetId && normalizedNamedRange.sheetId !== workbookModel.activeSheetId) {
      const targetSheet = getSheetStateById(normalizedNamedRange.sheetId);
      if (!targetSheet || targetSheet.hidden) {
        window.alert("This named range points to a hidden or missing sheet.");
        return false;
      }
      persistGridIntoActiveSheet();
      workbookModel.activeSheetId = targetSheet.id;
      spreadsheetSelectionStore.set(historyKey, {
        rowIndex: bounds.minRow,
        columnIndex: bounds.minColumn,
        range: {
          startRowIndex: bounds.minRow,
          startColumnIndex: bounds.minColumn,
          endRowIndex: bounds.maxRow,
          endColumnIndex: bounds.maxColumn
        }
      });
      persistWorkbookState(false, { trackHistory: false });
      rerenderPreview({ persistGrid: false });
      return true;
    }
    return selectRangeBounds(bounds);
  };

  const focusNamedRangeByName = (name = "") => {
    const namedRange = getNamedRangeByName(name);
    if (!namedRange) {
      return false;
    }
    return focusNamedRange(namedRange);
  };

  const createOrUpdateNamedRangeFromSelection = (initialName = "", { promptForName = true } = {}) => {
    const existingForSelection = getSelectionNamedRange();
    const defaultName = initialName || existingForSelection?.name || buildDefaultNamedRangeName();
    const nameInput = promptForName ? window.prompt("Name", defaultName) : defaultName;
    if (nameInput === null) {
      return false;
    }
    const name = String(nameInput || "").trim();
    if (!isSpreadsheetDefinedNameValid(name)) {
      window.alert("Use a valid Excel name: letters, numbers, underscores or dots; it cannot look like A1 or be a formula name.");
      return false;
    }
    if (!isNamedRangeNameAvailable(name, existingForSelection?.id || "")) {
      window.alert("This name already exists on the active sheet.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const range = getSelectionRangeAddress();
    const nextNamedRange = {
      id: existingForSelection?.id || `named-range-${Date.now()}`,
      name,
      range,
      sheetId: workbookModel.activeSheetId,
      scope: "sheet",
      comment: existingForSelection?.comment || ""
    };
    const nextNamedRanges = existingForSelection
      ? getWorkbookNamedRanges().map((namedRange) => (namedRange.id === existingForSelection.id ? nextNamedRange : namedRange))
      : [...getWorkbookNamedRanges(), nextNamedRange];
    setWorkbookNamedRanges(nextNamedRanges);
    persistWorkbookState(false, { beforeSnapshot });
    syncSelectionUi();
    return true;
  };

  const deleteNamedRangeByName = (name = "") => {
    const namedRange = getNamedRangeByName(name);
    if (!namedRange) {
      window.alert("Named range not found.");
      return false;
    }
    if (!window.confirm(`Delete ${namedRange.name}?`)) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    setWorkbookNamedRanges(getWorkbookNamedRanges().filter((entry) => entry.id !== namedRange.id));
    persistWorkbookState(false, { beforeSnapshot });
    syncSelectionUi();
    return true;
  };

  const deleteNamedRangePrompt = () => {
    const namedRanges = getWorkbookNamedRanges();
    if (!namedRanges.length) {
      window.alert("No named ranges yet.");
      return false;
    }
    const name = window.prompt(
      `Delete which name?\n\n${namedRanges.map(getNamedRangeDisplayLabel).join("\n")}`,
      getSelectionNamedRange()?.name || namedRanges[0]?.name || ""
    );
    return name === null ? false : deleteNamedRangeByName(name);
  };

  const showNameManager = () => {
    const namedRanges = getWorkbookNamedRanges();
    if (!namedRanges.length) {
      window.alert("No named ranges yet. Select cells, then use Define name.");
      return false;
    }
    const name = window.prompt(
      `Named ranges:\n\n${namedRanges.map(getNamedRangeDisplayLabel).join("\n")}\n\nType a name to select it, or leave empty to close.`,
      getSelectionNamedRange()?.name || ""
    );
    if (name === null || !String(name || "").trim()) {
      return false;
    }
    if (!focusNamedRangeByName(name)) {
      window.alert("Named range not found.");
      return false;
    }
    return true;
  };

  const buildNamedRangeMenuItems = () => {
    const namedRanges = getWorkbookNamedRanges();
    return namedRanges.length
      ? namedRanges.map((namedRange) => ({
          label: getNamedRangeDisplayLabel(namedRange),
          onSelect: () => focusNamedRange(namedRange)
        }))
      : [{ label: "No named ranges", disabled: true }];
  };

  const handleNameBoxCommit = (value = "") => {
    const text = String(value || "").trim();
    if (!text) {
      syncSelectionUi();
      return false;
    }
    if (focusNamedRangeByName(text)) {
      return true;
    }
    const bounds = getBoundsFromCellOrRangeAddress(text);
    if (bounds) {
      selectRangeBounds(bounds);
      return true;
    }
    return createOrUpdateNamedRangeFromSelection(text, { promptForName: false });
  };

  const buildUniqueSheetName = (baseName = "Sheet") => {
    const base = String(baseName || "Sheet").trim() || "Sheet";
    const existingNames = new Set(workbookModel.sheets.map((sheet) => String(sheet.name || "").trim().toLowerCase()));
    let candidate = base;
    let suffix = 2;
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${base} ${suffix}`;
      suffix += 1;
    }
    return candidate;
  };

  const addOrEditActiveCellNote = () => {
    if (!ensureActiveCellEditable("edit the cell note")) {
      return false;
    }
    const currentNote = getCellNote(activeSelection.rowIndex, activeSelection.columnIndex);
    const nextText = window.prompt("Cell note", currentNote?.text || "");
    if (nextText === null) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    setCellNote(activeSelection.rowIndex, activeSelection.columnIndex, nextText);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const removeActiveCellNote = () => {
    const currentNote = getCellNote(activeSelection.rowIndex, activeSelection.columnIndex);
    if (!currentNote) {
      return false;
    }
    if (!ensureActiveCellEditable("remove the cell note")) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    setCellNote(activeSelection.rowIndex, activeSelection.columnIndex, null);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const normalizePromptedDataValidationType = (value = "") => {
    const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    if (["list", "liste"].includes(text)) return "list";
    if (["whole", "integer", "entier", "nombreentier"].includes(text)) return "whole";
    if (["decimal", "number", "nombre"].includes(text)) return "decimal";
    if (["date"].includes(text)) return "date";
    if (["textlength", "longueur", "longueurtexte"].includes(text)) return "textLength";
    return "";
  };

  const normalizePromptedDataValidationOperator = (value = "") => {
    const text = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const aliases = {
      between: "between",
      entre: "between",
      notbetween: "notBetween",
      pasentre: "notBetween",
      equal: "equal",
      equals: "equal",
      egal: "equal",
      notEqual: "notEqual",
      notequal: "notEqual",
      different: "notEqual",
      greaterthan: "greaterThan",
      greater: "greaterThan",
      superieur: "greaterThan",
      lessthan: "lessThan",
      less: "lessThan",
      inferieur: "lessThan",
      greaterorequal: "greaterOrEqual",
      greaterthanorequal: "greaterOrEqual",
      superieurouegal: "greaterOrEqual",
      lessorequal: "lessOrEqual",
      lessthanorequal: "lessOrEqual",
      inferieurouegal: "lessOrEqual"
    };
    return aliases[text] || "between";
  };

  const addOrEditSelectedDataValidation = () => {
    if (!ensureEditableSelection("set data validation")) {
      return false;
    }
    const currentRule = getCellDataValidation(activeSelection.rowIndex, activeSelection.columnIndex);
    const typeInput = window.prompt(
      "Validation type: list, whole, decimal, date, textLength",
      currentRule?.type || "list"
    );
    if (typeInput === null) {
      return false;
    }
    const type = normalizePromptedDataValidationType(typeInput);
    if (!type) {
      window.alert("Unknown validation type. Use list, whole, decimal, date, or textLength.");
      return false;
    }

    const nextRule = {
      type,
      operator: currentRule?.operator || "between",
      allowBlank: currentRule?.allowBlank !== false,
      showDropdown: currentRule?.showDropdown !== false,
      source: currentRule?.source || "",
      minimum: currentRule?.minimum || "",
      maximum: currentRule?.maximum || "",
      message: currentRule?.message || ""
    };

    if (type === "list") {
      const source = window.prompt("List values or range (example: Yes,No or A1:A5)", nextRule.source || "");
      if (source === null) {
        return false;
      }
      if (!String(source || "").trim()) {
        window.alert("A list validation needs values or a range.");
        return false;
      }
      nextRule.source = String(source || "").trim();
      nextRule.operator = "between";
      nextRule.minimum = "";
      nextRule.maximum = "";
    } else {
      const operator = window.prompt(
        "Operator: between, equal, notEqual, greaterThan, lessThan, greaterOrEqual, lessOrEqual",
        nextRule.operator || "between"
      );
      if (operator === null) {
        return false;
      }
      nextRule.operator = normalizePromptedDataValidationOperator(operator);
      const minimum = window.prompt(type === "date" ? "Date/value 1 (example: 2026-04-29)" : "Value 1", nextRule.minimum || "");
      if (minimum === null) {
        return false;
      }
      nextRule.minimum = String(minimum || "").trim();
      if (nextRule.operator === "between" || nextRule.operator === "notBetween") {
        const maximum = window.prompt(type === "date" ? "Date/value 2" : "Value 2", nextRule.maximum || nextRule.minimum || "");
        if (maximum === null) {
          return false;
        }
        nextRule.maximum = String(maximum || "").trim();
      } else {
        nextRule.maximum = nextRule.minimum;
      }
    }

    const message = window.prompt("Error message (optional)", nextRule.message || "");
    if (message === null) {
      return false;
    }
    nextRule.message = String(message || "").trim();

    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setCellDataValidation(rowIndex, columnIndex, nextRule);
    });
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const clearSelectedDataValidation = () => {
    if (!ensureEditableSelection("clear data validation")) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    forEachSelectedCell((rowIndex, columnIndex) => {
      setCellDataValidation(rowIndex, columnIndex, null);
    });
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const showInvalidDataSummary = () => {
    const entries = Object.entries(getActiveSheetState().dataValidations || {});
    if (!entries.length) {
      window.alert("No data validation rules on this sheet.");
      return false;
    }
    const invalidCells = entries
      .map(([key, rule]) => {
        const [rowText, columnText] = key.split(":");
        const rowIndex = Number(rowText);
        const columnIndex = Number(columnText);
        if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
          return null;
        }
        const result = validateCellValueAgainstRule(getRawCellValue(rowIndex, columnIndex), rule);
        return result.valid ? null : { rowIndex, columnIndex, message: result.message };
      })
      .filter(Boolean);
    if (!invalidCells.length) {
      refreshGridValues({ preserveActiveEditor: false });
      window.alert("All data validation rules pass.");
      return true;
    }
    const firstInvalid = invalidCells[0];
    focusKeyboardSelection(firstInvalid.rowIndex, firstInvalid.columnIndex);
    refreshGridValues({ preserveActiveEditor: false });
    window.alert(
      `${invalidCells.length} invalid cell${invalidCells.length > 1 ? "s" : ""}. First: ${coordsToAddress(firstInvalid.rowIndex, firstInvalid.columnIndex)}.`
    );
    return true;
  };

  let conditionalFormatDialogOverlay = null;
  let conditionalFormatDialogKeydownHandler = null;

  const closeConditionalFormatDialog = () => {
    if (conditionalFormatDialogKeydownHandler) {
      document.removeEventListener("keydown", conditionalFormatDialogKeydownHandler);
      conditionalFormatDialogKeydownHandler = null;
    }
    if (conditionalFormatDialogOverlay?.isConnected) {
      conditionalFormatDialogOverlay.remove();
    }
    conditionalFormatDialogOverlay = null;
  };

  const normalizePromptedConditionalFormatType = (value = "") => {
    const text = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const aliases = {
      greaterthan: "greaterThan",
      greater: "greaterThan",
      superieur: "greaterThan",
      superieura: "greaterThan",
      lessthan: "lessThan",
      less: "lessThan",
      inferieur: "lessThan",
      inferieura: "lessThan",
      between: "between",
      entre: "between",
      equal: "equal",
      equals: "equal",
      egal: "equal",
      egala: "equal",
      textcontains: "textContains",
      contains: "textContains",
      contient: "textContains",
      duplicate: "duplicate",
      duplicates: "duplicate",
      doublon: "duplicate",
      doublons: "duplicate"
    };
    return aliases[text] || "";
  };

  const getConditionalFormatPreset = (presetId = "red") =>
    SPREADSHEET_CONDITIONAL_FORMAT_PRESETS.find((preset) => preset.id === presetId) ||
    SPREADSHEET_CONDITIONAL_FORMAT_PRESETS[0];

  const commitConditionalFormatRuleToSelection = (config = {}) => {
    if (!ensureEditableSelection("set conditional formatting")) {
      return false;
    }
    const type = normalizePromptedConditionalFormatType(config.type);
    if (!type) {
      window.alert("Type de mise en forme conditionnelle inconnu.");
      return false;
    }
    const value1 = String(config.value1 ?? "").trim();
    const value2 = String(config.value2 ?? "").trim();
    if (type !== "duplicate" && !value1) {
      window.alert("Ajoute une valeur pour cette regle.");
      return false;
    }
    if (type === "between" && !value2) {
      window.alert("Ajoute une valeur minimum et maximum.");
      return false;
    }

    const rule = {
      id: `conditional-format-${Date.now()}`,
      type,
      range: getSelectionRangeAddress(),
      value1,
      value2,
      fillColor: normalizeSpreadsheetColor(config.fillColor) || "",
      textColor: normalizeSpreadsheetColor(config.textColor) || "#202124",
      bold: Boolean(config.bold)
    };
    rule.label = describeConditionalFormatRule(rule);

    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    const currentRules = getActiveSheetConditionalFormats();
    currentSheet.conditionalFormats = [
      ...currentRules,
      normalizeSpreadsheetConditionalFormatRule(rule, currentRules.length)
    ].filter(Boolean);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const promptConditionalFormatRuleToSelection = (requestedType = "greaterThan", options = {}) => {
    const type = normalizePromptedConditionalFormatType(requestedType);
    if (!type) {
      window.alert("Type de mise en forme conditionnelle inconnu.");
      return false;
    }
    const preset = getConditionalFormatPreset(options.preset || "red");
    const config = {
      type,
      value1: "",
      value2: "",
      fillColor: preset.fillColor,
      textColor: preset.textColor,
      bold: preset.bold
    };
    if (type !== "duplicate") {
      const firstValue = window.prompt(
        type === "textContains" ? "Texte a rechercher" : type === "between" ? "Valeur minimum" : "Valeur",
        ""
      );
      if (firstValue === null) {
        return false;
      }
      config.value1 = String(firstValue || "").trim();
    }
    if (type === "between") {
      const secondValue = window.prompt("Valeur maximum", "");
      if (secondValue === null) {
        return false;
      }
      config.value2 = String(secondValue || "").trim();
    }
    return commitConditionalFormatRuleToSelection(config);
  };

  const openConditionalFormatRuleDialog = (initialType = "greaterThan") => {
    closeSheetMenu();
    closeContextMenu();
    closeConditionalFormatDialog();

    const overlay = document.createElement("div");
    overlay.className = "workspace-sheet-function-dialog-overlay";
    const backdrop = document.createElement("div");
    backdrop.className = "workspace-sheet-function-dialog-backdrop";
    const dialog = document.createElement("section");
    dialog.className = "workspace-sheet-function-dialog workspace-sheet-conditional-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Nouvelle regle de mise en forme conditionnelle");

    const header = document.createElement("div");
    header.className = "workspace-sheet-function-dialog-header";
    const title = document.createElement("h2");
    title.textContent = "Nouvelle regle";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "workspace-sheet-function-dialog-close";
    closeButton.setAttribute("aria-label", "Fermer");
    closeButton.appendChild(createSheetIconNode("close", { className: "workspace-sheet-function-close-icon", label: "Fermer" }));
    closeButton.addEventListener("click", closeConditionalFormatDialog);
    header.append(title, closeButton);

    const form = document.createElement("div");
    form.className = "workspace-sheet-conditional-form";
    const typeSelect = document.createElement("select");
    typeSelect.className = "workspace-sheet-conditional-control";
    Object.entries(SPREADSHEET_CONDITIONAL_FORMAT_TYPE_LABELS).forEach(([type, label]) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = label;
      typeSelect.appendChild(option);
    });
    typeSelect.value = normalizePromptedConditionalFormatType(initialType) || "greaterThan";

    const valueInput = document.createElement("input");
    valueInput.className = "workspace-sheet-conditional-control";
    valueInput.type = "text";
    valueInput.placeholder = "Valeur";

    const secondValueInput = document.createElement("input");
    secondValueInput.className = "workspace-sheet-conditional-control";
    secondValueInput.type = "text";
    secondValueInput.placeholder = "Valeur maximum";

    const presetSelect = document.createElement("select");
    presetSelect.className = "workspace-sheet-conditional-control";
    SPREADSHEET_CONDITIONAL_FORMAT_PRESETS.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    });

    const fillColorInput = document.createElement("input");
    fillColorInput.className = "workspace-sheet-conditional-control";
    fillColorInput.type = "color";
    const textColorInput = document.createElement("input");
    textColorInput.className = "workspace-sheet-conditional-control";
    textColorInput.type = "color";
    const boldWrap = document.createElement("label");
    boldWrap.className = "workspace-sheet-conditional-checkbox";
    const boldInput = document.createElement("input");
    boldInput.type = "checkbox";
    boldWrap.append(boldInput, document.createTextNode(" Texte gras"));

    const preview = document.createElement("div");
    preview.className = "workspace-sheet-conditional-preview";
    preview.textContent = "Apercu";

    const makeField = (labelText = "", control = null) => {
      const label = document.createElement("label");
      label.className = "workspace-sheet-conditional-field";
      const span = document.createElement("span");
      span.textContent = labelText;
      label.append(span);
      if (control) {
        label.appendChild(control);
      }
      form.appendChild(label);
      return label;
    };

    makeField("Regle", typeSelect);
    const valueField = makeField("Valeur", valueInput);
    const secondValueField = makeField("Valeur maximum", secondValueInput);
    makeField("Style", presetSelect);
    makeField("Remplissage", fillColorInput);
    makeField("Texte", textColorInput);
    form.append(boldWrap, preview);

    const footer = document.createElement("div");
    footer.className = "workspace-sheet-function-dialog-footer";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "workspace-sheet-function-secondary";
    cancelButton.textContent = "Annuler";
    cancelButton.addEventListener("click", closeConditionalFormatDialog);
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "workspace-sheet-function-primary";
    applyButton.textContent = "Appliquer";
    footer.append(cancelButton, applyButton);

    const applyPreset = () => {
      const preset = getConditionalFormatPreset(presetSelect.value);
      fillColorInput.value = normalizeSpreadsheetColor(preset.fillColor) || "#ffffff";
      textColorInput.value = normalizeSpreadsheetColor(preset.textColor) || "#202124";
      boldInput.checked = Boolean(preset.bold);
      updatePreview();
    };

    function updatePreview() {
      const type = typeSelect.value;
      valueField.hidden = type === "duplicate";
      secondValueField.hidden = type !== "between";
      valueInput.placeholder = type === "textContains" ? "Texte a rechercher" : type === "between" ? "Valeur minimum" : "Valeur";
      preview.style.background = normalizeSpreadsheetColor(fillColorInput.value) || "#ffffff";
      preview.style.color = normalizeSpreadsheetColor(textColorInput.value) || "#202124";
      preview.style.fontWeight = boldInput.checked ? "700" : "400";
      const label = SPREADSHEET_CONDITIONAL_FORMAT_TYPE_LABELS[type] || "Regle";
      preview.textContent = `${label} - ${getSelectionRangeAddress()}`;
    }

    const applyRule = () => {
      const applied = commitConditionalFormatRuleToSelection({
        type: typeSelect.value,
        value1: valueInput.value,
        value2: secondValueInput.value,
        fillColor: fillColorInput.value,
        textColor: textColorInput.value,
        bold: boldInput.checked
      });
      if (applied) {
        closeConditionalFormatDialog();
      }
    };

    presetSelect.addEventListener("change", applyPreset);
    typeSelect.addEventListener("change", updatePreview);
    valueInput.addEventListener("input", updatePreview);
    secondValueInput.addEventListener("input", updatePreview);
    fillColorInput.addEventListener("input", updatePreview);
    textColorInput.addEventListener("input", updatePreview);
    boldInput.addEventListener("change", updatePreview);
    applyButton.addEventListener("click", applyRule);
    backdrop.addEventListener("click", closeConditionalFormatDialog);
    conditionalFormatDialogKeydownHandler = (event) => {
      if (event.key === "Escape") {
        closeConditionalFormatDialog();
      }
      if (event.key === "Enter" && !event.target?.matches?.("select")) {
        event.preventDefault();
        applyRule();
      }
    };
    document.addEventListener("keydown", conditionalFormatDialogKeydownHandler);

    dialog.append(header, form, footer);
    overlay.append(backdrop, dialog);
    document.body.appendChild(overlay);
    conditionalFormatDialogOverlay = overlay;
    applyPreset();
    window.setTimeout(() => valueInput.focus(), 0);
    return true;
  };

  const addConditionalFormatRuleToSelection = (requestedType = "", options = {}) => {
    const type = normalizePromptedConditionalFormatType(requestedType);
    return type ? promptConditionalFormatRuleToSelection(type, options) : openConditionalFormatRuleDialog();
  };

  const clearSelectedConditionalFormats = () => {
    const currentRules = getActiveSheetConditionalFormats();
    if (!currentRules.length) {
      window.alert("Aucune regle de mise en forme conditionnelle sur cette feuille.");
      return false;
    }
    if (!ensureEditableSelection("clear conditional formatting")) {
      return false;
    }
    const selectionBounds = getSelectionBounds();
    const nextRules = currentRules.filter((rule) => {
      const ruleBounds = getBoundsFromCellOrRangeAddress(rule.range);
      return !ruleBounds || !boundsIntersect(ruleBounds, selectionBounds);
    });
    if (nextRules.length === currentRules.length) {
      window.alert("Aucune regle ne croise la selection actuelle.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    getActiveSheetState().conditionalFormats = nextRules;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const showConditionalFormatSummary = () => {
    const rules = getActiveSheetConditionalFormats();
    if (!rules.length) {
      window.alert("Aucune regle de mise en forme conditionnelle sur cette feuille.");
      return false;
    }
    window.alert(rules.map((rule, index) => `${index + 1}. ${describeConditionalFormatRule(rule)}`).join("\n"));
    return true;
  };

  const coerceChartNumericValue = (value) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      return Number.NaN;
    }
    return coerceNumeric(value);
  };

  const getChartCellComputedValue = (rowIndex = 0, columnIndex = 0) => {
    const rawValue = getRawCellValue(rowIndex, columnIndex);
    return rawValue.startsWith("=") ? evaluateCellValue(rowIndex, columnIndex) : rawValue;
  };

  const getChartSelectionDescriptor = (bounds = null) => {
    const normalizedBounds = bounds || getSelectionBounds();
    const { minRow, maxRow, minColumn, maxColumn } = normalizedBounds;
    const width = maxColumn - minColumn + 1;
    const height = maxRow - minRow + 1;
    const hasHeaderRow = minRow === 0 && height >= 2;
    const startRowIndex = hasHeaderRow ? minRow + 1 : minRow;
    const dataRowIndexes = Array.from(
      { length: Math.max(0, maxRow - startRowIndex + 1) },
      (_, offset) => startRowIndex + offset
    );
    const columnIndexes = Array.from({ length: width }, (_, offset) => minColumn + offset);
    const columnHasNumericData = (columnIndex = 0) =>
      dataRowIndexes.some((rowIndex) => Number.isFinite(coerceChartNumericValue(getChartCellComputedValue(rowIndex, columnIndex))));
    const numericColumns = columnIndexes.filter((columnIndex) => columnHasNumericData(columnIndex));
    const firstTextColumn = columnIndexes.find((columnIndex) =>
      dataRowIndexes.some((rowIndex) => {
        const raw = getChartCellComputedValue(rowIndex, columnIndex);
        return String(raw ?? "").trim() && !Number.isFinite(coerceChartNumericValue(raw));
      })
    );
    const labelColumnIndex = firstTextColumn ?? (width >= 2 ? minColumn : null);
    const valueColumns = numericColumns.filter((columnIndex) => columnIndex !== labelColumnIndex);
    return {
      minRow,
      maxRow,
      minColumn,
      maxColumn,
      width,
      height,
      hasHeaderRow,
      startRowIndex,
      dataRowIndexes,
      columnIndexes,
      numericColumns,
      valueColumns,
      labelColumnIndex,
      getHeader: (columnIndex = 0) =>
        hasHeaderRow ? String(getRawCellValue(minRow, columnIndex) || "").trim() : "",
      getRowLabel: (rowIndex = 0) => {
        if (labelColumnIndex !== null && labelColumnIndex >= minColumn && labelColumnIndex <= maxColumn) {
          const raw = String(getChartCellComputedValue(rowIndex, labelColumnIndex) || "").trim();
          if (raw) {
            return raw;
          }
        }
        return `Row ${rowIndex + 1}`;
      }
    };
  };

  const getPrimaryChartNumericValues = (descriptor = getChartSelectionDescriptor()) => {
    if (descriptor.height === 1 && descriptor.width >= 1) {
      return descriptor.columnIndexes
        .map((columnIndex) => coerceChartNumericValue(getChartCellComputedValue(descriptor.minRow, columnIndex)))
        .filter((value) => Number.isFinite(value));
    }
    const preferredColumn =
      descriptor.valueColumns[0] ??
      descriptor.numericColumns[0] ??
      descriptor.minColumn;
    return descriptor.dataRowIndexes
      .map((rowIndex) => coerceChartNumericValue(getChartCellComputedValue(rowIndex, preferredColumn)))
      .filter((value) => Number.isFinite(value));
  };

  const computeChartQuantile = (sortedValues = [], ratio = 0.5) => {
    if (!sortedValues.length) {
      return 0;
    }
    const index = (sortedValues.length - 1) * ratio;
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }
    const weight = index - lowerIndex;
    return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight;
  };

  const buildStandardChartPoints = (descriptor = getChartSelectionDescriptor()) => {
    const points = [];
    let title = "Selection chart";
    let seriesName = "Series 1";
    let secondarySeriesName = "";
    if (descriptor.height === 1 && descriptor.width >= 2) {
      title = `${getRawCellValue(descriptor.minRow, descriptor.minColumn) || "Row"} series`;
      seriesName = title;
      descriptor.columnIndexes.forEach((columnIndex) => {
        const value = getChartCellComputedValue(descriptor.minRow, columnIndex);
        if (!Number.isFinite(coerceChartNumericValue(value))) {
          return;
        }
        points.push({
          label: descriptor.getHeader(columnIndex) || columnLetter(columnIndex),
          value
        });
      });
      return { title, seriesName, secondarySeriesName, points };
    }

    const primaryColumn =
      descriptor.valueColumns[0] ??
      descriptor.numericColumns[0] ??
      Math.min(descriptor.maxColumn, descriptor.minColumn + 1);
    const secondaryColumn = descriptor.valueColumns[1] ?? null;
    const labelColumn =
      descriptor.labelColumnIndex !== null &&
      descriptor.labelColumnIndex !== primaryColumn
        ? descriptor.labelColumnIndex
        : null;
    seriesName = descriptor.getHeader(primaryColumn) || `Series ${columnLetter(primaryColumn)}`;
    secondarySeriesName =
      secondaryColumn !== null
        ? descriptor.getHeader(secondaryColumn) || `Series ${columnLetter(secondaryColumn)}`
        : "";

    title = labelColumn !== null
      ? `${seriesName} by ${descriptor.getHeader(labelColumn) || columnLetter(labelColumn)}`
      : seriesName;

    descriptor.dataRowIndexes.forEach((rowIndex) => {
      const value = getChartCellComputedValue(rowIndex, primaryColumn);
      if (!Number.isFinite(coerceChartNumericValue(value))) {
        return;
      }
      const nextPoint = {
        label: labelColumn !== null ? descriptor.getRowLabel(rowIndex) : `Row ${rowIndex + 1}`,
        value
      };
      if (secondaryColumn !== null) {
        const secondaryValue = getChartCellComputedValue(rowIndex, secondaryColumn);
        if (Number.isFinite(coerceChartNumericValue(secondaryValue))) {
          nextPoint.secondaryValue = secondaryValue;
        }
      }
      points.push(nextPoint);
    });

    return { title, seriesName, secondarySeriesName, points };
  };

  const buildScatterChartPoints = (descriptor = getChartSelectionDescriptor(), { bubble = false } = {}) => {
    const points = [];
    const primaryNumericColumns = descriptor.numericColumns.length ? descriptor.numericColumns : descriptor.columnIndexes;
    const useRowIndexForXAxis = primaryNumericColumns.length <= 1;
    let xColumn = useRowIndexForXAxis ? null : (primaryNumericColumns[0] ?? descriptor.minColumn);
    let yColumn = useRowIndexForXAxis
      ? (primaryNumericColumns[0] ?? descriptor.minColumn)
      : (primaryNumericColumns[1] ?? descriptor.columnIndexes.find((columnIndex) => columnIndex !== xColumn) ?? xColumn);
    if (xColumn !== null && yColumn === xColumn && descriptor.columnIndexes.length > 1) {
      yColumn = descriptor.columnIndexes.find((columnIndex) => columnIndex !== xColumn) ?? yColumn;
    }
    const sizeColumn = bubble
      ? primaryNumericColumns.find((columnIndex) => columnIndex !== xColumn && columnIndex !== yColumn) ?? null
      : null;
    const labelColumn =
      descriptor.labelColumnIndex !== null &&
      descriptor.labelColumnIndex !== xColumn &&
      descriptor.labelColumnIndex !== yColumn
        ? descriptor.labelColumnIndex
        : null;

    descriptor.dataRowIndexes.forEach((rowIndex) => {
      const xValue = xColumn === null ? rowIndex - descriptor.startRowIndex + 1 : getChartCellComputedValue(rowIndex, xColumn);
      const yValue = getChartCellComputedValue(rowIndex, yColumn);
      if (!Number.isFinite(coerceChartNumericValue(xValue)) || !Number.isFinite(coerceChartNumericValue(yValue))) {
        return;
      }
      const nextPoint = {
        label: labelColumn !== null ? descriptor.getRowLabel(rowIndex) : `Row ${rowIndex + 1}`,
        value: yValue,
        xValue,
        yValue
      };
      if (sizeColumn !== null) {
        const sizeValue = getChartCellComputedValue(rowIndex, sizeColumn);
        if (Number.isFinite(coerceChartNumericValue(sizeValue))) {
          nextPoint.sizeValue = sizeValue;
        }
      }
      points.push(nextPoint);
    });

    return {
      title:
        xColumn === null
          ? `${descriptor.getHeader(yColumn) || columnLetter(yColumn)} by row`
          : `${descriptor.getHeader(yColumn) || columnLetter(yColumn)} vs ${descriptor.getHeader(xColumn) || columnLetter(xColumn)}`,
      seriesName: descriptor.getHeader(yColumn) || `Series ${columnLetter(yColumn)}`,
      secondarySeriesName: "",
      points
    };
  };

  const buildHistogramChartPoints = (descriptor = getChartSelectionDescriptor()) => {
    const sourceValues = getPrimaryChartNumericValues(descriptor);
    if (!sourceValues.length) {
      return { title: "Histogram", seriesName: "Count", secondarySeriesName: "", points: [] };
    }
    const minValue = Math.min(...sourceValues);
    const maxValue = Math.max(...sourceValues);
    if (minValue === maxValue) {
      return {
        title: "Histogram",
        seriesName: "Count",
        secondarySeriesName: "",
        points: [{ label: formatFormulaResult(minValue), value: sourceValues.length }]
      };
    }
    const binCount = Math.max(4, Math.min(8, Math.round(Math.sqrt(sourceValues.length))));
    const step = (maxValue - minValue) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      start: minValue + (step * index),
      end: index === binCount - 1 ? maxValue : minValue + (step * (index + 1)),
      count: 0
    }));
    sourceValues.forEach((value) => {
      const rawIndex = step === 0 ? 0 : Math.floor((value - minValue) / step);
      const binIndex = Math.max(0, Math.min(binCount - 1, rawIndex));
      bins[binIndex].count += 1;
    });
    return {
      title: "Histogram",
      seriesName: "Count",
      secondarySeriesName: "",
      points: bins.map((bin) => ({
        label: `${formatFormulaResult(bin.start)}-${formatFormulaResult(bin.end)}`,
        value: bin.count
      }))
    };
  };

  const buildBoxChartPoints = (descriptor = getChartSelectionDescriptor()) => {
    const sourceValues = getPrimaryChartNumericValues(descriptor).sort((left, right) => left - right);
    if (!sourceValues.length) {
      return { title: "Box plot", seriesName: "Distribution", secondarySeriesName: "", points: [] };
    }
    const stats = [
      { label: "Min", value: sourceValues[0] },
      { label: "Q1", value: computeChartQuantile(sourceValues, 0.25) },
      { label: "Median", value: computeChartQuantile(sourceValues, 0.5) },
      { label: "Q3", value: computeChartQuantile(sourceValues, 0.75) },
      { label: "Max", value: sourceValues[sourceValues.length - 1] }
    ];
    return {
      title: "Box plot",
      seriesName: "Distribution",
      secondarySeriesName: "",
      points: stats
    };
  };

  const getGridShellScaleFactor = () => {
    if (!gridShell) {
      return 1;
    }
    const shellRect = gridShell.getBoundingClientRect();
    const layoutWidth = gridShell.offsetWidth || gridShell.clientWidth || shellRect.width || 1;
    if (!shellRect.width || !layoutWidth) {
      return 1;
    }
    const ratio = shellRect.width / layoutWidth;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  };

  const getGridElementContentRect = (element = null) => {
    if (!element || !gridShell) {
      return null;
    }
    const scale = getGridShellScaleFactor();
    const shellRect = gridShell.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    return {
      left: (elementRect.left - shellRect.left + gridShell.scrollLeft) / scale,
      top: (elementRect.top - shellRect.top + gridShell.scrollTop) / scale,
      width: elementRect.width / scale,
      height: elementRect.height / scale
    };
  };

  const getChartLayerBounds = () => {
    const columnCount = Math.max(sheetGrid[0]?.length || 0, getActiveSheetState().columns?.length || 0, 1);
    const rowCount = Math.max(sheetGrid.length || 0, (getActiveSheetState().rows?.length || 0) + 1, 1);
    const modelWidth =
      52 + Array.from({ length: columnCount }, (_, columnIndex) => getColumnWidth(columnIndex))
        .reduce((sum, width) => sum + width, 0);
    const modelHeight =
      34 + Array.from({ length: rowCount }, (_, rowIndex) => getRowHeight(rowIndex))
        .reduce((sum, height) => sum + height, 0);
    return {
      width: Math.max(table?.offsetWidth || 0, gridShell?.clientWidth || 0, gridShell?.scrollWidth || 0, modelWidth, 1),
      height: Math.max(table?.offsetHeight || 0, gridShell?.clientHeight || 0, gridShell?.scrollHeight || 0, modelHeight, 1)
    };
  };

  const clampChartFrame = (frame = {}) => {
    const bounds = getChartLayerBounds();
    const width = Math.max(280, Math.min(Number(frame.width) || 432, Math.max(280, bounds.width - 20)));
    const height = Math.max(180, Math.min(Number(frame.height) || 284, Math.max(180, bounds.height - 20)));
    return {
      x: Math.max(16, Math.min(Number(frame.x) || 16, Math.max(16, bounds.width - width - 16))),
      y: Math.max(16, Math.min(Number(frame.y) || 16, Math.max(16, bounds.height - height - 16))),
      width,
      height
    };
  };

  const getSelectionCellNode = (rowIndex = 0, columnIndex = 0) =>
    table?.querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`)?.closest("td") || null;

  const getSelectionChartFrame = (bounds = getSelectionBounds()) => {
    const existingCharts = getActiveSheetCharts();
    const defaultFrame = clampChartFrame({
      ...getDefaultSpreadsheetChartFrame(existingCharts.length),
      x: getDefaultSpreadsheetChartFrame(existingCharts.length).x + (existingCharts.length * 18),
      y: getDefaultSpreadsheetChartFrame(existingCharts.length).y + (existingCharts.length * 18)
    });
    const anchorCell = getSelectionCellNode(bounds.minRow, bounds.minColumn);
    if (!anchorCell) {
      return defaultFrame;
    }

    const anchorRect = getGridElementContentRect(anchorCell);
    const endCell = getSelectionCellNode(bounds.maxRow, bounds.maxColumn) || anchorCell;
    const endRect = getGridElementContentRect(endCell) || anchorRect;
    if (!anchorRect || !endRect) {
      return defaultFrame;
    }

    const selectionWidth = Math.max(0, (endRect.left + endRect.width) - anchorRect.left);
    const selectionHeight = Math.max(0, (endRect.top + endRect.height) - anchorRect.top);
    const width = Math.min(640, Math.max(400, 260 + (selectionWidth * 1.2)));
    const height = Math.min(380, Math.max(240, 180 + (selectionHeight * 1.4)));
    const layerBounds = getChartLayerBounds();
    let x = anchorRect.left + selectionWidth + 24;
    let y = Math.max(42, anchorRect.top - 12);
    if (x + width > layerBounds.width - 16) {
      x = Math.max(28, anchorRect.left + 12);
    }
    if (y + height > layerBounds.height - 16) {
      y = Math.max(42, anchorRect.top - 28);
    }
    return clampChartFrame({ x, y, width, height });
  };

  const buildChartPointsFromBounds = (bounds = null, chartKind = "column") => {
    const descriptor = getChartSelectionDescriptor(bounds);
    switch (normalizeSpreadsheetChartKind(chartKind)) {
      case "scatter":
        return buildScatterChartPoints(descriptor);
      case "bubble":
        return buildScatterChartPoints(descriptor, { bubble: true });
      case "histogram":
        return buildHistogramChartPoints(descriptor);
      case "box":
        return buildBoxChartPoints(descriptor);
      default:
        return buildStandardChartPoints(descriptor);
    }
  };

  const getLinkedChartSourceBounds = (chart = {}) => {
    const sourceTable = chart.sourceTableId
      ? getActiveSheetTables().find((table) => table.id === chart.sourceTableId)
      : null;
    if (sourceTable) {
      return getStructureBounds(sourceTable);
    }
    return getRangeBoundsFromAddress(resolveReferenceAddress(chart.range));
  };

  const getChartSourceTableForBounds = (bounds = {}) => {
    const normalizedBounds = normalizeSelectionBounds(bounds);
    return getActiveSheetTables().find((table) => {
      const tableBounds = getStructureBounds(table);
      return (
        normalizedBounds.minRow <= tableBounds.minRow &&
        normalizedBounds.maxRow >= tableBounds.maxRow &&
        normalizedBounds.minColumn <= tableBounds.minColumn &&
        normalizedBounds.maxColumn >= tableBounds.maxColumn
      );
    }) || null;
  };

  const materializeLinkedSpreadsheetChart = (chart = {}) => {
    const normalizedChart = normalizeSpreadsheetCharts([chart])[0] || null;
    if (!normalizedChart?.range) {
      return normalizedChart || chart;
    }
    const linkedBounds = getLinkedChartSourceBounds(normalizedChart);
    if (!linkedBounds) {
      return normalizedChart;
    }
    const linkedData = buildChartPointsFromBounds(linkedBounds, normalizedChart.kind);
    if (!linkedData.points.length) {
      return normalizedChart;
    }
    return {
      ...normalizedChart,
      title: normalizedChart.title || linkedData.title,
      seriesName: linkedData.seriesName || normalizedChart.seriesName,
      secondarySeriesName: linkedData.secondarySeriesName || normalizedChart.secondarySeriesName,
      points: linkedData.points
    };
  };

  const syncActiveSheetChartsFromLinkedRanges = () => {
    const currentSheet = getActiveSheetState();
    if (!Array.isArray(currentSheet?.charts) || !currentSheet.charts.length) {
      return;
    }
    currentSheet.charts = normalizeSpreadsheetCharts(currentSheet.charts).map((chart) =>
      materializeLinkedSpreadsheetChart(chart)
    );
  };

  const createChartFromSelection = (chartKind = "column", { promptForTitle = false } = {}) => {
    persistGridIntoActiveSheet();
    const bounds = getSelectionBounds();
    const normalizedKind = normalizeSpreadsheetChartKind(chartKind);
    const chartData = buildChartPointsFromBounds(bounds, normalizedKind);
    if (!chartData.points.length) {
      window.alert("Select at least one numeric series to create a chart.");
      return false;
    }
    let nextTitle = chartData.title;
    if (promptForTitle) {
      const titleInput = window.prompt("Chart title", chartData.title);
      if (titleInput === null) {
        return false;
      }
      nextTitle = String(titleInput || chartData.title).trim() || chartData.title;
    }
    const currentSheet = getActiveSheetState();
    const beforeSnapshot = getWorkbookSnapshot();
    const chartFrame = getSelectionChartFrame(bounds);
    const sourceTable = getChartSourceTableForBounds(bounds);
    currentSheet.charts = normalizeSpreadsheetCharts([
      ...getActiveSheetCharts(),
      {
        id: `sheet-chart-${Date.now()}`,
        title: nextTitle,
        kind: normalizedKind,
        range: getSelectionRangeAddress(),
        sourceTableId: sourceTable?.id || "",
        seriesName: String(chartData.seriesName || ""),
        secondarySeriesName: String(chartData.secondarySeriesName || ""),
        showLegend: true,
        x: chartFrame.x,
        y: chartFrame.y,
        width: chartFrame.width,
        height: chartFrame.height,
        points: chartData.points
      }
    ]);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const formatChartKindLabel = (chartKind = "column") => getSpreadsheetChartTypeConfig(chartKind)?.label || "Chart";

  const chartPalette = ["#1a73e8", "#0f9d58", "#fbbc04", "#ea4335", "#7e57c2", "#00acc1"];
  const getSpreadsheetChartLegendItems = (chart = {}) => {
    const normalizedKind = normalizeSpreadsheetChartKind(chart.kind);
    const normalizedPoints = (chart.points || []).map((point, index) => normalizeSpreadsheetChartPoint(point, index));
    const inferredPrimarySeriesName = chart.seriesName || String(chart.title || "").split(/\s+by\s+/i)[0] || "Series 1";
    if (["pie", "donut", "sunburst", "treemap", "funnel"].includes(normalizedKind)) {
      return normalizedPoints
        .slice(0, 8)
        .map((point, index) => ({
          label: point.label || `Point ${index + 1}`,
          color: chartPalette[index % chartPalette.length]
        }));
    }
    if (
      ["stacked-column", "percent-column", "stacked-bar", "percent-bar", "combo", "stacked-area"].includes(normalizedKind) &&
      normalizedPoints.some((point) => String(point.secondaryValue || "").trim().length)
    ) {
      return [
        { label: inferredPrimarySeriesName, color: chartPalette[0] },
        { label: chart.secondarySeriesName || "Series 2", color: chartPalette[1] }
      ];
    }
    return [
      {
        label: inferredPrimarySeriesName,
        color: chartPalette[0]
      }
    ];
  };
  const chartViewBox = {
    width: 260,
    height: 150,
    left: 42,
    top: 14,
    right: 246,
    bottom: 116,
    labelBottom: 134
  };
  chartViewBox.plotWidth = chartViewBox.right - chartViewBox.left;
  chartViewBox.plotHeight = chartViewBox.bottom - chartViewBox.top;

  const createChartSvgNode = (tagName = "svg", attributes = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const createChartSvgRoot = (options = {}) => {
    const svg = createChartSvgNode("svg", {
      viewBox: options.viewBox || `0 0 ${chartViewBox.width} ${chartViewBox.height}`,
      preserveAspectRatio: options.preserveAspectRatio || "none"
    });
    svg.classList.add("workspace-sheet-chart-svg");
    if (options.className) {
      svg.classList.add(options.className);
    }
    return svg;
  };

  const truncateChartLabel = (value = "", maxLength = 12) => {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}...` : text;
  };

  const appendChartText = (svg, text = "", attributes = {}) => {
    const label = createChartSvgNode("text", {
      fill: "#5f6368",
      "font-size": 7,
      "font-family": "Arial, sans-serif",
      ...attributes
    });
    label.textContent = String(text || "");
    svg.appendChild(label);
    return label;
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describePieSlice = (centerX, centerY, radius, startAngle, endAngle) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      `M ${centerX} ${centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      "Z"
    ].join(" ");
  };

  const describeDonutSlice = (centerX, centerY, outerRadius, innerRadius, startAngle, endAngle) => {
    const outerStart = polarToCartesian(centerX, centerY, outerRadius, endAngle);
    const outerEnd = polarToCartesian(centerX, centerY, outerRadius, startAngle);
    const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
    const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
      "Z"
    ].join(" ");
  };

  const createChartScale = (values = [], { includeZero = true } = {}) => {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (!finiteValues.length) {
      return { min: 0, max: 1, span: 1 };
    }
    let min = Math.min(...finiteValues);
    let max = Math.max(...finiteValues);
    if (includeZero) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (min === max) {
      if (min === 0) {
        max = 1;
      } else if (min > 0) {
        min = 0;
      } else {
        max = 0;
      }
    }
    const span = Math.max(1, max - min);
    return { min, max, span };
  };

  const mapChartY = (value = 0, scale = createChartScale()) =>
    chartViewBox.bottom - (((value - scale.min) / scale.span) * chartViewBox.plotHeight);

  const mapChartX = (value = 0, scale = createChartScale()) =>
    chartViewBox.left + (((value - scale.min) / scale.span) * chartViewBox.plotWidth);

  const createChartBaseline = (svg, scale) => {
    const baselineY = mapChartY(0, scale);
    svg.appendChild(
      createChartSvgNode("line", {
        x1: chartViewBox.left,
        y1: baselineY,
        x2: chartViewBox.right,
        y2: baselineY,
        stroke: "#dfe3e8",
        "stroke-width": 1.25
      })
    );
    return baselineY;
  };

  const buildChartGradient = (points = []) => {
    const normalizedPoints = points.filter((point) => Number.isFinite(coerceChartNumericValue(point.value)));
    if (!normalizedPoints.length) {
      return `conic-gradient(${chartPalette[0]} 0 100%)`;
    }
    const total = normalizedPoints.reduce((sum, point) => sum + Math.max(0, coerceChartNumericValue(point.value)), 0) || normalizedPoints.length;
    let cursor = 0;
    const stops = normalizedPoints.map((point, index) => {
      const weight = total === 0 ? 1 / normalizedPoints.length : Math.max(0, coerceChartNumericValue(point.value)) / total;
      const next = cursor + (weight * 100);
      const color = chartPalette[index % chartPalette.length];
      const stop = `${color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
      cursor = next;
      return stop;
    });
    if (cursor < 100) {
      stops.push(`${chartPalette[0]} ${cursor.toFixed(2)}% 100%`);
    }
    return `conic-gradient(${stops.join(", ")})`;
  };

  const getChartPreviewModel = (chartKind = "column") => {
    const kind = normalizeSpreadsheetChartKind(chartKind);
    switch (kind) {
      case "scatter":
        return {
          kind,
          points: [
            { label: "A", xValue: 2, yValue: 8, value: 8 },
            { label: "B", xValue: 4, yValue: 6, value: 6 },
            { label: "C", xValue: 7, yValue: 10, value: 10 },
            { label: "D", xValue: 9, yValue: 5, value: 5 }
          ]
        };
      case "bubble":
        return {
          kind,
          points: [
            { label: "A", xValue: 2, yValue: 8, sizeValue: 12, value: 8 },
            { label: "B", xValue: 5, yValue: 5, sizeValue: 20, value: 5 },
            { label: "C", xValue: 8, yValue: 9, sizeValue: 10, value: 9 }
          ]
        };
      case "combo":
      case "stacked-column":
      case "percent-column":
      case "stacked-bar":
      case "percent-bar":
      case "stacked-area":
        return {
          kind,
          points: [
            { label: "Q1", value: 16, secondaryValue: 10 },
            { label: "Q2", value: 14, secondaryValue: 12 },
            { label: "Q3", value: 20, secondaryValue: 8 },
            { label: "Q4", value: 18, secondaryValue: 14 }
          ]
        };
      case "pie":
      case "donut":
      case "sunburst":
      case "treemap":
      case "funnel":
        return {
          kind,
          points: [
            { label: "North", value: 34 },
            { label: "South", value: 22 },
            { label: "West", value: 18 },
            { label: "East", value: 14 }
          ]
        };
      case "histogram":
        return {
          kind,
          points: [
            { label: "0-10", value: 2 },
            { label: "10-20", value: 5 },
            { label: "20-30", value: 7 },
            { label: "30-40", value: 4 },
            { label: "40-50", value: 2 }
          ]
        };
      case "box":
        return {
          kind,
          points: [
            { label: "Min", value: 8 },
            { label: "Q1", value: 16 },
            { label: "Median", value: 22 },
            { label: "Q3", value: 31 },
            { label: "Max", value: 38 }
          ]
        };
      case "waterfall":
        return {
          kind,
          points: [
            { label: "Start", value: 12 },
            { label: "Loss", value: -5 },
            { label: "Gain", value: 10 },
            { label: "Cost", value: -3 },
            { label: "Close", value: 7 }
          ]
        };
      case "radar":
        return {
          kind,
          points: [
            { label: "A", value: 7 },
            { label: "B", value: 4 },
            { label: "C", value: 9 },
            { label: "D", value: 6 },
            { label: "E", value: 8 }
          ]
        };
      default:
        return {
          kind,
          points: [
            { label: "Jan", value: 10 },
            { label: "Feb", value: 16 },
            { label: "Mar", value: 13 },
            { label: "Apr", value: 20 },
            { label: "May", value: 15 }
          ]
        };
    }
  };

  const renderSpreadsheetChartGraphic = (chart = {}, { preview = false } = {}) => {
    const normalizedKind = normalizeSpreadsheetChartKind(chart.kind);
    const primaryPoints = (chart.points || []).map((point, index) => ({
      index,
      ...normalizeSpreadsheetChartPoint(point, index),
      numericValue: coerceChartNumericValue(point.value),
      secondaryNumericValue: coerceChartNumericValue(point.secondaryValue),
      xNumericValue: coerceChartNumericValue(point.xValue),
      yNumericValue: coerceChartNumericValue(point.yValue || point.value),
      sizeNumericValue: coerceChartNumericValue(point.sizeValue)
    }));
    const finitePrimaryPoints = primaryPoints.filter((point) => Number.isFinite(point.numericValue));
    const hasSecondarySeries = primaryPoints.some((point) => Number.isFinite(point.secondaryNumericValue));

    if (["pie", "donut", "sunburst"].includes(normalizedKind)) {
      const polarSvg = createChartSvgRoot({
        viewBox: "0 0 120 120",
        preserveAspectRatio: "xMidYMid meet",
        className: "is-polar"
      });
      const positivePoints = finitePrimaryPoints.filter((point) => Math.max(0, point.numericValue) > 0);
      const slicePoints = positivePoints.length ? positivePoints : finitePrimaryPoints.slice(0, 1);
      const total = slicePoints.reduce((sum, point) => sum + Math.max(0, point.numericValue), 0) || slicePoints.length || 1;
      let cursor = 0;
      slicePoints.forEach((point, index) => {
        const weight = positivePoints.length ? Math.max(0, point.numericValue) / total : 1 / slicePoints.length;
        const nextCursor = cursor + (weight * 360);
        const path = createChartSvgNode("path", {
          d:
            normalizedKind === "pie"
              ? describePieSlice(60, 60, 44, cursor, nextCursor)
              : describeDonutSlice(60, 60, 44, normalizedKind === "sunburst" ? 24 : 25, cursor, nextCursor),
          fill: chartPalette[index % chartPalette.length],
          stroke: "#ffffff",
          "stroke-width": 0.75
        });
        const title = createChartSvgNode("title");
        title.textContent = `${point.label || `Point ${index + 1}`}: ${formatFormulaResult(point.numericValue)}`;
        path.appendChild(title);
        polarSvg.appendChild(path);
        if (normalizedKind === "sunburst") {
          polarSvg.appendChild(
            createChartSvgNode("path", {
              d: describeDonutSlice(60, 60, 22, 11, cursor, nextCursor),
              fill: chartPalette[(index + 2) % chartPalette.length],
              opacity: 0.82,
              stroke: "#ffffff",
              "stroke-width": 0.75
            })
          );
        }
        cursor = nextCursor;
      });
      if (normalizedKind === "donut") {
        polarSvg.appendChild(
          createChartSvgNode("circle", {
            cx: 60,
            cy: 60,
            r: 24,
            fill: "#ffffff"
          })
        );
      }
      return polarSvg;
    }

    if (normalizedKind === "treemap") {
      const tree = document.createElement("div");
      tree.className = "workspace-sheet-chart-treemap";
      const total = finitePrimaryPoints.reduce((sum, point) => sum + Math.max(0, point.numericValue), 0) || finitePrimaryPoints.length || 1;
      finitePrimaryPoints.slice(0, 6).forEach((point, index) => {
        const tile = document.createElement("div");
        tile.className = "workspace-sheet-chart-treemap-tile";
        tile.style.background = chartPalette[index % chartPalette.length];
        tile.style.flex = `${Math.max(1, point.numericValue)} 1 0`;
        tile.style.opacity = `${0.72 + (((Math.max(0, point.numericValue) / total) * 0.28).toFixed(2))}`;
        tile.title = point.label || `Point ${index + 1}`;
        tree.appendChild(tile);
      });
      return tree;
    }

    if (normalizedKind === "funnel") {
      const funnel = document.createElement("div");
      funnel.className = "workspace-sheet-chart-funnel";
      const maxValue = Math.max(...finitePrimaryPoints.map((point) => point.numericValue), 1);
      finitePrimaryPoints.slice(0, 5).forEach((point, index) => {
        const step = document.createElement("div");
        step.className = "workspace-sheet-chart-funnel-step";
        step.style.width = `${Math.max(26, (point.numericValue / maxValue) * 100)}%`;
        step.style.background = chartPalette[index % chartPalette.length];
        funnel.appendChild(step);
      });
      return funnel;
    }

    const svg = createChartSvgRoot();

    if (["scatter", "bubble"].includes(normalizedKind)) {
      const scatterPoints = primaryPoints.filter(
        (point) => Number.isFinite(point.xNumericValue) && Number.isFinite(point.yNumericValue)
      );
      const xScale = createChartScale(scatterPoints.map((point) => point.xNumericValue), { includeZero: false });
      const yScale = createChartScale(scatterPoints.map((point) => point.yNumericValue), { includeZero: false });
      svg.appendChild(
        createChartSvgNode("line", {
          x1: chartViewBox.left,
          y1: chartViewBox.bottom,
          x2: chartViewBox.right,
          y2: chartViewBox.bottom,
          stroke: "#dfe3e8",
          "stroke-width": 1.25
        })
      );
      svg.appendChild(
        createChartSvgNode("line", {
          x1: chartViewBox.left,
          y1: chartViewBox.top,
          x2: chartViewBox.left,
          y2: chartViewBox.bottom,
          stroke: "#dfe3e8",
          "stroke-width": 1.25
        })
      );
      const maxSize = Math.max(...scatterPoints.map((point) => point.sizeNumericValue).filter((value) => Number.isFinite(value)), 1);
      scatterPoints.forEach((point, index) => {
        svg.appendChild(
          createChartSvgNode("circle", {
            cx: mapChartX(point.xNumericValue, xScale),
            cy: mapChartY(point.yNumericValue, yScale),
            r:
              normalizedKind === "bubble"
                ? Math.max(4, (Math.max(1, point.sizeNumericValue) / maxSize) * 16)
                : 4.2,
            fill: chartPalette[index % chartPalette.length],
            opacity: normalizedKind === "bubble" ? 0.75 : 0.9,
            stroke: "#ffffff",
            "stroke-width": 1.5
          })
        );
      });
      return svg;
    }

    if (normalizedKind === "radar") {
      const radarPoints = finitePrimaryPoints.slice(0, 6);
      const maxValue = Math.max(...radarPoints.map((point) => point.numericValue), 1);
      const centerX = 110;
      const centerY = 55;
      const radius = 38;
      for (let level = 1; level <= 4; level += 1) {
        const ring = [];
        radarPoints.forEach((_, index) => {
          const angle = ((Math.PI * 2) / Math.max(3, radarPoints.length)) * index - (Math.PI / 2);
          const currentRadius = (radius * level) / 4;
          ring.push(`${centerX + (Math.cos(angle) * currentRadius)},${centerY + (Math.sin(angle) * currentRadius)}`);
        });
        svg.appendChild(
          createChartSvgNode("polygon", {
            points: ring.join(" "),
            fill: "none",
            stroke: "#e5e7eb",
            "stroke-width": 1
          })
        );
      }
      const polygonPoints = radarPoints.map((point, index) => {
        const angle = ((Math.PI * 2) / Math.max(3, radarPoints.length)) * index - (Math.PI / 2);
        const pointRadius = (Math.max(0, point.numericValue) / maxValue) * radius;
        return `${centerX + (Math.cos(angle) * pointRadius)},${centerY + (Math.sin(angle) * pointRadius)}`;
      });
      svg.appendChild(
        createChartSvgNode("polygon", {
          points: polygonPoints.join(" "),
          fill: "rgba(26, 115, 232, 0.18)",
          stroke: "#1a73e8",
          "stroke-width": 2
        })
      );
      return svg;
    }

    if (normalizedKind === "box") {
      const boxValues = finitePrimaryPoints.slice(0, 5).map((point) => point.numericValue);
      const scale = createChartScale(boxValues, { includeZero: false });
      const [minValue = 0, q1Value = 0, medianValue = 0, q3Value = 0, maxValue = 0] = boxValues;
      const centerY = 56;
      svg.appendChild(
        createChartSvgNode("line", {
          x1: mapChartX(minValue, scale),
          y1: centerY,
          x2: mapChartX(maxValue, scale),
          y2: centerY,
          stroke: "#9aa0a6",
          "stroke-width": 2
        })
      );
      svg.appendChild(
        createChartSvgNode("rect", {
          x: mapChartX(q1Value, scale),
          y: centerY - 18,
          width: Math.max(8, mapChartX(q3Value, scale) - mapChartX(q1Value, scale)),
          height: 36,
          fill: "rgba(26, 115, 232, 0.18)",
          stroke: "#1a73e8",
          "stroke-width": 2
        })
      );
      ["minValue", "medianValue", "maxValue"].forEach((key) => {
        const numericValue = ({ minValue, medianValue, maxValue })[key];
        svg.appendChild(
          createChartSvgNode("line", {
            x1: mapChartX(numericValue, scale),
            y1: centerY - 24,
            x2: mapChartX(numericValue, scale),
            y2: centerY + 24,
            stroke: key === "medianValue" ? "#0f9d58" : "#9aa0a6",
            "stroke-width": key === "medianValue" ? 3 : 2
          })
        );
      });
      return svg;
    }

    if (normalizedKind === "waterfall") {
      const steps = finitePrimaryPoints.map((point) => point.numericValue);
      let runningTotal = 0;
      const segments = steps.map((value) => {
        const start = runningTotal;
        runningTotal += value;
        return { start, end: runningTotal, delta: value };
      });
      const scale = createChartScale(
        [0, ...segments.flatMap((segment) => [segment.start, segment.end])],
        { includeZero: true }
      );
      const baselineY = createChartBaseline(svg, scale);
      const slotWidth = chartViewBox.plotWidth / Math.max(1, segments.length);
      segments.forEach((segment, index) => {
        const x = chartViewBox.left + (slotWidth * index) + (slotWidth * 0.18);
        const width = Math.max(10, slotWidth * 0.64);
        const y = Math.min(mapChartY(segment.start, scale), mapChartY(segment.end, scale));
        const height = Math.max(4, Math.abs(mapChartY(segment.end, scale) - mapChartY(segment.start, scale)));
        svg.appendChild(
          createChartSvgNode("rect", {
            x,
            y,
            width,
            height,
            rx: 4,
            fill: segment.delta >= 0 ? "#1a73e8" : "#ea4335"
          })
        );
        if (index < segments.length - 1) {
          svg.appendChild(
            createChartSvgNode("line", {
              x1: x + width,
              y1: mapChartY(segment.end, scale),
              x2: x + slotWidth,
              y2: mapChartY(segment.end, scale),
              stroke: "#9aa0a6",
              "stroke-dasharray": "3 3",
              "stroke-width": 1.25
            })
          );
        }
      });
      return svg;
    }

    const renderColumnFamily = (options = {}) => {
      const scaleValues = [];
      const showLabels = !preview;
      if (options.waterfall) {
        return svg;
      }
      if (options.stacked && hasSecondarySeries) {
        finitePrimaryPoints.forEach((point) => scaleValues.push(point.numericValue + Math.max(0, point.secondaryNumericValue || 0)));
      } else {
        finitePrimaryPoints.forEach((point) => scaleValues.push(point.numericValue));
        if (options.combo && hasSecondarySeries) {
          primaryPoints.forEach((point) => {
            if (Number.isFinite(point.secondaryNumericValue)) {
              scaleValues.push(point.secondaryNumericValue);
            }
          });
        }
      }
      const scale = createChartScale(
        options.percent ? [0, 100] : scaleValues,
        { includeZero: true }
      );
      const baselineY = createChartBaseline(svg, scale);
      const slotWidth = chartViewBox.plotWidth / Math.max(1, finitePrimaryPoints.length || 1);
      finitePrimaryPoints.forEach((point, index) => {
        const x = chartViewBox.left + (slotWidth * index) + (slotWidth * 0.18);
        const width = Math.max(10, slotWidth * 0.64);
        const centerX = x + (width / 2);
        const primaryValue = Math.max(0, point.numericValue);
        const secondaryValue = Number.isFinite(point.secondaryNumericValue) ? Math.max(0, point.secondaryNumericValue) : 0;
        if (options.stacked && hasSecondarySeries) {
          const totalValue = options.percent && primaryValue + secondaryValue > 0
            ? 100
            : primaryValue + secondaryValue;
          const normalizedPrimary = options.percent && totalValue > 0 ? (primaryValue / (primaryValue + secondaryValue || 1)) * 100 : primaryValue;
          const normalizedSecondary = options.percent && totalValue > 0 ? (secondaryValue / (primaryValue + secondaryValue || 1)) * 100 : secondaryValue;
          const totalY = mapChartY(normalizedPrimary + normalizedSecondary, scale);
          const primaryY = mapChartY(normalizedPrimary, scale);
          svg.appendChild(
            createChartSvgNode("rect", {
              x,
              y: primaryY,
              width,
              height: Math.max(4, baselineY - primaryY),
              rx: 4,
              fill: chartPalette[0]
            })
          );
          svg.appendChild(
            createChartSvgNode("rect", {
              x,
              y: totalY,
              width,
              height: Math.max(4, primaryY - totalY),
              rx: 4,
              fill: chartPalette[1]
            })
          );
          if (showLabels) {
            appendChartText(svg, formatFormulaResult(normalizedPrimary + normalizedSecondary), {
              x: centerX,
              y: Math.max(chartViewBox.top + 7, totalY - 4),
              "text-anchor": "middle",
              "font-size": 6.5,
              "font-weight": 600
            });
            appendChartText(svg, truncateChartLabel(point.label, 10), {
              x: centerX,
              y: chartViewBox.labelBottom,
              "text-anchor": "middle",
              "font-size": 6.2
            });
          }
          return;
        }
        const barTop = mapChartY(point.numericValue, scale);
        svg.appendChild(
          createChartSvgNode("rect", {
            x,
            y: Math.min(barTop, baselineY),
            width,
            height: Math.max(4, Math.abs(baselineY - barTop)),
            rx: 4,
            fill: chartPalette[index % chartPalette.length]
          })
        );
        if (showLabels) {
          appendChartText(svg, formatFormulaResult(point.numericValue), {
            x: centerX,
            y: point.numericValue >= 0
              ? Math.max(chartViewBox.top + 7, Math.min(barTop, baselineY) - 4)
              : Math.min(chartViewBox.bottom - 4, Math.max(barTop, baselineY) + 10),
            "text-anchor": "middle",
            "font-size": 6.5,
            "font-weight": 600
          });
          appendChartText(svg, truncateChartLabel(point.label, 10), {
            x: centerX,
            y: chartViewBox.labelBottom,
            "text-anchor": "middle",
            "font-size": 6.2
          });
        }
      });
      if (options.combo) {
        const lineSeries = primaryPoints.filter((point) => Number.isFinite(point.secondaryNumericValue));
        const polylinePoints = lineSeries.map((point) => {
          const slotWidth = chartViewBox.plotWidth / Math.max(1, lineSeries.length);
          const x = chartViewBox.left + (slotWidth * point.index) + (slotWidth / 2);
          const y = mapChartY(point.secondaryNumericValue, scale);
          return `${x},${y}`;
        });
        svg.appendChild(
          createChartSvgNode("polyline", {
            points: polylinePoints.join(" "),
            fill: "none",
            stroke: "#0f9d58",
            "stroke-width": 2.5,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          })
        );
      }
      return svg;
    };

    const renderBarFamily = (options = {}) => {
      const scaleValues = [];
      const showLabels = !preview;
      if (options.stacked && hasSecondarySeries) {
        finitePrimaryPoints.forEach((point) => scaleValues.push(point.numericValue + Math.max(0, point.secondaryNumericValue || 0)));
      } else {
        finitePrimaryPoints.forEach((point) => scaleValues.push(point.numericValue));
      }
      const scale = createChartScale(options.percent ? [0, 100] : scaleValues, { includeZero: true });
      const slotHeight = chartViewBox.plotHeight / Math.max(1, finitePrimaryPoints.length || 1);
      svg.appendChild(
        createChartSvgNode("line", {
          x1: chartViewBox.left,
          y1: chartViewBox.bottom,
          x2: chartViewBox.left,
          y2: chartViewBox.top,
          stroke: "#dfe3e8",
          "stroke-width": 1.25
        })
      );
      finitePrimaryPoints.forEach((point, index) => {
        const y = chartViewBox.top + (slotHeight * index) + (slotHeight * 0.18);
        const height = Math.max(10, slotHeight * 0.64);
        const middleY = y + (height / 2) + 2;
        const primaryValue = Math.max(0, point.numericValue);
        const secondaryValue = Number.isFinite(point.secondaryNumericValue) ? Math.max(0, point.secondaryNumericValue) : 0;
        if (options.stacked && hasSecondarySeries) {
          const total = primaryValue + secondaryValue || 1;
          const normalizedPrimary = options.percent ? (primaryValue / total) * 100 : primaryValue;
          const normalizedSecondary = options.percent ? (secondaryValue / total) * 100 : secondaryValue;
          const primaryWidth = Math.max(6, ((normalizedPrimary - scale.min) / scale.span) * chartViewBox.plotWidth);
          const secondaryWidth = Math.max(6, ((normalizedSecondary - scale.min) / scale.span) * chartViewBox.plotWidth);
          svg.appendChild(
            createChartSvgNode("rect", {
              x: chartViewBox.left,
              y,
              width: primaryWidth,
              height,
              rx: 4,
              fill: chartPalette[0]
            })
          );
          svg.appendChild(
            createChartSvgNode("rect", {
              x: chartViewBox.left + primaryWidth,
              y,
              width: secondaryWidth,
              height,
              rx: 4,
              fill: chartPalette[1]
            })
          );
          if (showLabels) {
            appendChartText(svg, truncateChartLabel(point.label, 9), {
              x: chartViewBox.left - 5,
              y: middleY,
              "text-anchor": "end",
              "font-size": 6.2
            });
            appendChartText(svg, formatFormulaResult(normalizedPrimary + normalizedSecondary), {
              x: Math.min(chartViewBox.right - 2, chartViewBox.left + primaryWidth + secondaryWidth + 4),
              y: middleY,
              "text-anchor": "start",
              "font-size": 6.5,
              "font-weight": 600
            });
          }
          return;
        }
        const barWidth = Math.max(6, ((point.numericValue - scale.min) / scale.span) * chartViewBox.plotWidth);
        svg.appendChild(
          createChartSvgNode("rect", {
            x: chartViewBox.left,
            y,
            width: barWidth,
            height,
            rx: 4,
            fill: chartPalette[index % chartPalette.length]
          })
        );
        if (showLabels) {
          appendChartText(svg, truncateChartLabel(point.label, 9), {
            x: chartViewBox.left - 5,
            y: middleY,
            "text-anchor": "end",
            "font-size": 6.2
          });
          appendChartText(svg, formatFormulaResult(point.numericValue), {
            x: Math.min(chartViewBox.right - 2, chartViewBox.left + barWidth + 4),
            y: middleY,
            "text-anchor": "start",
            "font-size": 6.5,
            "font-weight": 600
          });
        }
      });
      return svg;
    };

    const renderLineFamily = (options = {}) => {
      const linePoints = finitePrimaryPoints;
      const scale = createChartScale(linePoints.map((point) => point.numericValue), { includeZero: true });
      createChartBaseline(svg, scale);
      const polylinePoints = linePoints.map((point, index) => {
        const x = linePoints.length === 1
          ? chartViewBox.left + (chartViewBox.plotWidth / 2)
          : chartViewBox.left + ((index / Math.max(1, linePoints.length - 1)) * chartViewBox.plotWidth);
        const y = mapChartY(point.numericValue, scale);
        return `${x},${y}`;
      });
      if (options.fillArea) {
        const areaPoints = [
          `${chartViewBox.left},${chartViewBox.bottom}`,
          ...polylinePoints,
          `${chartViewBox.right},${chartViewBox.bottom}`
        ];
        svg.appendChild(
          createChartSvgNode("polygon", {
            points: areaPoints.join(" "),
            fill: "rgba(26, 115, 232, 0.18)"
          })
        );
      }
      svg.appendChild(
        createChartSvgNode("polyline", {
          points: polylinePoints.join(" "),
          fill: "none",
          stroke: "#1a73e8",
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        })
      );
      if (options.showMarkers) {
        polylinePoints.forEach((coords) => {
          const [x, y] = coords.split(",");
          svg.appendChild(
            createChartSvgNode("circle", {
              cx: x,
              cy: y,
              r: 4,
              fill: "#ffffff",
              stroke: "#1a73e8",
              "stroke-width": 2
            })
          );
        });
      }
      return svg;
    };

    switch (normalizedKind) {
      case "line":
        return renderLineFamily();
      case "line-markers":
        return renderLineFamily({ showMarkers: true });
      case "area":
        return renderLineFamily({ fillArea: true });
      case "stacked-area":
        return hasSecondarySeries ? renderColumnFamily({ stacked: true }) : renderLineFamily({ fillArea: true });
      case "combo":
        return renderColumnFamily({ combo: true });
      case "stacked-column":
        return renderColumnFamily({ stacked: true });
      case "percent-column":
        return renderColumnFamily({ stacked: true, percent: true });
      case "bar":
        return renderBarFamily();
      case "stacked-bar":
        return renderBarFamily({ stacked: true });
      case "percent-bar":
        return renderBarFamily({ stacked: true, percent: true });
      case "histogram":
        return renderColumnFamily();
      default:
        return renderColumnFamily();
    }
  };

  const removeActiveSheetChart = (chartId = "") => {
    const nextCharts = getActiveSheetCharts().filter((chart) => chart.id !== chartId);
    if (nextCharts.length === getActiveSheetCharts().length) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const nextSheets = workbookModel.sheets.map((sheet) =>
      sheet.id === workbookModel.activeSheetId
        ? { ...sheet, charts: normalizeSpreadsheetCharts(nextCharts) }
        : sheet
    );
    workbookModel = normalizeSpreadsheetPreviewModel(
      {
        ...workbookModel,
        sheets: nextSheets
      },
      {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      }
    );
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const updateActiveSheetChart = (chartId = "", updater = null, { rerender = true } = {}) => {
    if (!chartId || typeof updater !== "function") {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    let didChange = false;
    const nextCharts = getActiveSheetCharts().map((chart) => {
      if (chart.id !== chartId) {
        return chart;
      }
      const nextChart = updater({ ...chart });
      if (!nextChart || typeof nextChart !== "object") {
        return chart;
      }
      didChange = true;
      return normalizeSpreadsheetCharts([{ ...chart, ...nextChart }])[0];
    });
    if (!didChange) {
      return false;
    }
    const nextSheets = workbookModel.sheets.map((sheet) =>
      sheet.id === workbookModel.activeSheetId
        ? { ...sheet, charts: normalizeSpreadsheetCharts(nextCharts) }
        : sheet
    );
    workbookModel = normalizeSpreadsheetPreviewModel(
      {
        ...workbookModel,
        sheets: nextSheets
      },
      {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      }
    );
    persistWorkbookState(false, { beforeSnapshot });
    if (rerender) {
      rerenderPreview({ persistGrid: false });
    }
    return true;
  };

  const updateActiveSheetChartFrameModel = (chartId = "", frame = {}, { syncDraft = false } = {}) => {
    if (!chartId) {
      return null;
    }
    if (!chartFrameBeforeSnapshot) {
      chartFrameBeforeSnapshot = getWorkbookSnapshot();
    }
    const nextFrame = clampChartFrame(frame);
    const currentSheet = getActiveSheetState();
    const sourceCharts = Array.isArray(currentSheet.charts) ? currentSheet.charts : [];
    let didUpdate = false;
    currentSheet.charts = sourceCharts.map((chart) => {
      if (chart.id !== chartId) {
        return chart;
      }
      didUpdate = true;
      return {
        ...chart,
        ...nextFrame
      };
    });
    if (!didUpdate) {
      return null;
    }
    if (syncDraft) {
      scheduleChartFrameDraftSync();
    }
    return nextFrame;
  };

  const commitActiveSheetChartFrame = (chartId = "", card = null, frame = {}) => {
    if (!chartId || !card) {
      return false;
    }
    const nextFrame = updateActiveSheetChartFrameModel(chartId, frame);
    if (!nextFrame) {
      return false;
    }
    card.style.left = `${nextFrame.x}px`;
    card.style.top = `${nextFrame.y}px`;
    card.style.width = `${nextFrame.width}px`;
    card.style.height = `${nextFrame.height}px`;
    card.dataset.chartX = String(nextFrame.x);
    card.dataset.chartY = String(nextFrame.y);
    card.dataset.chartWidth = String(nextFrame.width);
    card.dataset.chartHeight = String(nextFrame.height);
    scheduleChartFramePersist();
    return true;
  };

  const buildUniqueTableName = (baseName = "Table", { ignoreId = "" } = {}) => {
    const usedNames = new Set(
      workbookModel.sheets.flatMap((sheet) =>
        normalizeSpreadsheetTables(sheet.tables)
          .filter((table) => !ignoreId || table.id !== ignoreId)
          .map((table) => table.name.toLowerCase())
      )
    );
    const normalizedBase = normalizeSpreadsheetTableName(baseName);
    let candidate = normalizedBase || "Table";
    let suffix = 1;
    while (usedNames.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${normalizedBase || "Table"}${suffix}`;
    }
    return candidate;
  };

  const getTableHeaderNames = (sourceSheet = getActiveSheetState(), bounds = getSelectionBounds()) => {
    const normalizedBounds = normalizeSelectionBounds(bounds);
    const seen = new Map();
    return Array.from({ length: normalizedBounds.maxColumn - normalizedBounds.minColumn + 1 }, (_, offset) => {
      const columnIndex = normalizedBounds.minColumn + offset;
      const rawName = getSheetCellValue(sourceSheet, normalizedBounds.minRow, columnIndex, { evaluated: false });
      const baseName = String(rawName || `Column ${offset + 1}`).trim() || `Column ${offset + 1}`;
      const count = seen.get(baseName.toLowerCase()) || 0;
      seen.set(baseName.toLowerCase(), count + 1);
      return count ? `${baseName} ${count + 1}` : baseName;
    });
  };

  const getSelectedTableBounds = () => {
    const bounds = getDataSelectionBounds({ preferTable: true, skipHeader: false });
    if (bounds.maxRow <= bounds.minRow) {
      return null;
    }
    return bounds;
  };

  const createTableFromSelection = () => {
    persistGridIntoActiveSheet();
    const bounds = getSelectedTableBounds();
    if (!bounds) {
      window.alert("Select a range with headers and at least one data row to create a table.");
      return false;
    }
    if (!ensureEditableBounds(bounds, "create a table")) {
      return false;
    }
    const currentSheet = getActiveSheetState();
    const existingOverlap = getActiveSheetTables().find((table) => boundsIntersect(getStructureBounds(table), bounds));
    if (existingOverlap) {
      window.alert(`This range overlaps ${existingOverlap.name}. Remove or resize that table first.`);
      return false;
    }
    const beforeSnapshot = getWorkbookSnapshot();
    const tableName = buildUniqueTableName("Table");
    currentSheet.tables = normalizeSpreadsheetTables([
      ...getActiveSheetTables(),
      {
        id: `sheet-table-${Date.now()}`,
        name: tableName,
        startRowIndex: bounds.minRow,
        endRowIndex: bounds.maxRow,
        startColumnIndex: bounds.minColumn,
        endColumnIndex: bounds.maxColumn,
        style: "blue",
        showHeaderRow: true,
        showBandedRows: true,
        showFilterButtons: true,
        showTotalRow: false
      }
    ]);
    setSelectionRange({
      startRowIndex: bounds.minRow,
      startColumnIndex: bounds.minColumn,
      endRowIndex: bounds.maxRow,
      endColumnIndex: bounds.maxColumn
    });
    activeSelection = { rowIndex: bounds.minRow, columnIndex: bounds.minColumn };
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const removeActiveTable = () => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    currentSheet.tables = getActiveSheetTables().filter((table) => table.id !== activeTable.id);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const mutateActiveTable = (mutator, { refresh = "grid" } = {}) => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return null;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    let nextActiveTable = null;
    let cancelled = false;
    currentSheet.tables = normalizeSpreadsheetTables(
      getActiveSheetTables().map((table) => {
        if (table.id !== activeTable.id) {
          return table;
        }
        const nextTable = mutator({ ...table });
        if (nextTable === false) {
          cancelled = true;
          return table;
        }
        nextActiveTable = normalizeSpreadsheetTable(nextTable || table);
        return nextActiveTable;
      })
    );
    if (cancelled || !nextActiveTable) {
      return null;
    }
    commitModel(false, { beforeSnapshot });
    if (refresh === "preview") {
      rerenderPreview({ persistGrid: false });
    } else {
      refreshGridValues({ preserveActiveEditor: false });
    }
    return nextActiveTable;
  };

  const renameActiveTable = () => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    const nextName = window.prompt("Table name", activeTable.name);
    if (!nextName) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    let renamedTable = null;
    currentSheet.tables = normalizeSpreadsheetTables(
      getActiveSheetTables().map((table) => {
        if (table.id !== activeTable.id) {
          return table;
        }
        renamedTable = {
          ...table,
          name: buildUniqueTableName(nextName, { ignoreId: activeTable.id })
        };
        return renamedTable;
      })
    );
    if (renamedTable?.showTotalRow) {
      writeTableTotalRowValues(renamedTable);
    }
    commitModel(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const setActiveTableStyle = (style = "blue") => {
    const nextTable = mutateActiveTable((table) => ({ ...table, style }));
    return Boolean(nextTable);
  };

  const toggleActiveTableBandedRows = () => {
    const nextTable = mutateActiveTable((table) => ({ ...table, showBandedRows: !table.showBandedRows }));
    return Boolean(nextTable);
  };

  const toggleActiveTableBandedColumns = () => {
    const nextTable = mutateActiveTable((table) => ({ ...table, showBandedColumns: !table.showBandedColumns }));
    return Boolean(nextTable);
  };

  const toggleActiveTableFirstColumn = () => {
    const nextTable = mutateActiveTable((table) => ({ ...table, showFirstColumn: !table.showFirstColumn }));
    return Boolean(nextTable);
  };

  const toggleActiveTableLastColumn = () => {
    const nextTable = mutateActiveTable((table) => ({ ...table, showLastColumn: !table.showLastColumn }));
    return Boolean(nextTable);
  };

  const toggleActiveTableHeaderRow = () => {
    const nextTable = mutateActiveTable(
      (table) => ({ ...table, showHeaderRow: table.showHeaderRow === false }),
      { refresh: "preview" }
    );
    return Boolean(nextTable);
  };

  const toggleActiveTableFilterButtons = () => {
    const nextTable = mutateActiveTable(
      (table) => ({ ...table, showFilterButtons: !table.showFilterButtons }),
      { refresh: "preview" }
    );
    return Boolean(nextTable);
  };

  const toggleActiveTableTotalRow = () => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    let cancelled = false;
    currentSheet.tables = normalizeSpreadsheetTables(
      getActiveSheetTables().map((table) => {
        if (table.id !== activeTable.id) {
          return table;
        }
        const nextTable = buildTableWithTotalRowVisibility(table, !table.showTotalRow);
        if (nextTable === false) {
          cancelled = true;
          return table;
        }
        return nextTable;
      })
    );
    if (cancelled) {
      return false;
    }
    commitModel(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const setTableColumnTotalFunction = (targetTable = null, columnIndex = 0, functionName = "sum") => {
    if (!targetTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    const bounds = getStructureBounds(targetTable);
    if (columnIndex <= bounds.minColumn || columnIndex > bounds.maxColumn) {
      window.alert("Select a value column in the table first.");
      return false;
    }
    const normalizedFunction = normalizeTableTotalFunction(functionName);
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    let cancelled = false;
    currentSheet.tables = normalizeSpreadsheetTables(
      getActiveSheetTables().map((table) => {
        if (table.id !== targetTable.id) {
          return table;
        }
        let nextTable = buildTableWithTotalRowVisibility(table, true);
        if (nextTable === false) {
          cancelled = true;
          return table;
        }
        nextTable = {
          ...nextTable,
          totalFunctions: {
            ...buildTableDefaultTotalFunctions(nextTable),
            [String(columnIndex)]: normalizedFunction
          }
        };
        writeTableTotalRowValues(nextTable);
        return nextTable;
      })
    );
    if (cancelled) {
      return false;
    }
    commitModel(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const setActiveTableTotalFunction = (functionName = "sum") =>
    setTableColumnTotalFunction(getActiveTableForSelection(), activeSelection.columnIndex, functionName);

  const resizeActiveTable = () => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    const currentBounds = getStructureBounds(activeTable);
    const rangeText = window.prompt("Resize table range", formatBoundsAddress(currentBounds));
    if (!rangeText) {
      return false;
    }
    const nextBounds = getRangeBoundsFromAddress(rangeText);
    if (!nextBounds) {
      window.alert("Use a valid range like A1:D10.");
      return false;
    }
    const minimumRows = 1 + (activeTable.showHeaderRow === false ? 0 : 1) + (activeTable.showTotalRow ? 1 : 0);
    if (nextBounds.maxRow - nextBounds.minRow + 1 < minimumRows) {
      window.alert("The table needs room for headers, data and totals.");
      return false;
    }
    const overlap = getActiveSheetTables().find(
      (table) => table.id !== activeTable.id && boundsIntersect(getStructureBounds(table), nextBounds)
    );
    if (overlap) {
      window.alert(`This range overlaps ${overlap.name}.`);
      return false;
    }
    if (!ensureEditableBounds(nextBounds, "resize the table")) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    let resizedTable = null;
    currentSheet.tables = normalizeSpreadsheetTables(
      getActiveSheetTables().map((table) => {
        if (table.id !== activeTable.id) {
          return table;
        }
        resizedTable = {
          ...table,
          startRowIndex: nextBounds.minRow,
          endRowIndex: nextBounds.maxRow,
          startColumnIndex: nextBounds.minColumn,
          endColumnIndex: nextBounds.maxColumn,
          totalFunctions: buildTableDefaultTotalFunctions({
            ...table,
            startRowIndex: nextBounds.minRow,
            endRowIndex: nextBounds.maxRow,
            startColumnIndex: nextBounds.minColumn,
            endColumnIndex: nextBounds.maxColumn
          })
        };
        if (resizedTable.showTotalRow) {
          writeTableTotalRowValues(resizedTable);
        }
        return resizedTable;
      })
    );
    setSelectionRange({
      startRowIndex: nextBounds.minRow,
      startColumnIndex: nextBounds.minColumn,
      endRowIndex: nextBounds.maxRow,
      endColumnIndex: nextBounds.maxColumn
    });
    activeSelection = { rowIndex: nextBounds.minRow, columnIndex: nextBounds.minColumn };
    commitModel(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const selectActiveTableRange = ({ dataOnly = false } = {}) => {
    const activeTable = getActiveTableForSelection();
    if (!activeTable) {
      window.alert("Select a cell inside a table first.");
      return false;
    }
    const bounds = getStructureBounds(activeTable);
    const minRow = dataOnly ? getTableDataStartRow(activeTable) : bounds.minRow;
    const maxRow = dataOnly ? getTableDataEndRow(activeTable) : bounds.maxRow;
    setSelectionRange({
      startRowIndex: minRow,
      startColumnIndex: bounds.minColumn,
      endRowIndex: maxRow,
      endColumnIndex: bounds.maxColumn
    });
    activeSelection = { rowIndex: minRow, columnIndex: bounds.minColumn };
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const getSheetCellValue = (sourceSheet = getActiveSheetState(), rowIndex = 0, columnIndex = 0, { evaluated = true } = {}) => {
    if (sourceSheet?.id === getActiveSheetState().id) {
      return evaluated ? evaluateCellValue(rowIndex, columnIndex) : getRawCellValue(rowIndex, columnIndex);
    }
    if (rowIndex === 0) {
      return String(sourceSheet?.columns?.[columnIndex] || "");
    }
    return String(sourceSheet?.rows?.[rowIndex - 1]?.[columnIndex] || "");
  };

  const getPivotSourceFromSelection = () => {
    const activeTable = getActiveTableForSelection();
    const sourceSheet = getActiveSheetState();
    const bounds = activeTable ? getStructureBounds(activeTable) : getSelectedTableBounds();
    if (!bounds) {
      return null;
    }
    return {
      sourceSheet,
      sourceTable: activeTable,
      bounds,
      sourceRange: formatBoundsAddress(bounds)
    };
  };

  const readPivotSourceDescriptor = ({ sourceSheet = getActiveSheetState(), bounds = null } = {}) => {
    if (!sourceSheet || !bounds) {
      return null;
    }
    const normalizedBounds = normalizeSelectionBounds(bounds);
    if (normalizedBounds.maxRow <= normalizedBounds.minRow) {
      return null;
    }
    const fields = getTableHeaderNames(sourceSheet, normalizedBounds);
    const records = [];
    for (let rowIndex = normalizedBounds.minRow + 1; rowIndex <= normalizedBounds.maxRow; rowIndex += 1) {
      records.push(
        fields.map((_, offset) =>
          getSheetCellValue(sourceSheet, rowIndex, normalizedBounds.minColumn + offset, { evaluated: true })
        )
      );
    }
    return { fields, records };
  };

  const makePivotAggregate = () => ({ total: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });

  const addPivotAggregateValue = (aggregate, value, aggregateKind = "sum") => {
    if (aggregateKind === "count") {
      aggregate.total += 1;
      aggregate.count += 1;
      return aggregate;
    }
    const numericValue = coerceNumeric(value);
    if (!Number.isFinite(numericValue)) {
      return aggregate;
    }
    aggregate.total += numericValue;
    aggregate.count += 1;
    aggregate.min = Math.min(aggregate.min, numericValue);
    aggregate.max = Math.max(aggregate.max, numericValue);
    return aggregate;
  };

  const formatPivotAggregate = (aggregate, aggregateKind = "sum") => {
    if (aggregateKind === "count") {
      return formatFormulaResult(aggregate.total);
    }
    if (!aggregate.count) {
      return "0";
    }
    if (aggregateKind === "average") {
      return formatFormulaResult(aggregate.total / aggregate.count);
    }
    if (aggregateKind === "min") {
      return formatFormulaResult(aggregate.min);
    }
    if (aggregateKind === "max") {
      return formatFormulaResult(aggregate.max);
    }
    return formatFormulaResult(aggregate.total);
  };

  const buildPivotMatrix = ({ fields = [], records = [], rowField = "", columnField = "", valueField = "", aggregate = "sum" } = {}) => {
    const fieldLookup = new Map(fields.map((field, index) => [field.toLowerCase(), index]));
    const rowIndex = fieldLookup.get(String(rowField || "").toLowerCase());
    const columnIndex = columnField ? fieldLookup.get(String(columnField || "").toLowerCase()) : -1;
    const valueIndex = fieldLookup.get(String(valueField || "").toLowerCase());
    if (!Number.isInteger(rowIndex) || !Number.isInteger(valueIndex) || (columnField && !Number.isInteger(columnIndex))) {
      return null;
    }

    if (!columnField) {
      const groups = new Map();
      const grandTotal = makePivotAggregate();
      records.forEach((record) => {
        const rowKey = String(record[rowIndex] || "(blank)");
        const group = groups.get(rowKey) || makePivotAggregate();
        addPivotAggregateValue(group, record[valueIndex], aggregate);
        addPivotAggregateValue(grandTotal, record[valueIndex], aggregate);
        groups.set(rowKey, group);
      });
      const header = [rowField, `${aggregate.toUpperCase()} of ${valueField}`];
      const rows = Array.from(groups.entries()).map(([label, group]) => [label, formatPivotAggregate(group, aggregate)]);
      rows.push(["Grand Total", formatPivotAggregate(grandTotal, aggregate)]);
      return [header, ...rows];
    }

    const rowGroups = new Map();
    const columnKeys = [];
    const columnTotals = new Map();
    const grandTotal = makePivotAggregate();
    records.forEach((record) => {
      const rowKey = String(record[rowIndex] || "(blank)");
      const columnKey = String(record[columnIndex] || "(blank)");
      if (!columnTotals.has(columnKey)) {
        columnKeys.push(columnKey);
        columnTotals.set(columnKey, makePivotAggregate());
      }
      const rowGroup = rowGroups.get(rowKey) || { columns: new Map(), total: makePivotAggregate() };
      const cellAggregate = rowGroup.columns.get(columnKey) || makePivotAggregate();
      addPivotAggregateValue(cellAggregate, record[valueIndex], aggregate);
      addPivotAggregateValue(rowGroup.total, record[valueIndex], aggregate);
      addPivotAggregateValue(columnTotals.get(columnKey), record[valueIndex], aggregate);
      addPivotAggregateValue(grandTotal, record[valueIndex], aggregate);
      rowGroup.columns.set(columnKey, cellAggregate);
      rowGroups.set(rowKey, rowGroup);
    });

    const header = [rowField, ...columnKeys, "Grand Total"];
    const rows = Array.from(rowGroups.entries()).map(([label, group]) => [
      label,
      ...columnKeys.map((key) => formatPivotAggregate(group.columns.get(key) || makePivotAggregate(), aggregate)),
      formatPivotAggregate(group.total, aggregate)
    ]);
    rows.push([
      "Grand Total",
      ...columnKeys.map((key) => formatPivotAggregate(columnTotals.get(key) || makePivotAggregate(), aggregate)),
      formatPivotAggregate(grandTotal, aggregate)
    ]);
    return [header, ...rows];
  };

  const writePivotMatrixToSheet = (targetSheet, matrix = [], pivotConfig = {}) => {
    const width = Math.max(1, ...matrix.map((row) => row.length));
    const normalizedMatrix = matrix.length
      ? matrix.map((row) => Array.from({ length: width }, (_, index) => String(row[index] ?? "")))
      : [["Pivot"], ["No data"]];
    const [columns, ...rows] = normalizedMatrix;
    targetSheet.columns = columns;
    targetSheet.rows = rows.length ? rows : [Array.from({ length: width }, () => "")];
    targetSheet.frozenRows = 1;
    targetSheet.pivotTables = [
      {
        ...pivotConfig,
        renderedRange: formatBoundsAddress({
          minRow: 0,
          maxRow: Math.max(0, normalizedMatrix.length - 1),
          minColumn: 0,
          maxColumn: Math.max(0, width - 1)
        }),
        lastRefreshedAt: new Date().toISOString()
      }
    ];
  };

  const createPivotTableFromSelection = () => {
    persistGridIntoActiveSheet();
    const source = getPivotSourceFromSelection();
    const descriptor = source ? readPivotSourceDescriptor(source) : null;
    if (!source || !descriptor || !descriptor.fields.length || !descriptor.records.length) {
      window.alert("Select a table or a range with headers and at least one data row to create a pivot table.");
      return false;
    }

    const defaultRowField = descriptor.fields[0];
    const defaultValueField = descriptor.fields[Math.min(1, descriptor.fields.length - 1)];
    const rowFieldName = window.prompt(`Row field (${descriptor.fields.join(", ")})`, defaultRowField);
    if (rowFieldName === null) {
      return false;
    }
    const columnFieldName = window.prompt("Column field (optional, leave blank)", "");
    if (columnFieldName === null) {
      return false;
    }
    const valueFieldName = window.prompt(`Value field (${descriptor.fields.join(", ")})`, defaultValueField);
    if (valueFieldName === null) {
      return false;
    }
    const summaryInput = window.prompt("Summary: sum, count, average, min or max", "sum");
    if (summaryInput === null) {
      return false;
    }
    const summaryKind = ["sum", "count", "average", "min", "max"].includes(String(summaryInput || "").trim().toLowerCase())
      ? String(summaryInput || "").trim().toLowerCase()
      : "sum";
    const matrix = buildPivotMatrix({
      fields: descriptor.fields,
      records: descriptor.records,
      rowField: String(rowFieldName || "").trim(),
      columnField: String(columnFieldName || "").trim(),
      valueField: String(valueFieldName || "").trim(),
      aggregate: summaryKind
    });
    if (!matrix) {
      window.alert("The selected pivot fields were not found in the current source.");
      return false;
    }

    const beforeSnapshot = getWorkbookSnapshot();
    const nextSheet = buildBlankSheetModel(source.sourceSheet, buildUniqueSheetName(`Pivot ${rowFieldName || "Table"}`));
    const pivotConfig = normalizeSpreadsheetPivotTable({
      id: `sheet-pivot-${Date.now()}`,
      name: buildUniqueTableName("PivotTable"),
      sourceSheetId: source.sourceSheet.id,
      sourceTableId: source.sourceTable?.id || "",
      sourceRange: source.sourceRange,
      rowField: String(rowFieldName || "").trim(),
      columnField: String(columnFieldName || "").trim(),
      valueField: String(valueFieldName || "").trim(),
      aggregate: summaryKind,
      anchorRowIndex: 0,
      anchorColumnIndex: 0
    });
    writePivotMatrixToSheet(nextSheet, matrix, pivotConfig);
    workbookModel.sheets.push(nextSheet);
    workbookModel.activeSheetId = nextSheet.id;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const refreshPivotTable = (targetSheet = getActiveSheetState(), pivotTable = null) => {
    const normalizedPivot = normalizeSpreadsheetPivotTable(pivotTable || targetSheet.pivotTables?.[0]);
    if (!normalizedPivot) {
      return false;
    }
    const sourceSheet = getSheetStateById(normalizedPivot.sourceSheetId);
    if (!sourceSheet) {
      window.alert(`Source sheet for ${normalizedPivot.name} was not found.`);
      return false;
    }
    const sourceTable = normalizeSpreadsheetTables(sourceSheet.tables).find((table) => table.id === normalizedPivot.sourceTableId);
    const bounds = sourceTable ? getStructureBounds(sourceTable) : getRangeBoundsFromAddress(normalizedPivot.sourceRange);
    const descriptor = readPivotSourceDescriptor({ sourceSheet, bounds });
    if (!descriptor) {
      window.alert(`Source range for ${normalizedPivot.name} is not available.`);
      return false;
    }
    const matrix = buildPivotMatrix({
      fields: descriptor.fields,
      records: descriptor.records,
      rowField: normalizedPivot.rowField,
      columnField: normalizedPivot.columnField,
      valueField: normalizedPivot.valueField,
      aggregate: normalizedPivot.aggregate
    });
    if (!matrix) {
      window.alert(`Fields for ${normalizedPivot.name} are no longer available.`);
      return false;
    }
    writePivotMatrixToSheet(targetSheet, matrix, normalizedPivot);
    return true;
  };

  const refreshActivePivotTables = () => {
    const currentSheet = getActiveSheetState();
    const pivotTables = getActiveSheetPivotTables();
    if (!pivotTables.length) {
      window.alert("This sheet has no pivot table to refresh.");
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const didRefresh = refreshPivotTable(currentSheet, pivotTables[0]);
    if (!didRefresh) {
      return false;
    }
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const addSlicerFromSelection = () => {
    persistGridIntoActiveSheet();
    const columnIndex = activeSelection.columnIndex;
    const title = getRawCellValue(0, columnIndex) || `Column ${columnIndex + 1}`;
    const currentSheet = getActiveSheetState();
    const existing = getActiveSheetSlicers().find((slicer) => slicer.columnIndex === columnIndex);
    if (existing) {
      window.alert(`A slicer already exists for ${title}.`);
      return false;
    }
    const beforeSnapshot = getWorkbookSnapshot();
    currentSheet.slicers = [
      ...getActiveSheetSlicers(),
      {
        id: `sheet-slicer-${Date.now()}`,
        title,
        columnIndex,
        selectedValue: ""
      }
    ];
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const updateSlicerSelection = (slicerId = "", selectedValue = "") => {
    const nextSlicers = getActiveSheetSlicers().map((slicer) =>
      slicer.id === slicerId
        ? {
            ...slicer,
            selectedValue: String(selectedValue || "")
          }
        : slicer
    );
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    currentSheet.slicers = nextSlicers;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const removeSlicer = (slicerId = "") => {
    const nextSlicers = getActiveSheetSlicers().filter((slicer) => slicer.id !== slicerId);
    if (nextSlicers.length === getActiveSheetSlicers().length) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentSheet = getActiveSheetState();
    currentSheet.slicers = nextSlicers;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const addSparklineFromSelection = () => {
    persistGridIntoActiveSheet();
    const defaultRange = getSelectionRangeAddress();
    const rangeInput = window.prompt("Sparkline source range", defaultRange);
    if (rangeInput === null) {
      return false;
    }
    const targetInput = window.prompt(
      "Target cell for the sparkline",
      coordsToAddress(Math.min(sheetGrid.length - 1, activeSelection.rowIndex + 1), activeSelection.columnIndex)
    );
    if (targetInput === null) {
      return false;
    }
    const targetCoords = addressToCoords(targetInput);
    if (!targetCoords) {
      window.alert("Invalid target cell.");
      return false;
    }
    if (
      !ensureEditableBounds(
        {
          minRow: targetCoords.rowIndex,
          maxRow: targetCoords.rowIndex,
          minColumn: targetCoords.columnIndex,
          maxColumn: targetCoords.columnIndex
        },
        "insert a sparkline"
      )
    ) {
      return false;
    }
    const typeInput = window.prompt("Sparkline type: line or column", "line");
    if (typeInput === null) {
      return false;
    }
    const sparklineType = ["line", "column"].includes(String(typeInput || "").trim().toLowerCase())
      ? String(typeInput || "").trim().toLowerCase()
      : "line";
    const beforeSnapshot = getWorkbookSnapshot();
    setCellSparkline(targetCoords.rowIndex, targetCoords.columnIndex, {
      range: String(rangeInput || "").trim(),
      type: sparklineType,
      color: "#1a73e8"
    });
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const removeActiveCellSparkline = () => {
    if (!getCellSparkline(activeSelection.rowIndex, activeSelection.columnIndex)) {
      return false;
    }
    if (!ensureActiveCellEditable("remove the sparkline")) {
      return false;
    }
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    setCellSparkline(activeSelection.rowIndex, activeSelection.columnIndex, null);
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const setActiveSheetZoomLevel = (zoomLevel = 1) => {
    const nextZoomLevel = Math.max(0.5, Math.min(2, Number(zoomLevel || 1) || 1));
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    getActiveSheetState().zoomLevel = nextZoomLevel;
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const adjustActiveSheetZoom = (delta = 0) => {
    const currentZoom = getActiveSheetZoomLevel();
    return setActiveSheetZoomLevel(Math.round((currentZoom + delta) * 100) / 100);
  };

  const toggleActiveSheetGridlines = () => {
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    getActiveSheetState().showGridlines = !getActiveSheetShowGridlines();
    persistWorkbookState(false, { beforeSnapshot });
    rerenderPreview({ persistGrid: false });
    return true;
  };

  const removeSheetPrintRoot = () => {
    document.body.classList.remove("is-sheet-printing");
    document.documentElement.style.removeProperty("--sheet-print-page-width");
    document.documentElement.style.removeProperty("--sheet-print-page-height");
    document.documentElement.style.removeProperty("--sheet-print-margin");
    document.body.style.removeProperty("--sheet-print-page-width");
    document.body.style.removeProperty("--sheet-print-page-height");
    document.body.style.removeProperty("--sheet-print-margin");
    document.querySelectorAll(".workspace-sheet-print-root").forEach((node) => node.remove());
  };

  const SHEET_PRINT_DEFAULT_SETTINGS = {
    printRange: "active",
    paperSize: "a4",
    orientation: "landscape",
    scaling: "default",
    pagesPerSheet: "1",
    margins: "normal",
    showGridlines: false,
    showHeadings: false,
    blackAndWhite: false,
    centerHorizontally: false,
    centerVertically: false,
    showHeadersFooters: false,
    includeCharts: true
  };
  let sheetPrintSettings = { ...SHEET_PRINT_DEFAULT_SETTINGS };
  let sheetPrintDialogOverlay = null;
  let sheetPrintDialogKeydownHandler = null;

  const normalizeSheetPrintSettings = (settings = {}) => ({
    ...SHEET_PRINT_DEFAULT_SETTINGS,
    ...settings,
    printRange: ["active", "selection"].includes(settings.printRange) ? settings.printRange : SHEET_PRINT_DEFAULT_SETTINGS.printRange,
    paperSize: ["a4", "letter"].includes(settings.paperSize) ? settings.paperSize : SHEET_PRINT_DEFAULT_SETTINGS.paperSize,
    orientation: ["portrait", "landscape"].includes(settings.orientation)
      ? settings.orientation
      : SHEET_PRINT_DEFAULT_SETTINGS.orientation,
    scaling: ["default", "fit-page", "fit-width", "fit-height", "actual"].includes(settings.scaling)
      ? settings.scaling
      : SHEET_PRINT_DEFAULT_SETTINGS.scaling,
    pagesPerSheet: ["1", "2", "4"].includes(String(settings.pagesPerSheet))
      ? String(settings.pagesPerSheet)
      : SHEET_PRINT_DEFAULT_SETTINGS.pagesPerSheet,
    margins: ["normal", "narrow", "wide"].includes(settings.margins) ? settings.margins : SHEET_PRINT_DEFAULT_SETTINGS.margins
  });

  const getSheetPrintPageMetrics = (settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const paperMetrics = normalizedSettings.paperSize === "letter"
      ? { portrait: { width: 816, height: 1056 }, landscape: { width: 1056, height: 816 } }
      : { portrait: { width: 794, height: 1123 }, landscape: { width: 1123, height: 794 } };
    const marginSize = normalizedSettings.margins === "narrow" ? 26 : normalizedSettings.margins === "wide" ? 82 : 48;
    const page = paperMetrics[normalizedSettings.orientation] || paperMetrics.landscape;
    return {
      pageWidth: page.width,
      pageHeight: page.height,
      marginSize,
      contentWidth: Math.max(120, page.width - marginSize * 2),
      contentHeight: Math.max(120, page.height - marginSize * 2 - (normalizedSettings.showHeadersFooters ? 52 : 0))
    };
  };

  const scheduleSheetPrintCleanup = () => {
    const cleanup = () => {
      window.setTimeout(removeSheetPrintRoot, 700);
    };
    window.addEventListener("focus", cleanup, { once: true });
    window.addEventListener("afterprint", cleanup, { once: true });
  };

  const getPrintUsedBounds = () => {
    const lastUsedCell = getLastUsedCell();
    const bounds = {
      minRow: 0,
      minColumn: 0,
      maxRow: lastUsedCell.rowIndex,
      maxColumn: lastUsedCell.columnIndex
    };

    getActiveSheetTables().forEach((table) => {
      const tableBounds = getStructureBounds(table);
      bounds.maxRow = Math.max(bounds.maxRow, tableBounds.maxRow);
      bounds.maxColumn = Math.max(bounds.maxColumn, tableBounds.maxColumn);
    });

    getActiveSheetPivotTables().forEach((pivotTable) => {
      const pivotBounds = getRangeBoundsFromAddress(pivotTable.renderedRange) || {
        minRow: pivotTable.anchorRowIndex,
        maxRow: pivotTable.anchorRowIndex,
        minColumn: pivotTable.anchorColumnIndex,
        maxColumn: pivotTable.anchorColumnIndex
      };
      bounds.maxRow = Math.max(bounds.maxRow, pivotBounds.maxRow);
      bounds.maxColumn = Math.max(bounds.maxColumn, pivotBounds.maxColumn);
    });

    return bounds;
  };

  const getPrintChartContentExtent = (settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    if (!normalizedSettings.includeCharts || normalizedSettings.printRange !== "active") {
      return { right: 0, bottom: 0 };
    }
    const headingOffsetX = normalizedSettings.showHeadings ? 46 : 0;
    const headingOffsetY = normalizedSettings.showHeadings ? 24 : 0;
    return getActiveSheetCharts().reduce(
      (extent, chart) => {
        const chartFrame = clampChartFrame(chart);
        return {
          right: Math.max(extent.right, headingOffsetX + Math.max(0, chartFrame.x - 52) + chartFrame.width),
          bottom: Math.max(extent.bottom, headingOffsetY + Math.max(0, chartFrame.y - 34) + chartFrame.height)
        };
      },
      { right: 0, bottom: 0 }
    );
  };

  const expandPrintBoundsForSheetOptions = (bounds, settings = sheetPrintSettings, metrics = getSheetPrintPageMetrics(settings)) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    if (normalizedSettings.printRange !== "active" || (!normalizedSettings.showGridlines && !normalizedSettings.showHeadings)) {
      return bounds;
    }

    const expandedBounds = { ...bounds };
    const chartExtent = getPrintChartContentExtent(normalizedSettings);
    const headingWidth = normalizedSettings.showHeadings ? 46 : 0;
    const headingHeight = normalizedSettings.showHeadings ? 24 : 0;
    const targetWidth = Math.max(metrics.contentWidth, chartExtent.right);
    const targetHeight = Math.max(metrics.contentHeight, chartExtent.bottom);
    let tableWidth = headingWidth + Array.from({ length: expandedBounds.maxColumn - expandedBounds.minColumn + 1 }, (_, offset) =>
      getColumnWidth(expandedBounds.minColumn + offset)
    ).reduce((sum, width) => sum + width, 0);
    let tableHeight = headingHeight + Array.from({ length: expandedBounds.maxRow - expandedBounds.minRow + 1 }, (_, offset) =>
      getRowHeight(expandedBounds.minRow + offset)
    ).reduce((sum, height) => sum + height, 0);

    while (tableWidth < targetWidth && expandedBounds.maxColumn < Math.max(SPREADSHEET_MIN_VISIBLE_COLUMNS - 1, 80)) {
      expandedBounds.maxColumn += 1;
      tableWidth += getColumnWidth(expandedBounds.maxColumn);
    }
    while (tableHeight < targetHeight && expandedBounds.maxRow < Math.max(SPREADSHEET_MIN_VISIBLE_ROWS - 1, 300)) {
      expandedBounds.maxRow += 1;
      tableHeight += getRowHeight(expandedBounds.maxRow);
    }
    return expandedBounds;
  };

  const getPrintBoundsForSettings = (settings = sheetPrintSettings, metrics = getSheetPrintPageMetrics(settings)) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const bounds = normalizedSettings.printRange === "selection" ? getSelectionBounds() : getPrintUsedBounds();
    return expandPrintBoundsForSheetOptions(bounds, normalizedSettings, metrics);
  };

  const getPrintCellDisplayValue = (rowIndex = 0, columnIndex = 0) => {
    const rawValue = getRawCellValue(rowIndex, columnIndex);
    return formatCellDisplayValue(
      rawValue.startsWith("=") ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex)) : rawValue,
      rowIndex,
      columnIndex
    );
  };

  const applyPrintCellStyles = (cell, rowIndex = 0, columnIndex = 0) => {
    const format = getCellFormat(rowIndex, columnIndex);
    const conditionalFormat = getConditionalFormatForCell(rowIndex, columnIndex);
    const tableInfo = getTableCellInfo(rowIndex, columnIndex);
    const pivotInfo = getPivotTableCellInfo(rowIndex, columnIndex);
    const tablePalette = {
      blue: { header: "#1a73e8", banded: "#eef5ff", total: "#d8e9ff" },
      green: { header: "#188038", banded: "#e6f4ea", total: "#ceead6" },
      orange: { header: "#c26401", banded: "#fff4e5", total: "#fce8b2" },
      purple: { header: "#6f42c1", banded: "#f1eafe", total: "#e4d7fb" },
      gray: { header: "#5f6368", banded: "#f1f3f4", total: "#e8eaed" }
    };
    const activePalette = tablePalette[tableInfo?.table?.style] || tablePalette.blue;
    const structuralFill =
      tableInfo?.isHeader
        ? activePalette.header
        : tableInfo?.isTotal
          ? activePalette.total
          : tableInfo?.isBanded || tableInfo?.isBandedColumn
            ? activePalette.banded
            : pivotInfo?.isHeader
              ? "#f1f3f4"
              : pivotInfo?.isTotal
                ? "#e8f0fe"
                : "";
    const structuralColor = tableInfo?.isHeader ? "#ffffff" : "#202124";
    const structuralBold =
      tableInfo?.isHeader ||
      tableInfo?.isTotal ||
      tableInfo?.isFirstColumn ||
      tableInfo?.isLastColumn ||
      pivotInfo?.isHeader ||
      pivotInfo?.isTotal;

    cell.classList.toggle("is-structured", Boolean(tableInfo || pivotInfo));
    cell.style.color = conditionalFormat?.textColor || format.textColor || structuralColor;
    cell.style.background = conditionalFormat?.fillColor || format.fillColor || structuralFill || "#ffffff";
    cell.style.fontWeight = format.bold || conditionalFormat?.bold || structuralBold ? "700" : "400";
    cell.style.fontStyle = format.italic ? "italic" : "";
    cell.style.textDecoration = format.underline ? "underline" : "";
    cell.style.textAlign = format.horizontalAlign || "";
    cell.style.verticalAlign =
      format.verticalAlign === "middle" ? "middle" : format.verticalAlign === "bottom" ? "bottom" : "top";
    if (format.fontSize) {
      cell.style.fontSize = `${format.fontSize}px`;
    }

    const border = normalizeSpreadsheetBorderSpec(format.border);
    if (border) {
      const borderStyle = `${SPREADSHEET_BORDER_STYLE_CSS[border.style] || SPREADSHEET_BORDER_STYLE_CSS.medium} ${border.color || "#202124"}`;
      if (border.top) cell.style.borderTop = borderStyle;
      if (border.right) cell.style.borderRight = borderStyle;
      if (border.bottom) cell.style.borderBottom = borderStyle;
      if (border.left) cell.style.borderLeft = borderStyle;
    }
  };

  const buildSheetPrintTable = (bounds = getPrintUsedBounds(), settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const table = document.createElement("table");
    table.className = "workspace-sheet-print-table";
    const colGroup = document.createElement("colgroup");
    if (normalizedSettings.showHeadings) {
      const headingCol = document.createElement("col");
      headingCol.style.width = "46px";
      colGroup.appendChild(headingCol);
    }
    for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
      const col = document.createElement("col");
      col.style.width = `${getColumnWidth(columnIndex)}px`;
      colGroup.appendChild(col);
    }
    table.appendChild(colGroup);

    if (normalizedSettings.showHeadings) {
      const thead = document.createElement("thead");
      const headingRow = document.createElement("tr");
      const corner = document.createElement("th");
      corner.className = "workspace-sheet-print-table-heading is-corner";
      headingRow.appendChild(corner);
      for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
        const th = document.createElement("th");
        th.className = "workspace-sheet-print-table-heading";
        th.textContent = columnLetter(columnIndex);
        headingRow.appendChild(th);
      }
      thead.appendChild(headingRow);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    for (let rowIndex = bounds.minRow; rowIndex <= bounds.maxRow; rowIndex += 1) {
      const tr = document.createElement("tr");
      tr.style.height = `${getRowHeight(rowIndex)}px`;
      if (normalizedSettings.showHeadings) {
        const rowHeading = document.createElement("th");
        rowHeading.className = "workspace-sheet-print-table-heading";
        rowHeading.textContent = String(rowIndex + 1);
        tr.appendChild(rowHeading);
      }
      for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
        const td = document.createElement("td");
        const merge = findMergeAt(rowIndex, columnIndex);
        if (merge && !isMergeAnchor(rowIndex, columnIndex)) {
          continue;
        }
        if (merge) {
          td.rowSpan = merge.rowSpan;
          td.colSpan = merge.columnSpan;
        }
        const displayValue = getPrintCellDisplayValue(rowIndex, columnIndex);
        td.textContent = displayValue;
        td.classList.toggle("is-empty", !String(displayValue || "").trim());
        applyPrintCellStyles(td, rowIndex, columnIndex);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  };

  const getPrintTableSize = (bounds = getPrintUsedBounds(), settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    return {
      width:
        Array.from({ length: bounds.maxColumn - bounds.minColumn + 1 }, (_, offset) =>
          getColumnWidth(bounds.minColumn + offset)
        ).reduce((sum, width) => sum + width, 0) + (normalizedSettings.showHeadings ? 46 : 0),
      height:
        Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, offset) =>
          getRowHeight(bounds.minRow + offset)
        ).reduce((sum, height) => sum + height, 0) + (normalizedSettings.showHeadings ? 24 : 0)
    };
  };

  const appendPrintChart = (canvas, chart = {}, settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const headingOffsetX = normalizedSettings.showHeadings ? 46 : 0;
    const headingOffsetY = normalizedSettings.showHeadings ? 24 : 0;
    const chartFrame = clampChartFrame(chart);
    const chartNode = document.createElement("article");
    chartNode.className = "workspace-sheet-print-chart";
    chartNode.style.left = `${headingOffsetX + Math.max(0, chartFrame.x - 52)}px`;
    chartNode.style.top = `${headingOffsetY + Math.max(0, chartFrame.y - 34)}px`;
    chartNode.style.width = `${chartFrame.width}px`;
    chartNode.style.height = `${chartFrame.height}px`;

    const title = document.createElement("div");
    title.className = "workspace-sheet-print-chart-title";
    title.textContent = chart.title || "Chart";
    chartNode.appendChild(title);

    const stage = document.createElement("div");
    stage.className = "workspace-sheet-print-chart-stage";
    stage.appendChild(renderSpreadsheetChartGraphic(chart));
    chartNode.appendChild(stage);

    const legendItems = getSpreadsheetChartLegendItems(chart);
    if (chart.showLegend !== false && legendItems.length) {
      const legend = document.createElement("div");
      legend.className = "workspace-sheet-print-chart-legend";
      legendItems.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "workspace-sheet-print-chart-legend-item";
        const swatch = document.createElement("span");
        swatch.style.background = item.color || chartPalette[0];
        const label = document.createElement("span");
        label.textContent = item.label || "Series";
        chip.append(swatch, label);
        legend.appendChild(chip);
      });
      chartNode.appendChild(legend);
    }

    canvas.appendChild(chartNode);
    return {
      right: headingOffsetX + Math.max(0, chartFrame.x - 52) + chartFrame.width,
      bottom: headingOffsetY + Math.max(0, chartFrame.y - 34) + chartFrame.height
    };
  };

  const buildSheetPrintPage = (settings = sheetPrintSettings) => {
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const activeSheet = getActiveSheetState();
    const metrics = getSheetPrintPageMetrics(normalizedSettings);
    const bounds = getPrintBoundsForSettings(normalizedSettings, metrics);
    const tableSize = getPrintTableSize(bounds, normalizedSettings);
    const page = document.createElement("section");
    page.className = [
      "workspace-sheet-print-page",
      `print-paper-${normalizedSettings.paperSize}`,
      `print-${normalizedSettings.orientation}`,
      `print-margins-${normalizedSettings.margins}`,
      `print-scale-${normalizedSettings.scaling}`
    ].join(" ");
    page.classList.toggle("show-gridlines", normalizedSettings.showGridlines);
    page.classList.toggle("show-headings", normalizedSettings.showHeadings);
    page.classList.toggle("is-black-and-white", normalizedSettings.blackAndWhite);
    page.classList.toggle("center-horizontal", normalizedSettings.centerHorizontally);
    page.classList.toggle("center-vertical", normalizedSettings.centerVertically);
    page.style.setProperty("--sheet-print-page-width", `${metrics.pageWidth}px`);
    page.style.setProperty("--sheet-print-page-height", `${metrics.pageHeight}px`);
    page.style.setProperty("--sheet-print-margin", `${metrics.marginSize}px`);

    if (normalizedSettings.showHeadersFooters) {
      const header = document.createElement("header");
      header.className = "workspace-sheet-print-header";
      const title = document.createElement("strong");
      title.textContent = activeSheet.name || "Sheet";
      const meta = document.createElement("span");
      meta.textContent = `${bounds.maxRow - bounds.minRow + 1} rows | ${bounds.maxColumn - bounds.minColumn + 1} columns`;
      header.append(title, meta);
      page.appendChild(header);
    }

    const frame = document.createElement("div");
    frame.className = "workspace-sheet-print-frame";
    const canvas = document.createElement("div");
    canvas.className = "workspace-sheet-print-canvas";
    canvas.appendChild(buildSheetPrintTable(bounds, normalizedSettings));

    let contentWidth = tableSize.width;
    let contentHeight = tableSize.height;
    if (normalizedSettings.includeCharts && normalizedSettings.printRange === "active") {
      getActiveSheetCharts().forEach((chart) => {
        const chartSize = appendPrintChart(canvas, chart, normalizedSettings);
        contentWidth = Math.max(contentWidth, chartSize.right);
        contentHeight = Math.max(contentHeight, chartSize.bottom);
      });
    }

    const fitWidthScale = metrics.contentWidth / Math.max(1, contentWidth);
    const fitHeightScale = metrics.contentHeight / Math.max(1, contentHeight);
    let scale = 1;
    if (normalizedSettings.scaling === "fit-page") {
      scale = Math.min(1, fitWidthScale, fitHeightScale);
    } else if (normalizedSettings.scaling === "fit-width") {
      scale = Math.min(1, fitWidthScale);
    } else if (normalizedSettings.scaling === "fit-height") {
      scale = Math.min(1, fitHeightScale);
    }
    if (normalizedSettings.pagesPerSheet === "2") {
      scale *= 0.72;
    } else if (normalizedSettings.pagesPerSheet === "4") {
      scale *= 0.5;
    }
    canvas.style.width = `${Math.ceil(contentWidth)}px`;
    canvas.style.height = `${Math.ceil(contentHeight)}px`;
    canvas.style.transform = `scale(${scale})`;
    frame.style.width = `${Math.ceil(contentWidth * scale)}px`;
    frame.style.height = `${Math.ceil(contentHeight * scale)}px`;
    frame.appendChild(canvas);
    page.appendChild(frame);
    if (normalizedSettings.showHeadersFooters) {
      const footer = document.createElement("footer");
      footer.className = "workspace-sheet-print-footer";
      const source = document.createElement("span");
      source.textContent = window.location.host || "Hydria";
      const pageCount = document.createElement("span");
      pageCount.textContent = "1/1";
      footer.append(source, pageCount);
      page.appendChild(footer);
    }
    return page;
  };

  const buildSheetPrintRoot = (settings = sheetPrintSettings) => {
    removeSheetPrintRoot();
    const normalizedSettings = normalizeSheetPrintSettings(settings);
    const root = document.createElement("div");
    root.className = [
      "workspace-sheet-print-root",
      `print-paper-${normalizedSettings.paperSize}`,
      `print-${normalizedSettings.orientation}`,
      `print-margins-${normalizedSettings.margins}`,
      `print-pages-${normalizedSettings.pagesPerSheet}`
    ].join(" ");
    const metrics = getSheetPrintPageMetrics(normalizedSettings);
    root.style.setProperty("--sheet-print-page-width", `${metrics.pageWidth}px`);
    root.style.setProperty("--sheet-print-page-height", `${metrics.pageHeight}px`);
    root.style.setProperty("--sheet-print-margin", `${metrics.marginSize}px`);
    root.appendChild(buildSheetPrintPage(normalizedSettings));
    document.body.appendChild(root);
    return root;
  };

  const closeSheetPrintDialog = () => {
    if (sheetPrintDialogKeydownHandler) {
      document.removeEventListener("keydown", sheetPrintDialogKeydownHandler);
      sheetPrintDialogKeydownHandler = null;
    }
    if (sheetPrintDialogOverlay?.isConnected) {
      sheetPrintDialogOverlay.remove();
    }
    sheetPrintDialogOverlay = null;
  };

  const runSheetPrintWithSettings = (settings = sheetPrintSettings) => {
    sheetPrintSettings = normalizeSheetPrintSettings(settings);
    closeSheetPrintDialog();
    buildSheetPrintRoot(sheetPrintSettings);
    const metrics = getSheetPrintPageMetrics(sheetPrintSettings);
    document.documentElement.style.setProperty("--sheet-print-page-width", `${metrics.pageWidth}px`);
    document.documentElement.style.setProperty("--sheet-print-page-height", `${metrics.pageHeight}px`);
    document.documentElement.style.setProperty("--sheet-print-margin", `${metrics.marginSize}px`);
    document.body.style.setProperty("--sheet-print-page-width", `${metrics.pageWidth}px`);
    document.body.style.setProperty("--sheet-print-page-height", `${metrics.pageHeight}px`);
    document.body.style.setProperty("--sheet-print-margin", `${metrics.marginSize}px`);
    document.body.classList.add("is-sheet-printing");
    scheduleSheetPrintCleanup();
    window.print();
    return true;
  };

  const makeSheetPrintSelect = (labelText, value, options = [], onChange = () => {}) => {
    const label = document.createElement("label");
    label.className = "workspace-sheet-print-setting";
    const span = document.createElement("span");
    span.textContent = labelText;
    const select = document.createElement("select");
    options.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    });
    select.value = value;
    select.addEventListener("change", () => onChange(select.value));
    label.append(span, select);
    return label;
  };

  const makeSheetPrintCheckbox = (labelText, checked, onChange = () => {}) => {
    const label = document.createElement("label");
    label.className = "workspace-sheet-print-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(checked);
    input.addEventListener("change", () => onChange(input.checked));
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(input, text);
    return label;
  };

  const openSheetPrintDialog = () => {
    closeSheetMenu();
    closeSheetPrintDialog();
    persistGridIntoActiveSheet();

    let draftSettings = normalizeSheetPrintSettings(sheetPrintSettings);
    const overlay = document.createElement("div");
    overlay.className = "workspace-sheet-print-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Options d'impression");

    const previewPane = document.createElement("div");
    previewPane.className = "workspace-sheet-print-dialog-preview-pane";
    const previewViewport = document.createElement("div");
    previewViewport.className = "workspace-sheet-print-dialog-preview";
    const previewInner = document.createElement("div");
    previewInner.className = "workspace-sheet-print-dialog-preview-inner";
    previewViewport.appendChild(previewInner);
    const zoomTools = document.createElement("div");
    zoomTools.className = "workspace-sheet-print-dialog-zoom";
    const fitButton = document.createElement("button");
    fitButton.type = "button";
    fitButton.textContent = "Ajuster";
    const zoomInButton = document.createElement("button");
    zoomInButton.type = "button";
    zoomInButton.textContent = "+";
    const zoomOutButton = document.createElement("button");
    zoomOutButton.type = "button";
    zoomOutButton.textContent = "-";
    zoomTools.append(fitButton, zoomInButton, zoomOutButton);
    previewPane.append(previewViewport, zoomTools);

    const panel = document.createElement("aside");
    panel.className = "workspace-sheet-print-dialog-panel";
    const panelHeader = document.createElement("div");
    panelHeader.className = "workspace-sheet-print-dialog-header";
    const title = document.createElement("h2");
    title.textContent = "Imprimer";
    const pageCount = document.createElement("strong");
    pageCount.textContent = "1 page";
    panelHeader.append(title, pageCount);

    const settingsBody = document.createElement("div");
    settingsBody.className = "workspace-sheet-print-dialog-settings";
    let previewZoom = 1;

    const renderPreview = () => {
      const metrics = getSheetPrintPageMetrics(draftSettings);
      const page = buildSheetPrintPage(draftSettings);
      previewInner.replaceChildren(page);
      previewInner.style.width = `${metrics.pageWidth}px`;
      previewInner.style.height = `${metrics.pageHeight}px`;
      previewInner.style.transform = `scale(${previewZoom})`;
    };

    const fitPreviewToViewport = () => {
      const metrics = getSheetPrintPageMetrics(draftSettings);
      const viewportWidth = Math.max(1, previewViewport.clientWidth - 56);
      const viewportHeight = Math.max(1, previewViewport.clientHeight - 56);
      previewZoom = Math.min(1.15, Math.max(0.28, Math.min(viewportWidth / metrics.pageWidth, viewportHeight / metrics.pageHeight)));
      renderPreview();
    };

    const updateDraftSetting = (key, value) => {
      draftSettings = normalizeSheetPrintSettings({ ...draftSettings, [key]: value });
      fitPreviewToViewport();
    };

    settingsBody.append(
      makeSheetPrintSelect("Destination", "pdf", [{ label: "Fichier PDF", value: "pdf" }], () => {}),
      makeSheetPrintSelect("Pages", "all", [{ label: "Toutes", value: "all" }], () => {}),
      makeSheetPrintSelect(
        "Impression",
        draftSettings.printRange,
        [
          { label: "Feuille active", value: "active" },
          { label: "Selection actuelle", value: "selection" }
        ],
        (value) => updateDraftSetting("printRange", value)
      ),
      makeSheetPrintSelect(
        "Mise en page",
        draftSettings.orientation,
        [
          { label: "Paysage", value: "landscape" },
          { label: "Portrait", value: "portrait" }
        ],
        (value) => updateDraftSetting("orientation", value)
      )
    );

    const moreSettings = document.createElement("details");
    moreSettings.className = "workspace-sheet-print-more";
    moreSettings.open = true;
    const moreSummary = document.createElement("summary");
    moreSummary.textContent = "Plus de parametres";
    const moreBody = document.createElement("div");
    moreBody.className = "workspace-sheet-print-more-body";
    moreBody.append(
      makeSheetPrintSelect(
        "Taille du papier",
        draftSettings.paperSize,
        [
          { label: "A4", value: "a4" },
          { label: "Lettre", value: "letter" }
        ],
        (value) => updateDraftSetting("paperSize", value)
      ),
      makeSheetPrintSelect(
        "Pages par feuille",
        draftSettings.pagesPerSheet,
        [
          { label: "1", value: "1" },
          { label: "2", value: "2" },
          { label: "4", value: "4" }
        ],
        (value) => updateDraftSetting("pagesPerSheet", value)
      ),
      makeSheetPrintSelect(
        "Marges",
        draftSettings.margins,
        [
          { label: "Par defaut", value: "normal" },
          { label: "Etroites", value: "narrow" },
          { label: "Larges", value: "wide" }
        ],
        (value) => updateDraftSetting("margins", value)
      ),
      makeSheetPrintSelect(
        "Mise a l'echelle",
        draftSettings.scaling,
        [
          { label: "Par defaut", value: "default" },
          { label: "Ajuster la feuille a une page", value: "fit-page" },
          { label: "Ajuster toutes les colonnes a une page", value: "fit-width" },
          { label: "Ajuster toutes les lignes a une page", value: "fit-height" },
          { label: "Taille reelle", value: "actual" }
        ],
        (value) => updateDraftSetting("scaling", value)
      )
    );

    const optionsTitle = document.createElement("h3");
    optionsTitle.textContent = "Options de format";
    moreBody.append(
      optionsTitle,
      makeSheetPrintCheckbox("Quadrillage", draftSettings.showGridlines, (value) => updateDraftSetting("showGridlines", value)),
      makeSheetPrintCheckbox(
        "En-tetes des lignes et des colonnes",
        draftSettings.showHeadings,
        (value) => updateDraftSetting("showHeadings", value)
      ),
      makeSheetPrintCheckbox("Noir et blanc", draftSettings.blackAndWhite, (value) => updateDraftSetting("blackAndWhite", value)),
      makeSheetPrintCheckbox(
        "En-tetes et pieds de page",
        draftSettings.showHeadersFooters,
        (value) => updateDraftSetting("showHeadersFooters", value)
      ),
      makeSheetPrintCheckbox(
        "Graphiques d'arriere-plan",
        draftSettings.includeCharts,
        (value) => updateDraftSetting("includeCharts", value)
      )
    );

    const centerTitle = document.createElement("h3");
    centerTitle.textContent = "Centrer sur la page";
    moreBody.append(
      centerTitle,
      makeSheetPrintCheckbox(
        "Horizontalement",
        draftSettings.centerHorizontally,
        (value) => updateDraftSetting("centerHorizontally", value)
      ),
      makeSheetPrintCheckbox(
        "Verticalement",
        draftSettings.centerVertically,
        (value) => updateDraftSetting("centerVertically", value)
      )
    );
    moreSettings.append(moreSummary, moreBody);
    settingsBody.appendChild(moreSettings);

    const actions = document.createElement("div");
    actions.className = "workspace-sheet-print-dialog-actions";
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "workspace-sheet-print-primary";
    printButton.textContent = "Imprimer";
    printButton.addEventListener("click", () => runSheetPrintWithSettings(draftSettings));
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "workspace-sheet-print-secondary";
    cancelButton.textContent = "Annuler";
    cancelButton.addEventListener("click", closeSheetPrintDialog);
    actions.append(printButton, cancelButton);

    panel.append(panelHeader, settingsBody, actions);
    overlay.append(previewPane, panel);
    document.body.appendChild(overlay);
    sheetPrintDialogOverlay = overlay;
    sheetPrintDialogKeydownHandler = (event) => {
      if (event.key === "Escape") {
        closeSheetPrintDialog();
      }
    };
    document.addEventListener("keydown", sheetPrintDialogKeydownHandler);

    fitButton.addEventListener("click", fitPreviewToViewport);
    zoomInButton.addEventListener("click", () => {
      previewZoom = Math.min(1.6, Math.round((previewZoom + 0.1) * 100) / 100);
      renderPreview();
    });
    zoomOutButton.addEventListener("click", () => {
      previewZoom = Math.max(0.25, Math.round((previewZoom - 0.1) * 100) / 100);
      renderPreview();
    });
    window.setTimeout(fitPreviewToViewport, 0);
  };

  const printCurrentSheet = () => {
    openSheetPrintDialog();
    return true;
  };

  const serializeCsvCell = (value = "", delimiter = ";") => {
    const text = String(value ?? "");
    const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`["\\r\\n${escapedDelimiter}]`).test(text)
      ? `"${text.replaceAll("\"", "\"\"")}"`
      : text;
  };

  const trimCsvExportRows = (rows = []) => {
    const normalizedRows = rows.map((row) => Array.isArray(row) ? row.map((value) => String(value ?? "")) : []);
    let maxColumnIndex = -1;
    let maxRowIndex = -1;
    normalizedRows.forEach((row, rowIndex) => {
      let rowHasValue = false;
      row.forEach((value, columnIndex) => {
        if (String(value || "").trim()) {
          rowHasValue = true;
          maxColumnIndex = Math.max(maxColumnIndex, columnIndex);
        }
      });
      if (rowHasValue) {
        maxRowIndex = rowIndex;
      }
    });
    const width = Math.max(1, maxColumnIndex + 1);
    return normalizedRows.slice(0, Math.max(1, maxRowIndex + 1)).map((row) =>
      Array.from({ length: width }, (_, columnIndex) => row[columnIndex] ?? "")
    );
  };

  const readSheetApiError = async (response) => {
    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || response.statusText || "Request failed";
    } catch {
      const text = await response.text().catch(() => "");
      return text || response.statusText || "Request failed";
    }
  };

  const buildWorkbookDownloadBaseName = () => {
    const baseName =
      String(workObject?.title || friendlyPathLabel(filePath) || getWorkbookActiveSheet()?.name || "hydria-sheet")
        .trim()
        .replace(/\.[^.]+$/, "")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/[^\w.-]+/g, "-") || "hydria-sheet";
    return baseName;
  };

  const buildWorkbookDownloadName = () => `${buildWorkbookDownloadBaseName()}.xlsx`;

  const downloadBlobFile = (blob, filename = "hydria-sheet.xlsx") => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const exportWorkbookAsXlsx = async () => {
    try {
      const nextModel = persistGridIntoActiveSheet();
      workbookModel = nextModel;
      const filename = buildWorkbookDownloadName();
      const response = await fetch("/api/sheets/export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          model: getWorkbookSnapshot(nextModel)
        })
      });
      if (!response.ok) {
        throw new Error(await readSheetApiError(response));
      }
      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("The XLSX export is empty.");
      }
      downloadBlobFile(blob, filename);
    } catch (error) {
      window.alert(`XLSX export failed: ${error.message || error}`);
    }
  };

  const exportCurrentSheetAsPdf = async () => {
    try {
      const nextModel = persistGridIntoActiveSheet();
      workbookModel = nextModel;
      const filename = `${buildWorkbookDownloadBaseName()}.pdf`;
      const response = await fetch("/api/sheets/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          sheetId: workbookModel.activeSheetId,
          model: getWorkbookSnapshot(nextModel)
        })
      });
      if (!response.ok) {
        throw new Error(await readSheetApiError(response));
      }
      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("The PDF export is empty.");
      }
      downloadBlobFile(blob, filename);
    } catch (error) {
      window.alert(`PDF export failed: ${error.message || error}`);
    }
  };

  const importWorkbookFromXlsxFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      clearScheduledCommit();
      editHistorySnapshot = null;
      const beforeSnapshot = getWorkbookSnapshot(persistGridIntoActiveSheet());
      const formData = new FormData();
      formData.append("workbook", file);
      const response = await fetch("/api/sheets/import-xlsx", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error(await readSheetApiError(response));
      }
      const payload = await response.json();
      if (!payload?.success || !payload.model) {
        throw new Error("The server did not return a workbook.");
      }

      workbookModel = normalizeSpreadsheetPreviewModel(payload.model, {
        defaultSheetName: profile?.sheetName || "Sheet 1"
      });
      recordSpreadsheetHistory(beforeSnapshot, workbookModel);
      const activeImportedSheet = workbookModel.activeSheet || workbookModel.sheets[0];
      saveSpreadsheetSelectionState(
        historyKey,
        {
          activeSelection: { rowIndex: 0, columnIndex: 0 },
          selectionRange: {
            startRowIndex: 0,
            startColumnIndex: 0,
            endRowIndex: 0,
            endColumnIndex: 0
          }
        },
        Math.max(1, (activeImportedSheet?.rows?.length || 0) + 1),
        Math.max(1, activeImportedSheet?.columns?.length || 1)
      );

      suppressRerenderBlurCommit = true;
      try {
        container.innerHTML = "";
        renderSpreadsheetClonePreview(container, {
          model: cloneSpreadsheetSnapshot(workbookModel),
          profile,
          workObject,
          filePath,
          onGridEdit
        });
        onGridEdit?.(workbookModel, { refreshWorkspace: false });
      } finally {
        suppressRerenderBlurCommit = false;
      }
    } catch (error) {
      window.alert(`XLSX import failed: ${error.message || error}`);
    }
  };

  const openXlsxImportDialog = () => {
    xlsxImportInput.value = "";
    xlsxImportInput.click();
  };

  xlsxImportInput.addEventListener("change", () => {
    const [file] = Array.from(xlsxImportInput.files || []);
    xlsxImportInput.value = "";
    importWorkbookFromXlsxFile(file);
  });

  const downloadActiveSheetCsv = () => {
    const nextModel = persistGridIntoActiveSheet();
    workbookModel = nextModel;
    const activeSheetState = getWorkbookActiveSheet();
    const delimiter = ";";
    const rows = trimCsvExportRows([activeSheetState.columns, ...(activeSheetState.rows || [])]);
    const csv = `sep=${delimiter}\r\n${rows.map((row) => row.map((value) => serializeCsvCell(value, delimiter)).join(delimiter)).join("\r\n")}`;
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const safeName = String(activeSheetState.name || "sheet").trim().replace(/[^\w.-]+/g, "-") || "sheet";
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const recalculateSheet = () => {
    persistGridIntoActiveSheet();
    refreshGridValues({ preserveActiveEditor: false });
  };

  const showSheetStatus = () => {
    const activeSheetState = getActiveSheetState();
    window.alert(`${activeSheetState.name || "Sheet"}\n${activeSheetState.rows.length + 1} rows\n${activeSheetState.columns.length} columns`);
  };

  const buildFindMatches = (query = "") => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    const matches = [];
    for (let rowIndex = 0; rowIndex < sheetGrid.length; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < (sheetGrid[0] || []).length; columnIndex += 1) {
        const rawValue = getRawCellValue(rowIndex, columnIndex);
        if (String(rawValue || "").toLowerCase().includes(normalizedQuery)) {
          matches.push({ rowIndex, columnIndex });
        }
      }
    }
    return matches;
  };

  const syncFindReplaceBarUi = () => {
    const matchCount = findReplaceState.matches.length;
    const hasQuery = Boolean(findReplaceState.query);
    commandSearch.classList.toggle("is-finding", hasQuery);
    commandSearch.classList.toggle("has-find-matches", hasQuery && matchCount > 0);
    commandSearchStatus.hidden = !hasQuery;
    commandSearchStatus.textContent = matchCount
      ? `${Math.min(matchCount, findReplaceState.activeMatchIndex + 1)}/${matchCount}`
      : "0";
    if (document.activeElement !== commandSearchInput && commandSearchInput.value !== findReplaceState.query) {
      commandSearchInput.value = findReplaceState.query;
    }
  };

  const syncFindReplaceMatches = ({ preserveIndex = true } = {}) => {
    const previousMatch = preserveIndex ? findReplaceState.matches[findReplaceState.activeMatchIndex] : null;
    findReplaceState.matches = buildFindMatches(findReplaceState.query);
    if (!findReplaceState.matches.length) {
      findReplaceState.activeMatchIndex = 0;
      syncFindReplaceBarUi();
      return [];
    }
    const nextIndex = previousMatch
      ? findReplaceState.matches.findIndex(
          (match) => match.rowIndex === previousMatch.rowIndex && match.columnIndex === previousMatch.columnIndex
        )
      : -1;
    findReplaceState.activeMatchIndex = nextIndex >= 0 ? nextIndex : clamp(findReplaceState.activeMatchIndex, 0, findReplaceState.matches.length - 1);
    syncFindReplaceBarUi();
    return findReplaceState.matches;
  };

  const focusFindReplaceMatch = (index = 0) => {
    if (!findReplaceState.matches.length) {
      syncFindReplaceBarUi();
      syncSelectionUi();
      return false;
    }
    findReplaceState.activeMatchIndex = ((index % findReplaceState.matches.length) + findReplaceState.matches.length) % findReplaceState.matches.length;
    const match = findReplaceState.matches[findReplaceState.activeMatchIndex];
    syncFindReplaceBarUi();
    focusKeyboardSelection(match.rowIndex, match.columnIndex);
    return true;
  };

  const stepFindReplaceMatch = (delta = 1) => {
    const matches = syncFindReplaceMatches();
    if (!matches.length) {
      return false;
    }
    return focusFindReplaceMatch(findReplaceState.activeMatchIndex + delta);
  };

  const openFindReplaceBar = ({ showReplace = false } = {}) => {
    findReplaceState.visible = true;
    findReplaceState.showReplace = showReplace || findReplaceState.showReplace;
    if (!findReplaceState.query) {
      findReplaceState.query = commandSearchInput.value.trim();
    }
    syncFindReplaceMatches({ preserveIndex: false });
    syncFindReplaceBarUi();
    window.setTimeout(() => {
      commandSearchInput.focus();
      commandSearchInput.select();
      if (showReplace) {
        promptFindReplace();
      }
    }, 0);
    return true;
  };

  const closeFindReplaceBar = () => {
    findReplaceState.visible = false;
    findReplaceState.showReplace = false;
    findReplaceState.query = "";
    findReplaceState.matches = [];
    findReplaceState.activeMatchIndex = 0;
    commandSearchInput.value = "";
    syncFindReplaceBarUi();
    syncSelectionUi();
    return true;
  };

  const replaceFirstCaseInsensitive = (source = "", query = "", replacement = "") => {
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return String(source || "").replace(pattern, replacement);
  };

  const replaceAllCaseInsensitive = (source = "", query = "", replacement = "") => {
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return String(source || "").replace(pattern, replacement);
  };

  const replaceActiveFindMatch = () => {
    if (!findReplaceState.matches.length || !findReplaceState.query) {
      return false;
    }
    const match = findReplaceState.matches[findReplaceState.activeMatchIndex];
    if (!match) {
      return false;
    }
    if (
      !ensureEditableBounds(
        {
          minRow: match.rowIndex,
          maxRow: match.rowIndex,
          minColumn: match.columnIndex,
          maxColumn: match.columnIndex
        },
        "replace text in this cell"
      )
    ) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    const currentValue = getRawCellValue(match.rowIndex, match.columnIndex);
    setRawCellValue(
      match.rowIndex,
      match.columnIndex,
      replaceFirstCaseInsensitive(currentValue, findReplaceState.query, findReplaceState.replaceValue)
    );
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    syncFindReplaceMatches();
    return focusFindReplaceMatch(findReplaceState.activeMatchIndex);
  };

  const replaceAllFindMatches = () => {
    if (!findReplaceState.query) {
      return false;
    }
    const matches = syncFindReplaceMatches({ preserveIndex: false });
    if (!matches.length) {
      return false;
    }
    clearScheduledCommit();
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    let replacedCount = 0;
    matches.forEach((match) => {
      if (
        !isBoundsEditable({
          minRow: match.rowIndex,
          maxRow: match.rowIndex,
          minColumn: match.columnIndex,
          maxColumn: match.columnIndex
        })
      ) {
        return;
      }
      const currentValue = getRawCellValue(match.rowIndex, match.columnIndex);
      const nextValue = replaceAllCaseInsensitive(currentValue, findReplaceState.query, findReplaceState.replaceValue);
      if (nextValue !== currentValue) {
        setRawCellValue(match.rowIndex, match.columnIndex, nextValue);
        replacedCount += 1;
      }
    });
    if (!replacedCount) {
      window.alert("No editable matches were replaced.");
      return false;
    }
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    syncFindReplaceMatches({ preserveIndex: false });
    return true;
  };

  const promptFindReplace = () => {
    const querySeed = commandSearchInput.value.trim() || findReplaceState.query;
    const query = window.prompt("Rechercher", querySeed);
    if (query === null || !query.trim()) {
      return false;
    }
    const replacement = window.prompt("Remplacer par", findReplaceState.replaceValue);
    if (replacement === null) {
      return false;
    }
    findReplaceState.visible = true;
    findReplaceState.showReplace = true;
    findReplaceState.query = query.trim();
    findReplaceState.replaceValue = replacement;
    commandSearchInput.value = findReplaceState.query;
    const matches = syncFindReplaceMatches({ preserveIndex: false });
    if (!matches.length) {
      refreshGridValues({ preserveActiveEditor: true });
      return false;
    }
    return replaceActiveFindMatch();
  };

  const bindFindReplaceInputs = () => {
    const runCommandSearchAction = (query = "") => {
      const normalizedQuery = String(query || "").trim().toLowerCase();
      if (!normalizedQuery) {
        return false;
      }
      const matchingTab = ribbonTabIds.find((tabId) => tabId.toLowerCase().includes(normalizedQuery));
      if (matchingTab) {
        setActiveRibbonTab(matchingTab, { visible: true });
        commandSearchInput.select();
        return true;
      }
      if (
        normalizedQuery.includes("chart") ||
        normalizedQuery.includes("graph") ||
        normalizedQuery.includes("graphique")
      ) {
        setActiveRibbonTab("Insert", { visible: true });
        commandSearchInput.select();
        return true;
      }
      if (
        normalizedQuery.includes("table") ||
        normalizedQuery.includes("tableau") ||
        normalizedQuery.includes("pivot") ||
        normalizedQuery.includes("croise")
      ) {
        setActiveRibbonTab("Insert", { visible: true });
        commandSearchInput.select();
        return true;
      }
      if (
        normalizedQuery.includes("sum") ||
        normalizedQuery.includes("somme") ||
        normalizedQuery.includes("form") ||
        normalizedQuery.includes("fonction")
      ) {
        setActiveRibbonTab("Formulas", { visible: true });
        commandSearchInput.select();
        return true;
      }
      if (
        normalizedQuery.includes("sort") ||
        normalizedQuery.includes("filter") ||
        normalizedQuery.includes("tri") ||
        normalizedQuery.includes("filtre")
      ) {
        setActiveRibbonTab("Data", { visible: true });
        commandSearchInput.select();
        return true;
      }
      return false;
    };

    commandSearchInput.addEventListener("input", (event) => {
      findReplaceState.query = event.target.value.trim();
      findReplaceState.visible = Boolean(findReplaceState.query);
      findReplaceState.showReplace = false;
      syncFindReplaceMatches({ preserveIndex: false });
      refreshGridValues({ preserveActiveEditor: true });
    });
    commandSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        findReplaceState.query = commandSearchInput.value.trim();
        findReplaceState.visible = Boolean(findReplaceState.query);
        const matches = syncFindReplaceMatches({ preserveIndex: true });
        if (matches.length) {
          const activeMatch = matches[findReplaceState.activeMatchIndex];
          const isCurrentMatch =
            activeMatch &&
            activeSelection.rowIndex === activeMatch.rowIndex &&
            activeSelection.columnIndex === activeMatch.columnIndex;
          focusFindReplaceMatch(
            isCurrentMatch
              ? findReplaceState.activeMatchIndex + (event.shiftKey ? -1 : 1)
              : findReplaceState.activeMatchIndex
          );
          return;
        }
        runCommandSearchAction(findReplaceState.query);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeFindReplaceBar();
      }
    });
  };

  let sheetMenuOutsidePointerHandler = null;
  const sheetMenuAnchors = new Set();

  const closeSheetMenu = () => {
    sheetMenuPanel.hidden = true;
    sheetMenuPanel.innerHTML = "";
    sheetMenuPanel.classList.remove("is-context-menu");
    sheetMenuPanel.classList.remove("is-chart-gallery");
    sheetMenuPanel.classList.remove("is-color-palette");
    sheetMenuPanel.classList.remove("is-table-filter");
    sheetMenuPanel.style.left = "";
    sheetMenuPanel.style.top = "";
    sheetMenuPanel.style.maxHeight = "";
    sheetMenuAnchors.forEach((button) => button.classList.remove("is-open"));
    sheetMenuAnchors.clear();
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
      sheetMenuOutsidePointerHandler = null;
    }
  };

  const disposeSheetMenu = () => {
    closeSheetMenu();
    if (sheetMenuPanel.isConnected) {
      sheetMenuPanel.remove();
    }
    if (formulaHelpPanel.isConnected) {
      formulaHelpPanel.remove();
    }
  };
  const syncRibbonPopup = () => {
    ribbonPopup.style.top = `${menuBar.offsetTop + menuBar.offsetHeight}px`;
    if (!isRibbonVisible) {
      ribbonPopup.hidden = true;
      toolbar.hidden = true;
      if (ribbonOutsidePointerHandler) {
        document.removeEventListener("mousedown", ribbonOutsidePointerHandler);
        ribbonOutsidePointerHandler = null;
      }
      return;
    }
    toolbar.hidden = false;
    ribbonPopup.hidden = false;
    if (ribbonOutsidePointerHandler) {
      document.removeEventListener("mousedown", ribbonOutsidePointerHandler);
    }
    ribbonOutsidePointerHandler = (event) => {
      if (
        !ribbonPopup.contains(event.target) &&
        !menuBar.contains(event.target) &&
        !sheetMenuPanel.contains(event.target)
      ) {
        setActiveRibbonTab(activeRibbonTab, { visible: false });
      }
    };
    window.setTimeout(() => {
      if (ribbonOutsidePointerHandler) {
        document.addEventListener("mousedown", ribbonOutsidePointerHandler);
      }
    }, 0);
  };

  const disposeRibbonPopup = () => {
    if (ribbonOutsidePointerHandler) {
      document.removeEventListener("mousedown", ribbonOutsidePointerHandler);
      ribbonOutsidePointerHandler = null;
    }
    if (ribbonPopup.isConnected) {
      ribbonPopup.remove();
    }
  };

  const makeSheetMenuItems = (menuId = "") => {
    const oneSheetOnly = workbookModel.sheets.length <= 1;
    const oneVisibleSheetOnly = getVisibleSheets().length <= 1;
    const hiddenSheets = getHiddenSheets();
    const activeSheetIndex = getActiveSheetIndex();
    const activeSheetState = getActiveSheetState();
    const hasProtectedRanges = getActiveSheetProtectedRanges().length > 0;
    const selectionHasProtectedRanges = Boolean(getProtectionConflict(getSelectionBounds())?.ranges?.length);
    switch (menuId) {
      case "File":
        return [
          { label: "Import XLSX", onSelect: openXlsxImportDialog },
          { label: "Export XLSX", onSelect: exportWorkbookAsXlsx },
          { label: "Export PDF", onSelect: exportCurrentSheetAsPdf },
          { label: "Print", onSelect: printCurrentSheet },
          { label: "Download CSV", onSelect: downloadActiveSheetCsv }
        ];
      case "Edit":
        return [
          { label: "Undo", onSelect: undoSpreadsheetAction },
          { label: "Redo", onSelect: redoSpreadsheetAction },
          { separator: true },
          { label: "Cut", onSelect: () => cutSelectedCells() },
          { label: "Copy", onSelect: () => copySelectedCells() },
          { label: "Paste", onSelect: () => pasteFromClipboard() },
          { separator: true },
          { label: "Find", onSelect: () => openFindReplaceBar() },
          { label: "Replace", onSelect: () => openFindReplaceBar({ showReplace: true }) },
          { separator: true },
          { label: "Clear contents", onSelect: clearSelectedCells },
          { label: "Fill down", onSelect: () => fillSelectionFromEdge("down") },
          { label: "Fill right", onSelect: () => fillSelectionFromEdge("right") }
        ];
      case "View":
        return [
          { label: "Zoom in", onSelect: () => adjustActiveSheetZoom(0.1) },
          { label: "Zoom out", onSelect: () => adjustActiveSheetZoom(-0.1) },
          { label: "Reset zoom", onSelect: () => setActiveSheetZoomLevel(1) },
          { label: getActiveSheetShowGridlines() ? "Hide gridlines" : "Show gridlines", onSelect: toggleActiveSheetGridlines },
          { separator: true },
          { label: "Freeze to current row", onSelect: freezeRowsToSelection },
          { label: "Freeze to current column", onSelect: freezeColumnsToSelection },
          { label: "Unfreeze", onSelect: unfreezeSheet },
          { separator: true },
          { label: "Go to A1", onSelect: () => focusKeyboardSelection(0, 0) },
          {
            label: "Go to last cell",
            onSelect: () => {
              const lastUsedCell = getLastUsedCell();
              focusKeyboardSelection(lastUsedCell.rowIndex, lastUsedCell.columnIndex);
            }
          }
        ];
      case "Insert":
        return [
          { label: "Row above", onSelect: () => insertRowAtSelection(0) },
          { label: "Row below", onSelect: () => insertRowAtSelection(1) },
          { label: "Column left", onSelect: () => insertColumnAtSelection(0) },
          { label: "Column right", onSelect: () => insertColumnAtSelection(1) },
          { separator: true },
          { label: "New sheet", onSelect: () => createSheetFromActive() },
          { label: "Tableau", onSelect: createTableFromSelection },
          { label: "Chart from selection", onSelect: createChartFromSelection },
          { label: "Tableau croise dynamique", onSelect: createPivotTableFromSelection },
          { label: "Sparkline", onSelect: addSparklineFromSelection },
          { label: "Cell note", onSelect: addOrEditActiveCellNote }
        ];
      case "Sheet":
        return [
          { label: "New sheet", onSelect: () => createSheetFromActive() },
          { label: "Duplicate sheet", onSelect: () => createSheetFromActive({ duplicate: true }) },
          { label: "Rename sheet", onSelect: renameActiveSheet },
          { label: "Delete sheet", onSelect: deleteActiveSheet, disabled: oneSheetOnly },
          { separator: true },
          { label: "Move sheet left", onSelect: () => moveActiveSheet(-1), disabled: activeSheetIndex <= 0 },
          {
            label: "Move sheet right",
            onSelect: () => moveActiveSheet(1),
            disabled: activeSheetIndex >= workbookModel.sheets.length - 1
          },
          { label: "Hide sheet", onSelect: hideActiveSheet, disabled: oneVisibleSheetOnly },
          ...(hiddenSheets.length
            ? [
                { separator: true },
                ...hiddenSheets.map((sheet) => ({
                  label: `Unhide ${sheet.name || "Sheet"}`,
                  onSelect: () => unhideSheet(sheet.id)
                }))
              ]
            : []),
          { separator: true },
          {
            label: activeSheetState.protected ? "Unprotect sheet" : "Protect sheet",
            onSelect: () => (activeSheetState.protected ? unprotectActiveSheet() : protectActiveSheet())
          },
          { label: "Protect selected range", onSelect: protectSelectionRange, disabled: activeSheetState.protected },
          {
            label: "Unprotect selected range",
            onSelect: unprotectSelectionRange,
            disabled: !selectionHasProtectedRanges
          },
          {
            label: "Clear all range protections",
            onSelect: clearActiveSheetProtectedRanges,
            disabled: !hasProtectedRanges
          }
        ];
      case "Format":
        return [
          { label: "Bold", onSelect: () => toggleSelectedTextStyle("bold") },
          { label: "Italic", onSelect: () => toggleSelectedTextStyle("italic") },
          { label: "Underline", onSelect: () => toggleSelectedTextStyle("underline") },
          { separator: true },
          { label: "Number", onSelect: () => setSelectedRangeFormat("number") },
          { label: "Currency", onSelect: () => setSelectedRangeFormat("currency") },
          { label: "Percent", onSelect: () => setSelectedRangeFormat("percent") },
          { label: "Date", onSelect: () => setSelectedRangeFormat("date") },
          { label: "Clear number format", onSelect: () => setSelectedRangeFormat("") },
          { separator: true },
          { label: "Align left", onSelect: () => setSelectedHorizontalAlign("left") },
          { label: "Align center", onSelect: () => setSelectedHorizontalAlign("center") },
          { label: "Align right", onSelect: () => setSelectedHorizontalAlign("right") },
          { label: "Align top", onSelect: () => setSelectedVerticalAlign("top") },
          { label: "Align middle", onSelect: () => setSelectedVerticalAlign("middle") },
          { label: "Align bottom", onSelect: () => setSelectedVerticalAlign("bottom") },
          { separator: true },
          { label: "Font size +", onSelect: () => adjustSelectedFontSize(1) },
          { label: "Font size -", onSelect: () => adjustSelectedFontSize(-1) },
          { label: "Text black", onSelect: () => setSelectedTextColor("#202124") },
          { label: "Text red", onSelect: () => setSelectedTextColor("#c5221f") },
          { label: "Text blue", onSelect: () => setSelectedTextColor("#1a73e8") },
          { label: "Fill yellow", onSelect: () => setSelectedFillColor("#fff2cc") },
          { label: "Fill green", onSelect: () => setSelectedFillColor("#d9ead3") },
          { label: "Fill blue", onSelect: () => setSelectedFillColor("#d9eaf7") },
          { separator: true },
          ...buildConditionalFormatMenuItems(),
          { separator: true },
          { label: "All borders", onSelect: () => setSelectedBorder("all") },
          { label: "Outer border", onSelect: () => setSelectedBorder("outer") },
          { label: "Bottom border", onSelect: () => setSelectedBorder("bottom") },
          { label: "Clear borders", onSelect: () => setSelectedBorder("clear") },
          { separator: true },
          { label: "Merge cells", onSelect: mergeSelectionRange },
          { label: "Unmerge cells", onSelect: unmergeSelectionRange },
          { separator: true },
          { label: "Clear all formatting", onSelect: clearSelectedFormatting }
        ];
      case "Data":
        return [
          { label: "Trier A-Z", icon: "sortAsc", onSelect: () => sortActiveColumn("asc") },
          { label: "Trier Z-A", icon: "sortDesc", onSelect: () => sortActiveColumn("desc") },
          { separator: true },
          { label: "Creer un filtre", icon: "filter", onSelect: filterActiveColumn },
          { label: "Filtrer par valeur selectionnee", icon: "filter", onSelect: filterBySelectedValue },
          { label: "Effacer le filtre", icon: "filterClear", onSelect: clearActiveFilter },
          { separator: true },
          { label: "Validation des donnees", icon: "checkbox", onSelect: addOrEditSelectedDataValidation },
          { label: "Effacer la validation", icon: "eraser", onSelect: clearSelectedDataValidation },
          { label: "Entourer les donnees invalides", icon: "checkbox", onSelect: showInvalidDataSummary },
          { separator: true },
          { label: "Fractionner le texte en colonnes", icon: "split", onSelect: splitTextToColumns },
          { label: "Supprimer les doublons", icon: "duplicate", onSelect: removeDuplicateRows },
          { label: "Supprimer les espaces", icon: "clean", onSelect: trimSelectedWhitespace },
          { label: "Nettoyer le texte", icon: "clean", onSelect: cleanSelectedText },
          { label: "Transposer la plage", icon: "transpose", onSelect: transposeSelectionRange },
          { separator: true },
          ...buildActiveTableDataMenuItems(),
          { separator: true },
          { label: "Actualiser les tableaux croises", icon: "pivot", onSelect: refreshActivePivotTables, disabled: !getActiveSheetPivotTables().length }
        ];
      case "Tools":
        return [
          { label: "SUM", onSelect: () => insertFormulaInActiveCell("SUM") },
          { label: "AVERAGE", onSelect: () => insertFormulaInActiveCell("AVERAGE") },
          { label: "MIN", onSelect: () => insertFormulaInActiveCell("MIN") },
          { label: "MAX", onSelect: () => insertFormulaInActiveCell("MAX") },
          { label: "COUNT", onSelect: () => insertFormulaInActiveCell("COUNT") },
          { separator: true },
          { label: "Define name", onSelect: () => createOrUpdateNamedRangeFromSelection() },
          { label: "Name manager", onSelect: showNameManager },
          { label: "Delete name", onSelect: deleteNamedRangePrompt, disabled: !getWorkbookNamedRanges().length },
          { separator: true },
          { label: "Recalculate formulas", onSelect: recalculateSheet },
          { label: "Remove sparkline", onSelect: removeActiveCellSparkline, disabled: !getCellSparkline(activeSelection.rowIndex, activeSelection.columnIndex) },
          { label: "Remove note", onSelect: removeActiveCellNote, disabled: !getCellNote(activeSelection.rowIndex, activeSelection.columnIndex) }
        ];
      case "Extensions":
        return [
          { label: "Recalculate formulas", onSelect: recalculateSheet },
          {
            label: "Clear clipboard outline",
            onSelect: () => {
              setStoredClipboardPayload(null);
              syncSelectionUi();
            }
          }
        ];
      case "Help":
        return [
          { label: "Sheet status", onSelect: showSheetStatus },
          { label: "Select used range", onSelect: selectUsedRange }
        ];
      default:
        return [];
    }
  };

  const openSheetFloatingMenu = (items = [], anchorElement = null, options = {}) => {
    if (!items.length) {
      closeSheetMenu();
      return false;
    }
    sheetMenuPanel.innerHTML = "";
    sheetMenuPanel.classList.remove("is-chart-gallery");
    sheetMenuPanel.classList.remove("is-color-palette");
    sheetMenuPanel.classList.remove("is-table-filter");
    sheetMenuPanel.classList.toggle("is-context-menu", Boolean(options.contextMenu));
    sheetMenuAnchors.forEach((button) => button.classList.remove("is-open"));
    sheetMenuAnchors.clear();
    if (anchorElement) {
      anchorElement.classList.add("is-open");
      sheetMenuAnchors.add(anchorElement);
    }
    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.className = "workspace-sheet-menu-separator";
        sheetMenuPanel.appendChild(separator);
        return;
      }
      const action = document.createElement("button");
      action.type = "button";
      action.className = "workspace-sheet-menu-action";
      const actionIcon = createSheetIconNode(item.icon || getSheetCommandIcon(item.label), {
        className: "workspace-sheet-menu-action-icon",
        label: item.label
      });
      const actionLabel = document.createElement("span");
      actionLabel.className = "workspace-sheet-menu-action-label";
      actionLabel.textContent = item.label;
      action.append(actionIcon, actionLabel);
      action.disabled = Boolean(item.disabled);
      action.addEventListener("click", () => {
        if (item.disabled) {
          return;
        }
        closeSheetMenu();
        item.onSelect?.();
      });
      sheetMenuPanel.appendChild(action);
    });
    sheetMenuPanel.hidden = false;
    const panelWidth = Math.max(190, sheetMenuPanel.offsetWidth || 220);
    const panelHeight = Math.max(120, sheetMenuPanel.offsetHeight || 240);
    const hasCursorPosition = Number.isFinite(options.clientX) && Number.isFinite(options.clientY);
    const buttonRect = anchorElement?.getBoundingClientRect?.() || null;
    const preferredLeft = hasCursorPosition ? options.clientX : buttonRect?.left || 8;
    const preferredTop = hasCursorPosition ? options.clientY : (buttonRect?.bottom || 8) + 4;
    const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - panelWidth - 8));
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - panelHeight - 8));
    sheetMenuPanel.style.left = `${left}px`;
    sheetMenuPanel.style.top = `${top}px`;
    sheetMenuPanel.style.maxHeight = `${Math.max(120, window.innerHeight - top - 8)}px`;
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
    }
    sheetMenuOutsidePointerHandler = (event) => {
      if (!sheetMenuPanel.contains(event.target) && !(anchorElement && anchorElement.contains(event.target))) {
        closeSheetMenu();
      }
    };
    window.setTimeout(() => {
      if (sheetMenuOutsidePointerHandler) {
        document.addEventListener("mousedown", sheetMenuOutsidePointerHandler);
      }
    }, 0);
    return true;
  };

  const openTableColumnMenu = (anchorElement = null, tableConfig = null, columnIndex = 0) => {
    const tableBounds = tableConfig ? getStructureBounds(tableConfig) : null;
    if (!anchorElement || !tableConfig || !tableBounds || columnIndex < tableBounds.minColumn || columnIndex > tableBounds.maxColumn) {
      closeSheetMenu();
      return false;
    }

    closeSheetMenu();
    const headerLabel = getTableHeaderLabel(tableConfig, columnIndex);
    const allValues = getTableColumnValues(tableConfig, columnIndex);
    const currentFilter = getTableColumnFilter(tableConfig, columnIndex);
    let selectedValues = new Set(currentFilter.active ? currentFilter.selectedValues : allValues);

    sheetMenuPanel.classList.add("is-table-filter");
    anchorElement.classList.add("is-open");
    sheetMenuAnchors.add(anchorElement);

    const panel = document.createElement("div");
    panel.className = "workspace-sheet-table-filter-menu";

    const addCommand = (label, onSelect, { disabled = false } = {}) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-sheet-table-filter-command";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      button.append(
        createSheetIconNode(getSheetCommandIcon(label), {
          className: "workspace-sheet-table-filter-command-icon",
          label
        }),
        labelNode
      );
      button.disabled = Boolean(disabled);
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        closeSheetMenu();
        onSelect?.();
      });
      panel.appendChild(button);
      return button;
    };

    addCommand("Trier du plus petit au plus grand", () => sortTableColumn(tableConfig, columnIndex, "asc"));
    addCommand("Trier du plus grand au plus petit", () => sortTableColumn(tableConfig, columnIndex, "desc"));
    addCommand("Trier par couleur", null, { disabled: true });
    addCommand("Tri personnalise", () => {
      const direction = window.prompt("Tri: asc ou desc", "asc");
      if (direction === null) {
        return;
      }
      sortTableColumn(tableConfig, columnIndex, String(direction).trim().toLowerCase() === "desc" ? "desc" : "asc");
    });

    const separator = document.createElement("div");
    separator.className = "workspace-sheet-menu-separator";
    panel.appendChild(separator);

    addCommand(`Effacer le filtre de "${headerLabel}"`, () => clearTableColumnFilter(tableConfig, columnIndex), {
      disabled: !isTableColumnFilterActive(tableConfig, columnIndex)
    });

    const totalSeparator = document.createElement("div");
    totalSeparator.className = "workspace-sheet-menu-separator";
    panel.appendChild(totalSeparator);

    ["sum", "average", "count", "min", "max", "none"].forEach((functionName) => {
      addCommand(
        `Total: ${SPREADSHEET_TABLE_TOTAL_LABELS[functionName] || functionName}`,
        () => setTableColumnTotalFunction(tableConfig, columnIndex, functionName),
        { disabled: columnIndex <= tableBounds.minColumn }
      );
    });

    const filterSeparator = document.createElement("div");
    filterSeparator.className = "workspace-sheet-menu-separator";
    panel.appendChild(filterSeparator);

    const search = document.createElement("input");
    search.type = "search";
    search.className = "workspace-sheet-table-filter-search";
    search.placeholder = "Recherche";
    search.value = currentFilter.query || "";
    panel.appendChild(search);

    const valuesHost = document.createElement("div");
    valuesHost.className = "workspace-sheet-table-filter-values";
    panel.appendChild(valuesHost);

    const applyRow = document.createElement("div");
    applyRow.className = "workspace-sheet-table-filter-actions";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "workspace-sheet-table-filter-apply";
    applyButton.textContent = "Appliquer";
    applyButton.addEventListener("click", () => {
      closeSheetMenu();
      setTableColumnFilter(tableConfig, columnIndex, allValues.filter((value) => selectedValues.has(value)));
    });
    applyRow.appendChild(applyButton);
    panel.appendChild(applyRow);

    const renderValueChecks = () => {
      valuesHost.innerHTML = "";
      const query = search.value.trim().toLowerCase();
      const visibleValues = allValues.filter((value) => String(value || "(vide)").toLowerCase().includes(query));

      const selectAllLabel = document.createElement("label");
      selectAllLabel.className = "workspace-sheet-table-filter-check is-select-all";
      const selectAll = document.createElement("input");
      selectAll.type = "checkbox";
      selectAll.checked = visibleValues.length > 0 && visibleValues.every((value) => selectedValues.has(value));
      selectAll.indeterminate =
        visibleValues.some((value) => selectedValues.has(value)) &&
        !visibleValues.every((value) => selectedValues.has(value));
      selectAll.addEventListener("change", () => {
        visibleValues.forEach((value) => {
          if (selectAll.checked) {
            selectedValues.add(value);
          } else {
            selectedValues.delete(value);
          }
        });
        renderValueChecks();
      });
      const selectAllText = document.createElement("span");
      selectAllText.textContent = "Selectionner tout";
      selectAllLabel.append(selectAll, selectAllText);
      valuesHost.appendChild(selectAllLabel);

      visibleValues.forEach((value) => {
        const label = document.createElement("label");
        label.className = "workspace-sheet-table-filter-check";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedValues.has(value);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedValues.add(value);
          } else {
            selectedValues.delete(value);
          }
          renderValueChecks();
        });
        const valueText = document.createElement("span");
        valueText.textContent = value || "(vide)";
        label.append(checkbox, valueText);
        valuesHost.appendChild(label);
      });

      if (!visibleValues.length) {
        const empty = document.createElement("span");
        empty.className = "workspace-sheet-table-filter-empty tiny";
        empty.textContent = "Aucune valeur";
        valuesHost.appendChild(empty);
      }
    };
    search.addEventListener("input", renderValueChecks);
    renderValueChecks();

    sheetMenuPanel.appendChild(panel);
    sheetMenuPanel.hidden = false;
    const panelWidth = Math.max(280, sheetMenuPanel.offsetWidth || 300);
    const panelHeight = Math.max(360, sheetMenuPanel.offsetHeight || 420);
    const buttonRect = anchorElement.getBoundingClientRect();
    const left = Math.max(8, Math.min(buttonRect.left, window.innerWidth - panelWidth - 8));
    const top = Math.max(8, Math.min(buttonRect.bottom + 4, window.innerHeight - panelHeight - 8));
    sheetMenuPanel.style.left = `${left}px`;
    sheetMenuPanel.style.top = `${top}px`;
    sheetMenuPanel.style.maxHeight = `${Math.max(260, window.innerHeight - top - 8)}px`;
    sheetMenuOutsidePointerHandler = (event) => {
      if (!sheetMenuPanel.contains(event.target) && !anchorElement.contains(event.target)) {
        closeSheetMenu();
      }
    };
    window.setTimeout(() => document.addEventListener("mousedown", sheetMenuOutsidePointerHandler), 0);
    search.focus({ preventScroll: true });
    return true;
  };

  const openChartGalleryMenu = (anchorElement = null) => {
    if (!anchorElement) {
      closeSheetMenu();
      return false;
    }
    sheetMenuPanel.innerHTML = "";
    sheetMenuPanel.classList.remove("is-context-menu");
    sheetMenuPanel.classList.add("is-chart-gallery");
    sheetMenuAnchors.forEach((button) => button.classList.remove("is-open"));
    sheetMenuAnchors.clear();
    anchorElement.classList.add("is-open");
    sheetMenuAnchors.add(anchorElement);

    const gallery = document.createElement("div");
    gallery.className = "workspace-sheet-chart-gallery";
    SPREADSHEET_CHART_GALLERY_SECTIONS.forEach((section) => {
      const sectionNode = document.createElement("section");
      sectionNode.className = "workspace-sheet-chart-gallery-section";
      const title = document.createElement("strong");
      title.className = "workspace-sheet-chart-gallery-title";
      title.textContent = section.label;
      const grid = document.createElement("div");
      grid.className = "workspace-sheet-chart-gallery-grid";
      section.items.forEach((chartType) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workspace-sheet-chart-gallery-item";
        button.title = chartType.label;
        const preview = document.createElement("div");
        preview.className = "workspace-sheet-chart-gallery-preview";
        preview.appendChild(
          renderSpreadsheetChartGraphic(getChartPreviewModel(chartType.kind), { preview: true })
        );
        const label = document.createElement("span");
        label.className = "workspace-sheet-chart-gallery-label";
        label.textContent = chartType.label;
        button.append(preview, label);
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        button.addEventListener("click", () => {
          closeSheetMenu();
          createChartFromSelection(chartType.kind);
        });
        grid.appendChild(button);
      });
      sectionNode.append(title, grid);
      gallery.appendChild(sectionNode);
    });
    sheetMenuPanel.appendChild(gallery);

    const buttonRect = anchorElement.getBoundingClientRect();
    sheetMenuPanel.hidden = false;
    const panelWidth = Math.max(520, sheetMenuPanel.offsetWidth || 640);
    const panelHeight = Math.max(320, sheetMenuPanel.offsetHeight || 420);
    const left = Math.max(8, Math.min(buttonRect.left, window.innerWidth - panelWidth - 8));
    const top = Math.max(8, Math.min(buttonRect.bottom + 6, window.innerHeight - panelHeight - 8));
    const maxPanelHeight = Math.max(220, window.innerHeight - top - 8);
    sheetMenuPanel.style.left = `${left}px`;
    sheetMenuPanel.style.top = `${top}px`;
    sheetMenuPanel.style.maxHeight = `${maxPanelHeight}px`;
    gallery.style.maxHeight = `${Math.max(180, maxPanelHeight - 20)}px`;
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
    }
    sheetMenuOutsidePointerHandler = (event) => {
      if (!sheetMenuPanel.contains(event.target) && !anchorElement.contains(event.target)) {
        closeSheetMenu();
      }
    };
    window.setTimeout(() => {
      if (sheetMenuOutsidePointerHandler) {
        document.addEventListener("mousedown", sheetMenuOutsidePointerHandler);
      }
    }, 0);
    return true;
  };

  const toggleChartGalleryMenu = (anchorElement = null) => {
    if (!anchorElement) {
      return false;
    }
    if (
      !sheetMenuPanel.hidden &&
      sheetMenuPanel.classList.contains("is-chart-gallery") &&
      anchorElement.classList.contains("is-open")
    ) {
      closeSheetMenu();
      return false;
    }
    return openChartGalleryMenu(anchorElement);
  };

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-sheet-toolbar";
  const resolveToolbarDisabled = (disabled = false) => (typeof disabled === "function" ? Boolean(disabled()) : Boolean(disabled));
  const sheetIconSvg = {
    alignBottom: '<path d="M5 19h14"/><path d="M8 5h8v10H8z"/>',
    alignCenter: '<path d="M4 7h16"/><path d="M7 12h10"/><path d="M4 17h16"/>',
    alignLeft: '<path d="M4 6h16"/><path d="M4 11h10"/><path d="M4 16h16"/><path d="M4 21h10"/>',
    alignMiddle: '<path d="M4 12h16"/><path d="M8 5h8v14H8z"/>',
    alignRight: '<path d="M4 6h16"/><path d="M10 11h10"/><path d="M4 16h16"/><path d="M10 21h10"/>',
    alignTop: '<path d="M5 5h14"/><path d="M8 9h8v10H8z"/>',
    areaChart: '<path d="M4 18l5-7 4 3 4-8 3 12H4z"/><path d="M4 20h16"/>',
    barChart: '<path d="M4 19h16"/><path d="M6 16h3"/><path d="M6 11h8"/><path d="M6 6h12"/>',
    bold: '<path d="M7 5h6a3 3 0 0 1 0 6H7z"/><path d="M7 11h7a4 4 0 0 1 0 8H7z"/>',
    border: '<rect x="5" y="5" width="14" height="14"/><path d="M5 12h14"/><path d="M12 5v14"/>',
    calendar: '<path d="M7 3v4"/><path d="M17 3v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/>',
    chart: '<path d="M4 19h16"/><rect x="6" y="10" width="3" height="7"/><rect x="11" y="5" width="3" height="12"/><rect x="16" y="8" width="3" height="9"/>',
    checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 6-7"/>',
    chevronDown: '<path d="M7 10l5 5 5-5"/>',
    chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
    chevronRight: '<path d="M9 18l6-6-6-6"/>',
    chevronUp: '<path d="M7 14l5-5 5 5"/>',
    clean: '<path d="M4 20h16"/><path d="M8 17l8-8"/><path d="M10 5l9 9"/><path d="M5 16l3 3"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/>',
    csv: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 15h8"/><path d="M8 18h5"/>',
    currency: '<path d="M17 5.5A6.5 6.5 0 1 0 17 18.5"/><path d="M5 10h9"/><path d="M5 14h9"/>',
    cut: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 8l12 12"/><path d="M8 16L20 4"/>',
    delete: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M8 7l1 13h6l1-13"/>',
    duplicate: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
    eraser: '<path d="M4 16l8-8 6 6-5 5H7z"/><path d="M12 19h8"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.5 5.3A9.8 9.8 0 0 1 12 5c5 0 8 4 9 7a12 12 0 0 1-2.4 3.7"/><path d="M6.1 6.8A12 12 0 0 0 3 12c1 3 4 7 9 7a9.8 9.8 0 0 0 3.5-.6"/>',
    fileSpreadsheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 12h9"/><path d="M8 16h9"/><path d="M11 9v10"/>',
    fill: '<path d="M4 14l7-7 7 7-5 5H9z"/><path d="M14 19h6"/><path d="M16 14l3 3 2-2"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    filterClear: '<path d="M4 5h13l-5 6v5l-3 2v-7z"/><path d="M16 14l5 5"/><path d="M21 14l-5 5"/>',
    freeze: '<path d="M5 5h14v14H5z"/><path d="M5 10h14"/><path d="M10 5v14"/>',
    function: '<path d="M8 19c2-6 3-10 4-14"/><path d="M5 9h8"/><path d="M14 13l5 5"/><path d="M19 13l-5 5"/>',
    grid: '<rect x="4" y="4" width="16" height="16"/><path d="M4 10h16"/><path d="M4 16h16"/><path d="M10 4v16"/><path d="M16 4v16"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 18l5-5 3 3 2-2 4 4"/>',
    insert: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    italic: '<path d="M10 5h8"/><path d="M6 19h8"/><path d="M14 5l-4 14"/>',
    lineChart: '<path d="M4 18l5-6 4 3 6-8"/><path d="M4 20h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    merge: '<rect x="4" y="7" width="16" height="10" rx="1"/><path d="M9 7v10"/><path d="M15 7v10"/><path d="M8 12h8"/><path d="M13 9l3 3-3 3"/><path d="M11 9l-3 3 3 3"/>',
    move: '<path d="M12 3v18"/><path d="M3 12h18"/><path d="M8 7l4-4 4 4"/><path d="M8 17l4 4 4-4"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/>',
    note: '<path d="M5 4h14v12l-5 5H5z"/><path d="M14 16v5"/><path d="M14 16h5"/>',
    number: '<path d="M8 4L6 20"/><path d="M16 4l-2 16"/><path d="M4 9h16"/><path d="M3 15h16"/>',
    palette: '<path d="M12 4a8 8 0 0 0 0 16h1.5a1.8 1.8 0 0 0 .5-3.5 1.7 1.7 0 0 1 .5-3.3H16a4 4 0 0 0 0-8.1A9.8 9.8 0 0 0 12 4z"/><circle cx="8.5" cy="10" r=".8"/><circle cx="11" cy="7.8" r=".8"/><circle cx="14" cy="8.5" r=".8"/>',
    paste: '<path d="M8 4h8v4H8z"/><path d="M6 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 16h3"/><path d="M8 13h8"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
    pieChart: '<path d="M11 3v9h9a9 9 0 1 1-9-9z"/><path d="M13 3.2A9 9 0 0 1 20.8 10H13z"/>',
    pivot: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/><path d="M10 5v14"/><path d="M14 14h4"/><path d="M16 12v4"/><path d="M6 7.5h2"/><path d="M12 7.5h6"/>',
    print: '<path d="M7 8V4h10v4"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>',
    redo: '<path d="M15 7h5v5"/><path d="M20 7c-2.8-2.8-7.2-3-10.2-.4-3.1 2.7-3.2 7.4-.3 10.2 2.1 2.1 5.2 2.7 7.8 1.5"/>',
    rename: '<path d="M4 20h16"/><path d="M13 5l6 6-8 8H5v-6z"/><path d="M16 8l-8 8"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l4 4"/>',
    shape: '<rect x="4" y="9" width="8" height="8" rx="1"/><circle cx="16" cy="9" r="4"/><path d="M15 14l5 6h-10z"/>',
    sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 12h8"/><path d="M8 16h8"/>',
    slicer: '<path d="M4 5h16"/><path d="M7 10h10"/><path d="M9 15h6"/><path d="M11 20h2"/>',
    sort: '<path d="M8 5v14"/><path d="M5 8l3-3 3 3"/><path d="M16 19V5"/><path d="M13 16l3 3 3-3"/>',
    sortAsc: '<path d="M8 5v14"/><path d="M5 8l3-3 3 3"/><path d="M14 7h6"/><path d="M14 12h4"/><path d="M14 17h2"/>',
    sortDesc: '<path d="M8 19V5"/><path d="M5 16l3 3 3-3"/><path d="M14 7h2"/><path d="M14 12h4"/><path d="M14 17h6"/>',
    sparkline: '<path d="M4 17l4-5 3 3 5-8 4 6"/><path d="M4 20h16"/>',
    split: '<path d="M4 6h16"/><path d="M4 12h7"/><path d="M4 18h16"/><path d="M15 9l3 3-3 3"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/><path d="M9 5v14"/><path d="M15 5v14"/>',
    text: '<path d="M4 6h16"/><path d="M12 6v14"/><path d="M8 20h8"/>',
    textColor: '<path d="M6 19h12"/><path d="M9 15l3-10 3 10"/><path d="M10 12h4"/>',
    transpose: '<path d="M5 5h7v7H5z"/><path d="M12 12h7v7h-7z"/><path d="M15 5h4v4"/><path d="M19 5l-6 6"/><path d="M9 19H5v-4"/><path d="M5 19l6-6"/>',
    underline: '<path d="M7 5v6a5 5 0 0 0 10 0V5"/><path d="M5 21h14"/>',
    undo: '<path d="M9 7H4v5"/><path d="M4 7c2.8-2.8 7.2-3 10.2-.4 3.1 2.7 3.2 7.4.3 10.2-2.1 2.1-5.2 2.7-7.8 1.5"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l4 4"/><path d="M10.5 7v7"/><path d="M7 10.5h7"/>'
  };

  const getSheetCommandIcon = (label = "") => {
    const text = String(label || "").trim().toLowerCase();
    if (!text) {
      return "";
    }
    if (text.includes("more")) return "chevronDown";
    if (text.includes("validation") || text.includes("invalid")) return "checkbox";
    if (text.includes("conditional") || text.includes("conditionnel")) return "palette";
    if (text.includes("style") || text.includes("couleur") || text.includes("color")) return "palette";
    if (text === "undo") return "undo";
    if (text === "redo") return "redo";
    if (text.includes("paste")) return "paste";
    if (text.includes("cut")) return "cut";
    if (text.includes("copy")) return "copy";
    if (text.includes("fill")) return "fill";
    if (text === "b" || text.includes("bold")) return "bold";
    if (text === "i" || text.includes("italic")) return "italic";
    if (text === "u" || text.includes("underline")) return "underline";
    if (text.includes("border")) return "border";
    if (text.includes("left")) return text.includes("move") ? "chevronLeft" : "alignLeft";
    if (text.includes("right")) return text.includes("move") ? "chevronRight" : "alignRight";
    if (text.includes("center")) return "alignCenter";
    if (text.includes("middle")) return "alignMiddle";
    if (text.includes("top")) return "alignTop";
    if (text.includes("bottom")) return "alignBottom";
    if (text.includes("merge")) return "merge";
    if (text.includes("croise") || text.includes("pivot")) return "pivot";
    if (text.includes("table") || text.includes("tableau")) return "table";
    if (text.includes("image")) return "image";
    if (text.includes("shape") || text.includes("forms") || text.includes("forme")) return "shape";
    if (text.includes("checkbox") || text.includes("case")) return "checkbox";
    if (text.includes("number") || text === "123") return "number";
    if (text.includes("text")) return "textColor";
    if (text.includes("currency") || text === "eur") return "currency";
    if (text.includes("percent") || text === "%") return "percent";
    if (text.includes("date") || text.includes("calendar")) return "calendar";
    if (text.includes("insert") || text.includes("new") || text === "+") return "insert";
    if (text.includes("clear filter")) return "filterClear";
    if (text.includes("duplicate") || text.includes("dedupe")) return "duplicate";
    if (text.includes("delete") || text.includes("remove") || text.includes("clear") || text.includes("effacer")) return "eraser";
    if (text.includes("area")) return "areaChart";
    if (text.includes("pie") || text.includes("donut") || text.includes("secteur")) return "pieChart";
    if (text.includes("line") || text.includes("courbe")) return "lineChart";
    if (text.includes("bar")) return "barChart";
    if (text.includes("chart") || text.includes("graph")) return "chart";
    if (text.includes("slicer")) return "slicer";
    if (text.includes("filter") || text.includes("filtre")) return "filter";
    if (text.includes("z-a") || text.includes("desc") || text.includes("grand au plus petit")) return "sortDesc";
    if (text.includes("a-z") || text.includes("asc") || text.includes("petit au plus grand")) return "sortAsc";
    if (text.includes("sort") || text.includes("tri") || text.includes("trier")) return "sort";
    if (text.includes("sum") || text.includes("avg") || text.includes("min") || text.includes("max") || text.includes("count") || text.includes("function") || text.includes("subtotal")) return "function";
    if (text.includes("lookup") || text.includes("go to") || text.includes("find") || text.includes("search") || text.includes("recherche")) return "search";
    if (text.includes("protect")) return "lock";
    if (text.includes("print")) return "print";
    if (text.includes("pdf")) return "pdf";
    if (text.includes("xlsx") || text.includes("csv") || text.includes("import") || text.includes("export") || text.includes("download")) return text.includes("csv") ? "csv" : "fileSpreadsheet";
    if (text.includes("zoom")) return "zoom";
    if (text.includes("grid")) return "grid";
    if (text.includes("freeze")) return "freeze";
    if (text.includes("note")) return "note";
    if (text.includes("sparkline")) return "sparkline";
    if (text.includes("sheet")) return "sheet";
    if (text.includes("name") || text.includes("nom")) return "text";
    if (text.includes("trim") || text.includes("clean")) return "clean";
    if (text.includes("split")) return "split";
    if (text.includes("transpose")) return "transpose";
    if (text.includes("rename") || text.includes("renommer")) return "rename";
    if (text.includes("hide") || text.includes("unhide")) return "eyeOff";
    if (text.includes("move")) return "move";
    return "sheet";
  };

  const createSheetIconNode = (iconName = "", { className = "workspace-sheet-command-icon", label = "" } = {}) => {
    const key = sheetIconSvg[iconName] ? iconName : getSheetCommandIcon(iconName || label);
    const icon = document.createElement("span");
    icon.className = className;
    icon.setAttribute("aria-hidden", "true");
    if (!sheetIconSvg[key]) {
      icon.textContent = String(label || iconName || "").slice(0, 2).toUpperCase();
      icon.classList.add("is-text-icon");
      return icon;
    }
    icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${sheetIconSvg[key]}</svg>`;
    return icon;
  };
  const makeToolbarButton = (label, onClick, accent = false, { large = false, menu = false, disabled = false, title = "", icon = "", iconOnly = false } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-sheet-toolbar-button${accent ? " accent" : ""}${large ? " large" : ""}${menu ? " menu" : ""}${iconOnly ? " icon-only" : ""}`;
    button.title = title || (iconOnly ? label : "");
    button.setAttribute("aria-label", title || label);
    const toolbarIconName = icon || getSheetCommandIcon(label);
    if (!(menu && toolbarIconName === "chevronDown")) {
      button.appendChild(
        createSheetIconNode(toolbarIconName, {
          className: "workspace-sheet-toolbar-icon",
          label
        })
      );
    }
    const labelSpan = document.createElement("span");
    labelSpan.className = "workspace-sheet-toolbar-button-label";
    labelSpan.textContent = label;
    button.appendChild(labelSpan);
    if (menu) {
      button.appendChild(
        createSheetIconNode("chevronDown", {
          className: "workspace-sheet-toolbar-chevron",
          label: "Open menu"
        })
      );
    }
    button.disabled = resolveToolbarDisabled(disabled);
    ["pointerdown", "mousedown"].forEach((eventName) => {
      button.addEventListener(eventName, (event) => {
        if (button.disabled) {
          return;
        }
        event.preventDefault();
      });
    });
    button.addEventListener("click", (event) => {
      if (button.disabled) {
        return;
      }
      onClick?.(event, button);
    });
    return button;
  };
  const makeToolbarMenuButton = (label, items, options = {}) => {
    let button = null;
    button = makeToolbarButton(
      label,
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!sheetMenuPanel.hidden && button.classList.contains("is-open")) {
          closeSheetMenu();
          return;
        }
        const nextItems = (typeof items === "function" ? items() : items) || [];
        openSheetFloatingMenu(nextItems.filter(Boolean), button);
      },
      options.accent,
      { ...options, menu: true }
    );
    return button;
  };
  const makeToolbarSelect = (label = "", options = [], onChange = null, { value = "", control = "" } = {}) => {
    const select = document.createElement("select");
    select.className = "workspace-sheet-toolbar-select";
    select.title = label;
    if (control) {
      select.dataset.toolbarControl = control;
    }
    options.forEach((option) => {
      const entry = document.createElement("option");
      entry.value = option.value;
      entry.textContent = option.label;
      select.appendChild(entry);
    });
    if (value && !Array.from(select.options).some((option) => option.value === value)) {
      const entry = document.createElement("option");
      entry.value = value;
      entry.textContent = value;
      select.appendChild(entry);
    }
    select.value = value;
    select.addEventListener("change", () => {
      onChange?.(select.value);
    });
    return select;
  };
  const themeColorRows = [
    ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"],
    ["#f2f2f2", "#7f7f7f", "#d9d9d9", "#d6dce4", "#d9e2f3", "#fce4d6", "#ededed", "#fff2cc", "#ddebf7", "#e2f0d9"],
    ["#d9d9d9", "#595959", "#bfbfbf", "#adb9ca", "#b4c6e7", "#f8cbad", "#dbdbdb", "#ffe699", "#bdd7ee", "#c6e0b4"],
    ["#bfbfbf", "#404040", "#a6a6a6", "#8497b0", "#8eaadb", "#f4b183", "#c9c9c9", "#ffd966", "#9dc3e6", "#a9d18e"],
    ["#a6a6a6", "#262626", "#808080", "#323e4f", "#2f5597", "#c55a11", "#7f7f7f", "#bf9000", "#2e75b6", "#548235"],
    ["#808080", "#0d0d0d", "#595959", "#222a35", "#1f3864", "#833c0c", "#595959", "#7f6000", "#1f4e79", "#375623"]
  ];
  const standardColors = ["#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];
  const getActiveTextColorValue = () => getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).textColor || "#202124";
  const getActiveFillColorValue = () => getCellFormat(activeSelection.rowIndex, activeSelection.columnIndex).fillColor || "";
  const applyToolbarColor = (kind = "text", color = "") => {
    if (kind === "fill") {
      setSelectedFillColor(color);
      return;
    }
    setSelectedTextColor(color);
  };
  const getToolbarColorValue = (kind = "text") =>
    kind === "fill" ? getActiveFillColorValue() : getActiveTextColorValue();
  const syncToolbarColorButton = (button, color = "", kind = "text") => {
    if (!button) {
      return;
    }
    const normalizedColor = normalizeSpreadsheetColor(color);
    const swatch = button.querySelector(".workspace-sheet-toolbar-color-swatch");
    if (swatch) {
      swatch.style.background = normalizedColor || "transparent";
      swatch.classList.toggle("is-empty", !normalizedColor);
    }
    button.dataset.currentColor = normalizedColor || "";
    button.setAttribute(
      "aria-label",
      kind === "fill"
        ? `Fill color ${normalizedColor || "none"}`
        : `Text color ${normalizedColor || "automatic"}`
    );
  };
  const openNativeColorPicker = (kind = "text", initialColor = "") => {
    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "workspace-sheet-native-color-input";
    picker.value = normalizeSpreadsheetColor(initialColor) || (kind === "fill" ? "#fff2cc" : "#202124");
    picker.addEventListener(
      "change",
      () => {
        applyToolbarColor(kind, picker.value);
        closeSheetMenu();
        picker.remove();
      },
      { once: true }
    );
    picker.addEventListener("blur", () => window.setTimeout(() => picker.remove(), 1000), { once: true });
    previewShell.appendChild(picker);
    picker.click();
  };
  const openNativeBorderColorPicker = (initialColor = "") => {
    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "workspace-sheet-native-color-input";
    picker.value = normalizeSpreadsheetColor(initialColor) || getActiveBorderColorValue();
    picker.addEventListener(
      "change",
      () => {
        setSelectedBorderColor(picker.value);
        closeContextMenu();
        closeSheetMenu();
        picker.remove();
      },
      { once: true }
    );
    picker.addEventListener("blur", () => window.setTimeout(() => picker.remove(), 1000), { once: true });
    previewShell.appendChild(picker);
    picker.click();
  };
  const pickColorWithEyedropper = (kind = "text", initialColor = "") => {
    if (window.EyeDropper) {
      closeSheetMenu();
      new window.EyeDropper()
        .open()
        .then((result) => {
          if (result?.sRGBHex) {
            applyToolbarColor(kind, result.sRGBHex);
          }
        })
        .catch(() => {});
      return;
    }
    openNativeColorPicker(kind, initialColor);
  };
  const makeColorSwatchButton = (color = "", kind = "text") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-color-swatch";
    button.title = color;
    button.style.background = color;
    button.addEventListener("click", () => {
      applyToolbarColor(kind, color);
      closeSheetMenu();
    });
    return button;
  };
  const makeColorPaletteAction = (label = "", icon = "", onSelect = null) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-color-action";
    const iconNode = document.createElement("span");
    iconNode.className = "workspace-sheet-color-action-icon";
    iconNode.textContent = icon;
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    button.append(iconNode, labelNode);
    button.addEventListener("click", () => onSelect?.());
    return button;
  };
  const openColorPaletteMenu = (kind = "text", anchorElement = null) => {
    if (!anchorElement) {
      closeSheetMenu();
      return false;
    }
    const currentColor = getToolbarColorValue(kind);
    sheetMenuPanel.innerHTML = "";
    sheetMenuPanel.classList.remove("is-context-menu", "is-chart-gallery");
    sheetMenuPanel.classList.add("is-color-palette");
    sheetMenuAnchors.forEach((button) => button.classList.remove("is-open"));
    sheetMenuAnchors.clear();
    anchorElement.classList.add("is-open");
    sheetMenuAnchors.add(anchorElement);

    const title = document.createElement("strong");
    title.className = "workspace-sheet-color-title";
    title.textContent = "Couleurs du theme";
    const themeGrid = document.createElement("div");
    themeGrid.className = "workspace-sheet-color-grid";
    themeColorRows.flat().forEach((color) => themeGrid.appendChild(makeColorSwatchButton(color, kind)));

    const standardTitle = document.createElement("strong");
    standardTitle.className = "workspace-sheet-color-title";
    standardTitle.textContent = "Couleurs standard";
    const standardGrid = document.createElement("div");
    standardGrid.className = "workspace-sheet-color-grid is-standard";
    standardColors.forEach((color) => standardGrid.appendChild(makeColorSwatchButton(color, kind)));

    const clearAction = makeColorPaletteAction(
      kind === "fill" ? "Aucun remplissage" : "Automatique",
      kind === "fill" ? "/" : "A",
      () => {
        applyToolbarColor(kind, "");
        closeSheetMenu();
      }
    );
    const customAction = makeColorPaletteAction("Autres couleurs...", "+", () => openNativeColorPicker(kind, currentColor));
    const eyedropperAction = makeColorPaletteAction("Pipette", "P", () => pickColorWithEyedropper(kind, currentColor));
    sheetMenuPanel.append(title, themeGrid, standardTitle, standardGrid, clearAction, customAction, eyedropperAction);

    sheetMenuPanel.hidden = false;
    const panelWidth = Math.max(300, sheetMenuPanel.offsetWidth || 300);
    const panelHeight = Math.max(280, sheetMenuPanel.offsetHeight || 360);
    const buttonRect = anchorElement.getBoundingClientRect();
    const preferredLeft = buttonRect.left;
    const preferredTop = buttonRect.bottom + 4;
    const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - panelWidth - 8));
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - panelHeight - 8));
    sheetMenuPanel.style.left = `${left}px`;
    sheetMenuPanel.style.top = `${top}px`;
    sheetMenuPanel.style.maxHeight = `${Math.max(160, window.innerHeight - top - 8)}px`;
    if (sheetMenuOutsidePointerHandler) {
      document.removeEventListener("mousedown", sheetMenuOutsidePointerHandler);
    }
    sheetMenuOutsidePointerHandler = (event) => {
      if (!sheetMenuPanel.contains(event.target) && !anchorElement.contains(event.target)) {
        closeSheetMenu();
      }
    };
    window.setTimeout(() => {
      if (sheetMenuOutsidePointerHandler) {
        document.addEventListener("mousedown", sheetMenuOutsidePointerHandler);
      }
    }, 0);
    return true;
  };
  const makeToolbarColorButton = (label = "", kind = "text") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-sheet-toolbar-color-button is-${kind}`;
    button.title = label;
    button.dataset.toolbarControl = `${kind}-color`;
    const glyph = document.createElement("span");
    glyph.className = "workspace-sheet-toolbar-color-glyph";
    glyph.textContent = kind === "fill" ? "F" : "A";
    const swatch = document.createElement("span");
    swatch.className = "workspace-sheet-toolbar-color-swatch";
    button.append(glyph, swatch);
    syncToolbarColorButton(button, getToolbarColorValue(kind), kind);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sheetMenuPanel.hidden && button.classList.contains("is-open")) {
        closeSheetMenu();
        return;
      }
      openColorPaletteMenu(kind, button);
    });
    return button;
  };
  const buildFontSizeOptions = () => {
    const activeFontSize = getActiveSelectionFontSizeValue();
    const fontSizes = ["8", "9", "10", "11", "12", "14", "16", "18", "24", "36"];
    if (!fontSizes.includes(activeFontSize)) {
      fontSizes.push(activeFontSize);
    }
    return fontSizes
      .sort((left, right) => Number(left) - Number(right))
      .map((fontSize) => ({ value: fontSize, label: fontSize }));
  };
  const syncToolbarFormatControls = () => {
    const fontSizeSelect = toolbar.querySelector('[data-toolbar-control="font-size"]');
    if (fontSizeSelect) {
      const activeFontSize = getActiveSelectionFontSizeValue();
      if (!Array.from(fontSizeSelect.options).some((option) => option.value === activeFontSize)) {
        const entry = document.createElement("option");
        entry.value = activeFontSize;
        entry.textContent = activeFontSize;
        fontSizeSelect.appendChild(entry);
      }
      fontSizeSelect.value = activeFontSize;
    }
    syncToolbarColorButton(
      toolbar.querySelector('[data-toolbar-control="text-color"]'),
      getActiveTextColorValue(),
      "text"
    );
    syncToolbarColorButton(
      toolbar.querySelector('[data-toolbar-control="fill-color"]'),
      getActiveFillColorValue(),
      "fill"
    );
  };
  const makeToolbarRow = (...controls) => {
    const row = document.createElement("div");
    row.className = "workspace-sheet-toolbar-row";
    row.append(...controls.filter(Boolean));
    return row;
  };
  const makeToolbarStack = (...controls) => {
    const stack = document.createElement("div");
    stack.className = "workspace-sheet-toolbar-stack";
    stack.append(...controls.filter(Boolean));
    return stack;
  };
  const makeToolbarGroup = (label = "", ...controls) => {
    const group = document.createElement("section");
    group.className = "workspace-sheet-toolbar-group";
    const body = document.createElement("div");
    body.className = "workspace-sheet-toolbar-group-body";
    body.append(...controls.filter(Boolean));
    const caption = document.createElement("span");
    caption.className = "workspace-sheet-toolbar-group-label tiny";
    caption.textContent = label;
    group.append(body, caption);
    return group;
  };
  const syncRibbonTabsUi = () => {
    sheetMenuButtons.forEach((button, tabId) => {
      const isActive = isRibbonVisible && tabId === activeRibbonTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };
  const buildBorderStyleMenuItems = () =>
    Object.entries(SPREADSHEET_BORDER_STYLE_LABELS).map(([style, label]) => ({
      label,
      icon: "border",
      onSelect: () => setSelectedBorderStyle(style)
    }));
  const buildBorderColorMenuItems = () => [
    { label: "Noir", icon: "border", onSelect: () => setSelectedBorderColor("#202124") },
    { label: "Gris", icon: "border", onSelect: () => setSelectedBorderColor("#7f7f7f") },
    { label: "Bleu", icon: "border", onSelect: () => setSelectedBorderColor("#1a73e8") },
    { label: "Vert", icon: "border", onSelect: () => setSelectedBorderColor("#188038") },
    { label: "Rouge", icon: "border", onSelect: () => setSelectedBorderColor("#c5221f") },
    { label: "Orange", icon: "border", onSelect: () => setSelectedBorderColor("#ed7d31") }
  ];
  const buildBorderMenuItems = () => [
    { label: "Aucune bordure", icon: "eraser", onSelect: () => setSelectedBorder("clear") },
    { label: "Toutes les bordures", icon: "border", onSelect: () => setSelectedBorder("all") },
    { label: "Bordures exterieures", icon: "border", onSelect: () => setSelectedBorder("outer") },
    { label: "Bordures interieures", icon: "border", onSelect: () => setSelectedBorder("inside") },
    { separator: true },
    { label: "Bordure superieure", icon: "border", onSelect: () => setSelectedBorder("top") },
    { label: "Bordure inferieure", icon: "border", onSelect: () => setSelectedBorder("bottom") },
    { label: "Bordure gauche", icon: "border", onSelect: () => setSelectedBorder("left") },
    { label: "Bordure droite", icon: "border", onSelect: () => setSelectedBorder("right") },
    { label: "Bordures horizontales interieures", icon: "border", onSelect: () => setSelectedBorder("insideHorizontal") },
    { label: "Bordures verticales interieures", icon: "border", onSelect: () => setSelectedBorder("insideVertical") },
    { separator: true },
    { label: "Bordure exterieure epaisse", icon: "border", onSelect: () => setSelectedBorder("outer", { style: "thick" }) },
    { label: "Bordure inferieure double", icon: "border", onSelect: () => setSelectedBorder("bottom", { style: "double" }) },
    { separator: true },
    ...buildBorderColorMenuItems(),
    { separator: true },
    ...buildBorderStyleMenuItems()
  ];
  const buildConditionalFormatMenuItems = () => [
    { label: "Nouvelle regle...", icon: "palette", onSelect: () => openConditionalFormatRuleDialog() },
    { separator: true },
    { label: "Superieur a...", icon: "sortAsc", onSelect: () => addConditionalFormatRuleToSelection("greaterThan", { preset: "red" }) },
    { label: "Inferieur a...", icon: "sortDesc", onSelect: () => addConditionalFormatRuleToSelection("lessThan", { preset: "red" }) },
    { label: "Entre...", icon: "number", onSelect: () => addConditionalFormatRuleToSelection("between", { preset: "yellow" }) },
    { label: "Egal a...", icon: "checkbox", onSelect: () => addConditionalFormatRuleToSelection("equal", { preset: "green" }) },
    { label: "Texte qui contient...", icon: "text", onSelect: () => addConditionalFormatRuleToSelection("textContains", { preset: "yellow" }) },
    { label: "Valeurs en double", icon: "duplicate", onSelect: () => addConditionalFormatRuleToSelection("duplicate", { preset: "red" }) },
    { separator: true },
    { label: "Effacer les regles de la selection", icon: "eraser", onSelect: clearSelectedConditionalFormats },
    { label: "Gerer les regles", icon: "palette", onSelect: showConditionalFormatSummary }
  ];
  const buildNumberFormatMenuItems = () => [
    { label: "Number", onSelect: () => setSelectedRangeFormat("number") },
    { label: "Currency", onSelect: () => setSelectedRangeFormat("currency") },
    { label: "Percent", onSelect: () => setSelectedRangeFormat("percent") },
    { label: "Date", onSelect: () => setSelectedRangeFormat("date") },
    { separator: true },
    { label: "Clear number format", onSelect: () => setSelectedRangeFormat("") }
  ];
  const buildInsertMenuItems = () => [
    { label: "Row above", onSelect: () => insertRowAtSelection(0) },
    { label: "Row below", onSelect: () => insertRowAtSelection(1) },
    { label: "Column left", onSelect: () => insertColumnAtSelection(0) },
    { label: "Column right", onSelect: () => insertColumnAtSelection(1) }
  ];
  const buildDeleteMenuItems = () => [
    { label: "Delete row", onSelect: deleteActiveRow },
    { label: "Delete column", onSelect: deleteActiveColumn }
  ];
  const buildMergeMenuItems = () => [
    { label: "Merge cells", onSelect: mergeSelectionRange },
    { label: "Unmerge cells", onSelect: unmergeSelectionRange }
  ];
  const buildFindMenuItems = () => [
    { label: "Find", onSelect: () => openFindReplaceBar() },
    { label: "Replace", onSelect: () => openFindReplaceBar({ showReplace: true }) },
    { separator: true },
    { label: "Go to A1", onSelect: () => focusKeyboardSelection(0, 0) },
    {
      label: "Go to last cell",
      onSelect: () => {
        const lastUsedCell = getLastUsedCell();
        focusKeyboardSelection(lastUsedCell.rowIndex, lastUsedCell.columnIndex);
      }
    }
  ];
  const getFormulaCategory = (categoryId = "all") =>
    SPREADSHEET_FORMULA_CATEGORIES.find((category) => category.id === categoryId) ||
    SPREADSHEET_FORMULA_CATEGORIES[0];
  const getRecentFormulaDefinitions = () =>
    (spreadsheetRecentFormulaStore.get(historyKey) || [])
      .map((name) => getFormulaDefinition(name))
      .filter(Boolean);
  const getFormulaDefinitionsForCategory = (categoryId = "all") => {
    if (categoryId === "recent") {
      return getRecentFormulaDefinitions();
    }
    if (categoryId === "all") {
      return SPREADSHEET_FORMULA_DEFINITIONS;
    }
    return SPREADSHEET_FORMULA_DEFINITIONS.filter((definition) => definition.category === categoryId);
  };
  const buildFormulaMenuItems = (categoryId = "all") => {
    const definitions = getFormulaDefinitionsForCategory(categoryId);
    const category = categoryId === "recent"
      ? { label: "Recemment utilise", icon: "function" }
      : getFormulaCategory(categoryId);
    return definitions.length
      ? [
          { label: category.label, icon: category.icon, disabled: true },
          { separator: true },
          ...definitions.map((definition) => ({
            label: definition.name,
            icon: getFormulaCategory(definition.category).icon,
            onSelect: () => insertFormulaInActiveCell(definition.name)
          })),
          { separator: true },
          { label: "Autres fonctions...", icon: "function", onSelect: () => openInsertFunctionDialog(categoryId) }
        ]
      : [{ label: "Autres fonctions...", icon: "function", onSelect: () => openInsertFunctionDialog("all") }];
  };
  const buildAutoSumFormulaMenuItems = () =>
    ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((name) => ({
      label: name === "SUM" ? "Somme" : name === "AVERAGE" ? "Moyenne" : name,
      icon: "function",
      onSelect: () => insertFormulaInActiveCell(name)
    }));
  const buildFormulaCategoryMenuItems = (categoryId = "all") => buildFormulaMenuItems(categoryId);
  const buildTextDateFormulaMenuItems = () => [
    ...buildFormulaMenuItems("date").filter((item) => !item.separator && item.label !== "Autres fonctions..."),
    { separator: true },
    ...buildFormulaMenuItems("text").filter((item) => !item.separator && item.label !== "Autres fonctions...")
  ];
  const buildLookupFormulaMenuItems = () => buildFormulaMenuItems("lookup");
  const buildConditionalFormulaMenuItems = () => buildFormulaMenuItems("conditional");
  let insertFunctionDialogOverlay = null;
  let insertFunctionDialogKeydownHandler = null;

  const closeInsertFunctionDialog = () => {
    if (insertFunctionDialogKeydownHandler) {
      document.removeEventListener("keydown", insertFunctionDialogKeydownHandler);
      insertFunctionDialogKeydownHandler = null;
    }
    if (insertFunctionDialogOverlay?.isConnected) {
      insertFunctionDialogOverlay.remove();
    }
    insertFunctionDialogOverlay = null;
  };

  const openInsertFunctionDialog = (initialCategory = "all") => {
    closeSheetMenu();
    closeInsertFunctionDialog();

    let activeCategory = initialCategory === "recent" || getFormulaCategory(initialCategory).id === initialCategory
      ? initialCategory
      : "all";
    let selectedDefinition = null;

    const overlay = document.createElement("div");
    overlay.className = "workspace-sheet-function-dialog-overlay";
    const backdrop = document.createElement("div");
    backdrop.className = "workspace-sheet-function-dialog-backdrop";
    const dialog = document.createElement("section");
    dialog.className = "workspace-sheet-function-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Inserer une fonction");

    const header = document.createElement("div");
    header.className = "workspace-sheet-function-dialog-header";
    const title = document.createElement("h2");
    title.textContent = "Inserer une fonction";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "workspace-sheet-function-dialog-close";
    closeButton.setAttribute("aria-label", "Fermer");
    closeButton.appendChild(createSheetIconNode("close", { className: "workspace-sheet-function-close-icon", label: "Fermer" }));
    closeButton.addEventListener("click", closeInsertFunctionDialog);
    header.append(title, closeButton);

    const searchWrap = document.createElement("label");
    searchWrap.className = "workspace-sheet-function-search";
    searchWrap.appendChild(createSheetIconNode("search", { className: "workspace-sheet-function-search-icon", label: "Rechercher" }));
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Rechercher une fonction";
    searchWrap.appendChild(searchInput);

    const categoryLabel = document.createElement("label");
    categoryLabel.className = "workspace-sheet-function-category-label";
    categoryLabel.textContent = "Selectionner une categorie";
    const categorySelect = document.createElement("select");
    categorySelect.className = "workspace-sheet-function-category";
    [
      { id: "recent", label: "Recemment utilise" },
      ...SPREADSHEET_FORMULA_CATEGORIES
    ].forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      categorySelect.appendChild(option);
    });
    categorySelect.value = activeCategory;
    categoryLabel.appendChild(categorySelect);

    const list = document.createElement("div");
    list.className = "workspace-sheet-function-list";
    list.setAttribute("role", "listbox");
    const details = document.createElement("div");
    details.className = "workspace-sheet-function-details";
    const detailTitle = document.createElement("strong");
    const detailDescription = document.createElement("p");
    const detailMeta = document.createElement("span");
    detailMeta.className = "tiny";
    details.append(detailTitle, detailDescription, detailMeta);

    const footer = document.createElement("div");
    footer.className = "workspace-sheet-function-dialog-footer";
    const showAllButton = document.createElement("button");
    showAllButton.type = "button";
    showAllButton.className = "workspace-sheet-function-secondary";
    showAllButton.textContent = "Afficher toutes les formules";
    showAllButton.addEventListener("click", () => {
      categorySelect.value = "all";
      activeCategory = "all";
      renderFormulaChoices();
    });
    const insertButton = document.createElement("button");
    insertButton.type = "button";
    insertButton.className = "workspace-sheet-function-primary";
    insertButton.textContent = "Inserer";
    footer.append(showAllButton, insertButton);

    const insertSelectedFormula = () => {
      if (!selectedDefinition) {
        return;
      }
      const name = selectedDefinition.name;
      closeInsertFunctionDialog();
      insertFormulaInActiveCell(name);
    };

    const setSelectedFormula = (definition = null) => {
      selectedDefinition = definition;
      list.querySelectorAll(".workspace-sheet-function-list-item").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.formulaName === selectedDefinition?.name);
      });
      insertButton.disabled = !selectedDefinition;
      if (!selectedDefinition) {
        detailTitle.textContent = "Aucune fonction";
        detailDescription.textContent = "Choisis une categorie ou recherche une fonction.";
        detailMeta.textContent = "";
        return;
      }
      detailTitle.textContent = selectedDefinition.syntax;
      detailDescription.textContent = selectedDefinition.description;
      detailMeta.textContent = getFormulaCategory(selectedDefinition.category).label;
    };

    function renderFormulaChoices() {
      const query = searchInput.value.trim().toLowerCase();
      const definitions = getFormulaDefinitionsForCategory(activeCategory).filter((definition) => {
        if (!query) {
          return true;
        }
        const categoryLabelText = getFormulaCategory(definition.category).label.toLowerCase();
        return [definition.name, definition.syntax, definition.description, categoryLabelText]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
      list.innerHTML = "";
      definitions.forEach((definition) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workspace-sheet-function-list-item";
        button.dataset.formulaName = definition.name;
        button.setAttribute("role", "option");
        button.textContent = definition.name;
        button.addEventListener("click", () => setSelectedFormula(definition));
        button.addEventListener("dblclick", insertSelectedFormula);
        list.appendChild(button);
      });
      if (!definitions.length) {
        const empty = document.createElement("div");
        empty.className = "workspace-sheet-function-list-empty";
        empty.textContent = activeCategory === "recent"
          ? "Aucune fonction recente."
          : "Aucune fonction trouvee.";
        list.appendChild(empty);
      }
      setSelectedFormula(definitions.find((definition) => definition.name === selectedDefinition?.name) || definitions[0] || null);
    }

    searchInput.addEventListener("input", renderFormulaChoices);
    categorySelect.addEventListener("change", () => {
      activeCategory = categorySelect.value;
      renderFormulaChoices();
    });
    insertButton.addEventListener("click", insertSelectedFormula);
    backdrop.addEventListener("click", closeInsertFunctionDialog);
    insertFunctionDialogKeydownHandler = (event) => {
      if (event.key === "Escape") {
        closeInsertFunctionDialog();
      }
      if (event.key === "Enter" && document.activeElement !== categorySelect) {
        event.preventDefault();
        insertSelectedFormula();
      }
    };
    document.addEventListener("keydown", insertFunctionDialogKeydownHandler);

    dialog.append(header, searchWrap, categoryLabel, list, details, footer);
    overlay.append(backdrop, dialog);
    document.body.appendChild(overlay);
    insertFunctionDialogOverlay = overlay;
    renderFormulaChoices();
    window.setTimeout(() => searchInput.focus(), 0);
  };
  const buildSortFilterMenuItems = () => [
    { label: "Trier A-Z", icon: "sortAsc", onSelect: () => sortActiveColumn("asc") },
    { label: "Trier Z-A", icon: "sortDesc", onSelect: () => sortActiveColumn("desc") },
    { separator: true },
    { label: "Creer un filtre", icon: "filter", onSelect: filterActiveColumn },
    { label: "Filtrer par valeur selectionnee", icon: "filter", onSelect: filterBySelectedValue },
    { label: "Effacer le filtre", icon: "filterClear", onSelect: clearActiveFilter }
  ];
  const buildFilterMenuItems = () => [
    { label: "Creer un filtre", icon: "filter", onSelect: filterActiveColumn },
    { label: "Filtrer par valeur selectionnee", icon: "filter", onSelect: filterBySelectedValue },
    { label: "Effacer le filtre", icon: "filterClear", onSelect: clearActiveFilter }
  ];
  const buildValidationMenuItems = () => [
    { label: "Validation des donnees", icon: "checkbox", onSelect: addOrEditSelectedDataValidation },
    { label: "Effacer la validation", icon: "eraser", onSelect: clearSelectedDataValidation },
    { label: "Entourer les donnees invalides", icon: "checkbox", onSelect: showInvalidDataSummary }
  ];
  const buildCleanupMenuItems = () => [
    { label: "Supprimer les doublons", icon: "duplicate", onSelect: removeDuplicateRows },
    { label: "Supprimer les espaces", icon: "clean", onSelect: trimSelectedWhitespace },
    { label: "Nettoyer le texte", icon: "clean", onSelect: cleanSelectedText },
    { label: "Fractionner le texte en colonnes", icon: "split", onSelect: splitTextToColumns },
    { label: "Transposer la plage", icon: "transpose", onSelect: transposeSelectionRange }
  ];
  const buildDataToolsMenuItems = () => [
    { label: "Fractionner le texte en colonnes", icon: "split", onSelect: splitTextToColumns },
    { label: "Supprimer les doublons", icon: "duplicate", onSelect: removeDuplicateRows },
    { separator: true },
    { label: "Supprimer les espaces", icon: "clean", onSelect: trimSelectedWhitespace },
    { label: "Nettoyer le texte", icon: "clean", onSelect: cleanSelectedText },
    { label: "Transposer la plage", icon: "transpose", onSelect: transposeSelectionRange }
  ];
  const buildDataRefreshMenuItems = () => [
    { label: "Actualiser les tableaux croises", icon: "pivot", onSelect: refreshActivePivotTables, disabled: !getActiveSheetPivotTables().length },
    { label: "Recalculer les formules", icon: "function", onSelect: recalculateSheet }
  ];
  const buildActiveTableDataMenuItems = () => [
    { label: "Selectionner le tableau", icon: "table", onSelect: () => selectActiveTableRange(), disabled: !getActiveTableForSelection() },
    { label: "Selectionner les donnees", icon: "table", onSelect: () => selectActiveTableRange({ dataOnly: true }), disabled: !getActiveTableForSelection() },
    { separator: true },
    { label: "Renommer le tableau", icon: "rename", onSelect: renameActiveTable, disabled: !getActiveTableForSelection() },
    { label: "Redimensionner le tableau", icon: "move", onSelect: resizeActiveTable, disabled: !getActiveTableForSelection() },
    { label: "Convertir en plage", icon: "table", onSelect: removeActiveTable, disabled: !getActiveTableForSelection() },
    { separator: true },
    { label: "Ligne des totaux", icon: "function", onSelect: toggleActiveTableTotalRow, disabled: !getActiveTableForSelection() },
    { label: "Total: somme", icon: "function", onSelect: () => setActiveTableTotalFunction("sum"), disabled: !getActiveTableForSelection() },
    { label: "Total: moyenne", icon: "function", onSelect: () => setActiveTableTotalFunction("average"), disabled: !getActiveTableForSelection() },
    { label: "Total: nombre", icon: "function", onSelect: () => setActiveTableTotalFunction("count"), disabled: !getActiveTableForSelection() },
    { separator: true },
    { label: "Ligne d'en-tete", icon: "table", onSelect: toggleActiveTableHeaderRow, disabled: !getActiveTableForSelection() },
    { label: "Boutons de filtre", icon: "filter", onSelect: toggleActiveTableFilterButtons, disabled: !getActiveTableForSelection() },
    { label: "Lignes a bandes", icon: "table", onSelect: toggleActiveTableBandedRows, disabled: !getActiveTableForSelection() },
    { label: "Colonnes a bandes", icon: "table", onSelect: toggleActiveTableBandedColumns, disabled: !getActiveTableForSelection() }
  ];
  const buildProtectionMenuItems = () => {
    const activeSheetState = getActiveSheetState();
    const selectionHasProtectedRanges = Boolean(getProtectionConflict(getSelectionBounds())?.ranges?.length);
    const hasProtectedRanges = getActiveSheetProtectedRanges().length > 0;
    return [
      {
        label: activeSheetState.protected ? "Unprotect sheet" : "Protect sheet",
        onSelect: () => (activeSheetState.protected ? unprotectActiveSheet() : protectActiveSheet())
      },
      { label: "Protect selected range", onSelect: protectSelectionRange, disabled: activeSheetState.protected },
      { label: "Unprotect selected range", onSelect: unprotectSelectionRange, disabled: !selectionHasProtectedRanges },
      { label: "Clear all range protections", onSelect: clearActiveSheetProtectedRanges, disabled: !hasProtectedRanges }
    ];
  };
  const buildHiddenSheetMenuItems = () =>
    getHiddenSheets().map((sheet) => ({
      label: `Unhide ${sheet.name || "Sheet"}`,
      onSelect: () => unhideSheet(sheet.id)
    }));
  const buildSheetTabContextMenuItems = (sheetId = "") => {
    const targetSheet = getSheetStateById(sheetId);
    if (!targetSheet) {
      return [];
    }
    const targetIndex = getSheetIndexById(sheetId);
    const hiddenSheets = getHiddenSheets();
    const visibleSheetCount = getVisibleSheets().length;
    return [
      { label: "Insert sheet", onSelect: () => createSheetFromReference(sheetId) },
      { label: "Duplicate sheet", onSelect: () => createSheetFromReference(sheetId, { duplicate: true }) },
      { label: "Rename sheet", onSelect: () => renameSheetById(sheetId) },
      { separator: true },
      { label: "Delete sheet", onSelect: () => deleteSheetById(sheetId), disabled: workbookModel.sheets.length <= 1 },
      { label: "Hide sheet", onSelect: () => hideSheetById(sheetId), disabled: targetSheet.hidden || visibleSheetCount <= 1 },
      ...(hiddenSheets.length
        ? [
            { separator: true },
            ...hiddenSheets.map((sheet) => ({
              label: `Unhide ${sheet.name || "Sheet"}`,
              onSelect: () => unhideSheet(sheet.id)
            }))
          ]
        : []),
      { separator: true },
      { label: "Move sheet left", onSelect: () => moveSheetById(sheetId, -1), disabled: targetIndex <= 0 },
      {
        label: "Move sheet right",
        onSelect: () => moveSheetById(sheetId, 1),
        disabled: targetIndex >= workbookModel.sheets.length - 1
      },
      { separator: true },
      {
        label: targetSheet.protected ? "Unprotect sheet" : "Protect sheet",
        onSelect: () => setSheetProtectionById(sheetId, !targetSheet.protected)
      }
    ];
  };
  const buildZoomMenuItems = () => [
    { label: "Zoom in", onSelect: () => adjustActiveSheetZoom(0.1) },
    { label: "Zoom out", onSelect: () => adjustActiveSheetZoom(-0.1) },
    { label: "Reset zoom", onSelect: () => setActiveSheetZoomLevel(1) }
  ];
  const buildFreezeMenuItems = () => [
    { label: "Freeze to current row", onSelect: freezeRowsToSelection },
    { label: "Freeze to current column", onSelect: freezeColumnsToSelection },
    { label: "Unfreeze", onSelect: unfreezeSheet }
  ];
  const renderRibbonGroups = () => {
    toolbar.innerHTML = "";
    switch (activeRibbonTab) {
      case "File":
        toolbar.append(
          makeToolbarGroup(
            "Workbook",
            makeToolbarButton("Import XLSX", openXlsxImportDialog, true, { large: true }),
            makeToolbarStack(
              makeToolbarButton("Export XLSX", exportWorkbookAsXlsx),
              makeToolbarButton("Download CSV", downloadActiveSheetCsv)
            )
          ),
          makeToolbarGroup(
            "Output",
            makeToolbarButton("Print", printCurrentSheet, false, { large: true }),
            makeToolbarStack(
              makeToolbarButton("Export PDF", exportCurrentSheetAsPdf),
              makeToolbarMenuButton("More file actions", () => makeSheetMenuItems("File"))
            )
          )
        );
        break;
      case "Insert":
        toolbar.append(
          makeToolbarGroup(
            "Cells",
            makeToolbarMenuButton("Insert row", () => [
              { label: "Row above", onSelect: () => insertRowAtSelection(0) },
              { label: "Row below", onSelect: () => insertRowAtSelection(1) }
            ], { large: true }),
            makeToolbarMenuButton("Insert column", () => [
              { label: "Column left", onSelect: () => insertColumnAtSelection(0) },
              { label: "Column right", onSelect: () => insertColumnAtSelection(1) }
            ], { large: true }),
            makeToolbarButton("Tableau", createTableFromSelection),
            makeToolbarButton("New sheet", () => createSheetFromActive())
          ),
          makeToolbarGroup(
            "Visuals",
            makeToolbarButton("Charts", (event, button) => {
              event.preventDefault();
              event.stopPropagation();
              toggleChartGalleryMenu(button);
            }, true, { large: true }),
            makeToolbarButton("Sparkline", addSparklineFromSelection),
            makeToolbarButton("Cell note", addOrEditActiveCellNote)
          ),
          makeToolbarGroup(
            "Analysis",
            makeToolbarButton("Tableau croise", createPivotTableFromSelection, false, {
              large: true,
              title: "Tableau croise dynamique"
            }),
            makeToolbarStack(
              makeToolbarButton("Slicer", addSlicerFromSelection),
              makeToolbarMenuButton("More insert", () => makeSheetMenuItems("Insert"))
            )
          )
        );
        break;
      case "Formulas":
        toolbar.append(
          makeToolbarGroup(
            "Library",
            makeToolbarButton("Inserer une fonction", () => openInsertFunctionDialog("all"), true, {
              large: true,
              icon: "function"
            }),
            makeToolbarMenuButton("Somme auto", buildAutoSumFormulaMenuItems, {
              icon: "function"
            })
          ),
          makeToolbarGroup(
            "Categories",
            makeToolbarMenuButton("Math", () => buildFormulaCategoryMenuItems("math"), {
              icon: "number",
              iconOnly: true,
              title: "Math et trigo"
            }),
            makeToolbarMenuButton("Stat", () => buildFormulaCategoryMenuItems("statistical"), {
              icon: "chart",
              iconOnly: true,
              title: "Statistiques"
            }),
            makeToolbarMenuButton("Logique", () => buildFormulaCategoryMenuItems("logical"), {
              icon: "checkbox",
              iconOnly: true,
              title: "Logique"
            }),
            makeToolbarMenuButton("Texte", () => buildFormulaCategoryMenuItems("text"), {
              icon: "text",
              iconOnly: true,
              title: "Texte"
            }),
            makeToolbarMenuButton("Date", () => buildFormulaCategoryMenuItems("date"), {
              icon: "calendar",
              iconOnly: true,
              title: "Date et heure"
            }),
            makeToolbarMenuButton("Recherche", () => buildFormulaCategoryMenuItems("lookup"), {
              icon: "search",
              iconOnly: true,
              title: "Recherche et reference"
            }),
            makeToolbarMenuButton("Condition", () => buildFormulaCategoryMenuItems("conditional"), {
              icon: "filter",
              iconOnly: true,
              title: "Conditionnelles"
            }),
            makeToolbarMenuButton("Toutes", () => buildFormulaCategoryMenuItems("all"), {
              icon: "function",
              iconOnly: true,
              title: "Toutes les formules"
            })
          ),
          makeToolbarGroup(
            "Names",
            makeToolbarButton("Define name", () => createOrUpdateNamedRangeFromSelection(), false, { large: true }),
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("Name manager", showNameManager),
                makeToolbarButton("Delete name", deleteNamedRangePrompt, false, {
                  disabled: () => !getWorkbookNamedRanges().length
                })
              ),
              makeToolbarMenuButton("Use name", buildNamedRangeMenuItems, {
                disabled: () => !getWorkbookNamedRanges().length
              })
            )
          ),
          makeToolbarGroup(
            "Calculation",
            makeToolbarButton("Calculer", recalculateSheet, false, { large: true, icon: "function" })
          )
        );
        break;
      case "Data":
        toolbar.append(
          makeToolbarGroup(
            "Tri et filtre",
            makeToolbarMenuButton("Trier", buildSortFilterMenuItems, {
              large: true,
              icon: "sort"
            }),
            makeToolbarButton("Filtrer", filterActiveColumn, false, {
              icon: "filter",
              title: "Creer un filtre"
            }),
            makeToolbarButton("Effacer", clearActiveFilter, false, {
              icon: "filterClear",
              title: "Effacer le filtre"
            })
          ),
          makeToolbarGroup(
            "Outils de donnees",
            makeToolbarMenuButton("Validation", buildValidationMenuItems, {
              large: true,
              icon: "checkbox",
              title: "Validation des donnees"
            }),
            makeToolbarMenuButton("Nettoyer", buildDataToolsMenuItems, {
              large: true,
              icon: "clean"
            })
          ),
          makeToolbarGroup(
            "Tables",
            makeToolbarMenuButton("Table active", buildActiveTableDataMenuItems, {
              large: true,
              icon: "table",
              disabled: () => !getActiveTableForSelection()
            }),
            makeToolbarMenuButton("Actualiser", buildDataRefreshMenuItems, {
              icon: "pivot"
            })
          )
        );
        break;
      case "Review":
        toolbar.append(
          makeToolbarGroup(
            "Notes",
            makeToolbarButton("New note", addOrEditActiveCellNote, false, { large: true }),
            makeToolbarStack(
              makeToolbarButton("Remove note", removeActiveCellNote, false, {
                disabled: () => !getCellNote(activeSelection.rowIndex, activeSelection.columnIndex)
              }),
              makeToolbarButton("Find", () => openFindReplaceBar())
            )
          ),
          makeToolbarGroup(
            "Protection",
            makeToolbarMenuButton("Protect", buildProtectionMenuItems, { large: true }),
            makeToolbarButton("Clear format", clearSelectedFormatting)
          ),
          makeToolbarGroup(
            "Sheet review",
            makeToolbarButton("Rename", renameActiveSheet),
            makeToolbarButton("Duplicate", () => createSheetFromActive({ duplicate: true })),
            makeToolbarButton("Hide", hideActiveSheet, false, {
              disabled: () => getVisibleSheets().length <= 1
            }),
            makeToolbarMenuButton("Unhide", buildHiddenSheetMenuItems, {
              disabled: () => !getHiddenSheets().length
            })
          )
        );
        break;
      case "View":
        toolbar.append(
          makeToolbarGroup(
            "Zoom",
            makeToolbarButton(`${Math.round(getActiveSheetZoomLevel() * 100)}%`, () => setActiveSheetZoomLevel(1), true, { large: true }),
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("Zoom +", () => adjustActiveSheetZoom(0.1)),
                makeToolbarButton("Zoom -", () => adjustActiveSheetZoom(-0.1))
              ),
              makeToolbarRow(makeToolbarMenuButton("More", buildZoomMenuItems))
            )
          ),
          makeToolbarGroup(
            "Show",
            makeToolbarButton(getActiveSheetShowGridlines() ? "Hide grid" : "Show grid", toggleActiveSheetGridlines, false, { large: true })
          ),
          makeToolbarGroup(
            "Freeze",
            makeToolbarButton("Freeze row", freezeRowsToSelection),
            makeToolbarButton("Freeze col", freezeColumnsToSelection),
            makeToolbarButton("Unfreeze", unfreezeSheet)
          ),
          makeToolbarGroup(
            "Navigate",
            makeToolbarMenuButton("Go to", buildFindMenuItems, { large: true }),
            makeToolbarButton("Find", () => openFindReplaceBar())
          ),
          makeToolbarGroup(
            "Output",
            makeToolbarButton("Print", printCurrentSheet),
            makeToolbarButton("PDF", exportCurrentSheetAsPdf)
          )
        );
        break;
      case "Sheet":
        toolbar.append(
          makeToolbarGroup(
            "Workbook",
            makeToolbarButton("New sheet", () => createSheetFromActive(), true, { large: true }),
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("Duplicate", () => createSheetFromActive({ duplicate: true })),
                makeToolbarButton("Rename", renameActiveSheet)
              ),
              makeToolbarRow(
                makeToolbarButton("Delete", deleteActiveSheet, false, {
                  disabled: () => workbookModel.sheets.length <= 1
                }),
                makeToolbarButton("Hide", hideActiveSheet, false, {
                  disabled: () => getVisibleSheets().length <= 1
                })
              )
            )
          ),
          makeToolbarGroup(
            "Arrange",
            makeToolbarButton("Move left", () => moveActiveSheet(-1), false, {
              disabled: () => getActiveSheetIndex() <= 0
            }),
            makeToolbarButton("Move right", () => moveActiveSheet(1), false, {
              disabled: () => getActiveSheetIndex() >= workbookModel.sheets.length - 1
            }),
            makeToolbarMenuButton("Unhide", buildHiddenSheetMenuItems, {
              large: true,
              disabled: () => !getHiddenSheets().length
            })
          ),
          makeToolbarGroup("Protection", makeToolbarMenuButton("Protect", buildProtectionMenuItems, { large: true }))
        );
        break;
      case "Home":
      default:
        toolbar.append(
          makeToolbarGroup(
            "Clipboard",
            makeToolbarButton("Paste", () => pasteFromClipboard(), true, { large: true }),
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("Undo", undoSpreadsheetAction),
                makeToolbarButton("Redo", redoSpreadsheetAction)
              ),
              makeToolbarRow(
                makeToolbarButton("Cut", () => cutSelectedCells()),
                makeToolbarButton("Copy", () => copySelectedCells())
              )
            ),
            makeToolbarMenuButton("Fill", () => [
              { label: "Fill down", onSelect: () => fillSelectionFromEdge("down") },
              { label: "Fill right", onSelect: () => fillSelectionFromEdge("right") },
              { separator: true },
              { label: "Clear contents", onSelect: clearSelectedCells }
            ])
          ),
          makeToolbarGroup(
            "Font",
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("B", () => toggleSelectedTextStyle("bold")),
                makeToolbarButton("I", () => toggleSelectedTextStyle("italic")),
                makeToolbarButton("U", () => toggleSelectedTextStyle("underline"))
              ),
              makeToolbarRow(
                makeToolbarSelect(
                  "Font size",
                  buildFontSizeOptions(),
                  (value) => value && setSelectedFontSize(Number(value)),
                  { value: getActiveSelectionFontSizeValue(), control: "font-size" }
                ),
                makeToolbarColorButton("Text color", "text"),
                makeToolbarColorButton("Fill color", "fill")
              )
            ),
            makeToolbarMenuButton("Borders", buildBorderMenuItems),
            makeToolbarMenuButton("Conditionnel", buildConditionalFormatMenuItems)
          ),
          makeToolbarGroup(
            "Alignment",
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("Left", () => setSelectedHorizontalAlign("left")),
                makeToolbarButton("Center", () => setSelectedHorizontalAlign("center")),
                makeToolbarButton("Right", () => setSelectedHorizontalAlign("right"))
              ),
              makeToolbarRow(
                makeToolbarButton("Top", () => setSelectedVerticalAlign("top")),
                makeToolbarButton("Middle", () => setSelectedVerticalAlign("middle")),
                makeToolbarButton("Bottom", () => setSelectedVerticalAlign("bottom"))
              )
            ),
            makeToolbarMenuButton("Merge", buildMergeMenuItems)
          ),
          makeToolbarGroup(
            "Number",
            makeToolbarStack(
              makeToolbarRow(
                makeToolbarButton("123", () => setSelectedRangeFormat("number")),
                makeToolbarButton("EUR", () => setSelectedRangeFormat("currency")),
                makeToolbarButton("%", () => setSelectedRangeFormat("percent"))
              ),
              makeToolbarRow(
                makeToolbarButton("Date", () => setSelectedRangeFormat("date")),
                makeToolbarMenuButton("Formats", buildNumberFormatMenuItems)
              )
            )
          ),
          makeToolbarGroup(
            "Cells",
            makeToolbarMenuButton("Insert", buildInsertMenuItems, { large: true }),
            makeToolbarMenuButton("Delete", buildDeleteMenuItems, { large: true }),
            makeToolbarButton("Clear format", clearSelectedFormatting)
          ),
          makeToolbarGroup(
            "Editing",
            makeToolbarMenuButton("Find", buildFindMenuItems, { large: true }),
            makeToolbarStack(
              makeToolbarButton("Replace", () => openFindReplaceBar({ showReplace: true })),
              makeToolbarButton("Note", addOrEditActiveCellNote)
            )
          )
        );
        break;
    }
  };
  const setActiveRibbonTab = (nextTab = "Home", { visible = true } = {}) => {
    if (!ribbonTabIds.includes(nextTab)) {
      return;
    }
    activeRibbonTab = nextTab;
    isRibbonVisible = Boolean(visible);
    spreadsheetRibbonTabStore.set(historyKey, activeRibbonTab);
    spreadsheetRibbonVisibilityStore.set(historyKey, isRibbonVisible);
    closeSheetMenu();
    syncRibbonTabsUi();
    if (isRibbonVisible) {
      renderRibbonGroups();
      syncRibbonPopup();
    } else {
      toolbar.innerHTML = "";
      syncRibbonPopup();
    }
  };
  sheetMenuButtons.forEach((button, tabId) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveCurrentSelectionState();
      if (tabId === activeRibbonTab && isRibbonVisible) {
        setActiveRibbonTab(tabId, { visible: false });
        return;
      }
      setActiveRibbonTab(tabId, { visible: true });
    });
  });
  syncRibbonTabsUi();
  if (isRibbonVisible) {
    renderRibbonGroups();
    syncRibbonPopup();
  } else {
    syncRibbonPopup();
  }
  ribbonPopup.appendChild(toolbar);

  bindFindReplaceInputs();

  const formulaBar = document.createElement("div");
  formulaBar.className = "workspace-formula-bar workspace-formula-bar-live";
  const nameBox = document.createElement("input");
  nameBox.type = "text";
  nameBox.className = "workspace-sheet-name-box";
  nameBox.readOnly = false;
  nameBox.title = "Go to a cell/range or define a name for the current selection";
  const formulaLabel = document.createElement("span");
  formulaLabel.className = "tiny";
  formulaLabel.textContent = "fx";
  const formulaInput = document.createElement("input");
  formulaInput.type = "text";
  formulaInput.className = "workspace-sheet-formula-input";
  formulaBar.append(nameBox, formulaLabel, formulaInput);
  previewShell.appendChild(formulaBar);

  const formulaHelpPanel = document.createElement("aside");
  formulaHelpPanel.className = "workspace-sheet-formula-help";
  formulaHelpPanel.dataset.historyKey = historyKey;
  formulaHelpPanel.hidden = true;
  formulaHelpPanel.setAttribute("role", "note");
  formulaHelpPanel.setAttribute("aria-live", "polite");
  const formulaHelpHeader = document.createElement("div");
  formulaHelpHeader.className = "workspace-sheet-formula-help-header";
  const formulaHelpSignature = document.createElement("strong");
  const formulaHelpActions = document.createElement("div");
  formulaHelpActions.className = "workspace-sheet-formula-help-actions";
  const formulaHelpToggle = document.createElement("button");
  formulaHelpToggle.type = "button";
  formulaHelpToggle.className = "workspace-sheet-formula-help-button";
  formulaHelpToggle.setAttribute("aria-label", "Reduire l'aide de formule");
  formulaHelpToggle.appendChild(createSheetIconNode("chevronDown", { className: "workspace-sheet-formula-help-icon", label: "Reduire" }));
  const formulaHelpClose = document.createElement("button");
  formulaHelpClose.type = "button";
  formulaHelpClose.className = "workspace-sheet-formula-help-button";
  formulaHelpClose.setAttribute("aria-label", "Fermer l'aide de formule");
  formulaHelpClose.appendChild(createSheetIconNode("close", { className: "workspace-sheet-formula-help-icon", label: "Fermer" }));
  formulaHelpActions.append(formulaHelpToggle, formulaHelpClose);
  formulaHelpHeader.append(formulaHelpSignature, formulaHelpActions);
  const formulaHelpBody = document.createElement("div");
  formulaHelpBody.className = "workspace-sheet-formula-help-body";
  formulaHelpPanel.append(formulaHelpHeader, formulaHelpBody);
  ["pointerdown", "mousedown"].forEach((eventName) => {
    formulaHelpPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  formulaHelpPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  document.body.appendChild(formulaHelpPanel);
  formulaHelpToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (formulaHelpCollapsed) {
      formulaHelpCollapsed = false;
      formulaHelpDetailsExpanded = false;
    } else {
      formulaHelpDetailsExpanded = !formulaHelpDetailsExpanded;
    }
    updateFormulaHelpPanel();
  });
  formulaHelpClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const definition = getActiveFormulaHelpDefinition();
    formulaHelpClosedForName = definition?.name || "";
    hideFormulaHelpPanel();
  });
  nameBox.addEventListener("focus", () => {
    nameBox.select();
  });
  nameBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleNameBoxCommit(nameBox.value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      syncSelectionUi();
      getCellInput()?.focus();
    }
  });
  nameBox.addEventListener("blur", () => {
    syncSelectionUi();
  });

  const sheetSurfaceShell = document.createElement("div");
  sheetSurfaceShell.className = "workspace-sheet-surface-shell";

  if (getActiveSheetSlicers().length) {
    const slicerBar = document.createElement("div");
    slicerBar.className = "workspace-sheet-slicer-bar";
    getActiveSheetSlicers().forEach((slicer) => {
      const slicerGroup = document.createElement("div");
      slicerGroup.className = "workspace-sheet-slicer-group";
      const slicerTitle = document.createElement("span");
      slicerTitle.className = "tiny";
      slicerTitle.textContent = slicer.title || "Slicer";
      slicerGroup.appendChild(slicerTitle);

      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.className = `workspace-sheet-slicer-chip${!slicer.selectedValue ? " active" : ""}`;
      allButton.textContent = "All";
      allButton.addEventListener("click", () => updateSlicerSelection(slicer.id, ""));
      slicerGroup.appendChild(allButton);

      const values = Array.from(
        new Set(
          Array.from({ length: Math.max(0, sheetGrid.length - 1) }, (_, offset) => getRawCellValue(offset + 1, slicer.columnIndex))
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      )
        .sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base", numeric: true }))
        .slice(0, 12);
      values.forEach((value) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `workspace-sheet-slicer-chip${value === slicer.selectedValue ? " active" : ""}`;
        chip.textContent = value;
        chip.addEventListener("click", () => updateSlicerSelection(slicer.id, value === slicer.selectedValue ? "" : value));
        slicerGroup.appendChild(chip);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "workspace-sheet-slicer-chip";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => removeSlicer(slicer.id));
      slicerGroup.appendChild(removeButton);

      slicerBar.appendChild(slicerGroup);
    });
    sheetSurfaceShell.appendChild(slicerBar);
  }

  if (isWindowedRenderingEnabled()) {
    const windowBar = document.createElement("div");
    windowBar.className = "workspace-sheet-window-bar";
    const windowBounds = getVirtualWindowBounds();
    const windowLabel = document.createElement("span");
    windowLabel.className = "tiny";
    windowLabel.textContent = `Windowed rendering ${windowBounds.startRowIndex + 1}-${windowBounds.endRowIndex + 1} / ${sheetGrid.length} rows`;
    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "workspace-sheet-slicer-chip";
    prevButton.textContent = "Prev";
    prevButton.disabled = windowBounds.startRowIndex <= 0;
    prevButton.addEventListener("click", () => {
      setVirtualWindowStart(windowBounds.startRowIndex - getVirtualWindowSize());
      rerenderPreview({ persistGrid: false });
    });
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "workspace-sheet-slicer-chip";
    nextButton.textContent = "Next";
    nextButton.disabled = windowBounds.endRowIndex >= sheetGrid.length - 1;
    nextButton.addEventListener("click", () => {
      setVirtualWindowStart(windowBounds.startRowIndex + getVirtualWindowSize());
      rerenderPreview({ persistGrid: false });
    });
    const centerButton = document.createElement("button");
    centerButton.type = "button";
    centerButton.className = "workspace-sheet-slicer-chip";
    centerButton.textContent = "Center selection";
    centerButton.addEventListener("click", () => {
      setVirtualWindowStart(activeSelection.rowIndex - Math.floor(getVirtualWindowSize() / 2));
      rerenderPreview({ persistGrid: false });
      rerenderAndFocusCell(activeSelection.rowIndex, activeSelection.columnIndex);
    });
    windowBar.append(windowLabel, prevButton, nextButton, centerButton);
    sheetSurfaceShell.appendChild(windowBar);
  }

  if (sheetSurfaceShell.children.length) {
    previewShell.appendChild(sheetSurfaceShell);
  }

  const gridShell = document.createElement("div");
  gridShell.className = "workspace-sheet-grid-shell";
  gridShell.style.setProperty("--sheet-zoom", String(getActiveSheetZoomLevel()));
  const gridContent = document.createElement("div");
  gridContent.className = "workspace-sheet-grid-content";
  const table = document.createElement("table");
  table.className = "workspace-sheet-grid-table";
  table.classList.toggle("without-gridlines", !getActiveSheetShowGridlines());
  table.style.zoom = String(getActiveSheetZoomLevel());
  // The sheet renders a moving window of cells; this map keeps selection and
  // formula refreshes off expensive querySelector loops.
  const renderedCellInputByKey = new Map();
  const getRenderedCellKey = (rowIndex = 0, columnIndex = 0) => `${rowIndex}:${columnIndex}`;
  const fillHandle = document.createElement("button");
  fillHandle.type = "button";
  fillHandle.className = "workspace-sheet-fill-handle";
  fillHandle.setAttribute("aria-label", "Fill selection");
  fillHandle.textContent = "";
  const clipboardOutline = document.createElement("div");
  clipboardOutline.className = "workspace-sheet-clipboard-outline";
  clipboardOutline.setAttribute("aria-hidden", "true");
  const contextMenu = document.createElement("div");
  contextMenu.className = "workspace-sheet-context-menu";
  contextMenu.hidden = true;
  ["mousedown", "pointerdown", "click", "contextmenu"].forEach((eventName) => {
    contextMenu.addEventListener(eventName, (event) => {
      event.stopPropagation();
      if (eventName === "contextmenu") {
        event.preventDefault();
      }
    });
  });
  gridContent.append(table);
  gridShell.append(gridContent, clipboardOutline, fillHandle);

  let contextOutsidePointerHandler = null;
  let contextKeydownHandler = null;
  let contextViewportHandler = null;

  const getContextSubmenuItems = (item = {}) =>
    Array.isArray(item.items) ? item.items : Array.isArray(item.submenu) ? item.submenu : [];

  const normalizeContextMenuItems = (items = []) => {
    const normalized = [];
    items.forEach((item) => {
      if (!item) {
        return;
      }
      if (item.separator) {
        if (normalized.length && !normalized[normalized.length - 1].separator) {
          normalized.push({ separator: true });
        }
        return;
      }
      const submenuItems = normalizeContextMenuItems(getContextSubmenuItems(item));
      normalized.push(submenuItems.length ? { ...item, items: submenuItems } : { ...item });
    });
    while (normalized.length && normalized[normalized.length - 1].separator) {
      normalized.pop();
    }
    return normalized;
  };

  const teardownContextMenuListeners = () => {
    if (contextOutsidePointerHandler) {
      document.removeEventListener("mousedown", contextOutsidePointerHandler);
      document.removeEventListener("contextmenu", contextOutsidePointerHandler);
      contextOutsidePointerHandler = null;
    }
    if (contextKeydownHandler) {
      document.removeEventListener("keydown", contextKeydownHandler);
      contextKeydownHandler = null;
    }
    if (contextViewportHandler) {
      window.removeEventListener("scroll", contextViewportHandler, true);
      window.removeEventListener("resize", contextViewportHandler);
      contextViewportHandler = null;
    }
  };

  const closeContextMenu = () => {
    teardownContextMenuListeners();
    contextMenu.hidden = true;
    contextMenu.innerHTML = "";
    contextMenu.classList.remove("opens-left");
    if (contextMenu.isConnected) {
      contextMenu.remove();
    }
  };

  const placeContextMenu = (clientX = 0, clientY = 0) => {
    const margin = 8;
    let left = Math.max(margin, clientX);
    let top = Math.max(margin, clientY);
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.classList.remove("opens-left");

    let rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth - margin) {
      left -= rect.right - (window.innerWidth - margin);
    }
    if (rect.bottom > window.innerHeight - margin) {
      top -= rect.bottom - (window.innerHeight - margin);
    }
    left = Math.max(margin, left);
    top = Math.max(margin, top);
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;

    rect = contextMenu.getBoundingClientRect();
    contextMenu.classList.toggle("opens-left", rect.right + 540 > window.innerWidth - margin && rect.left > 540);
  };

  const placeContextSubmenu = (row = null) => {
    if (!row?.classList?.contains("is-open")) {
      return;
    }
    const submenu = row.querySelector(":scope > .workspace-sheet-context-submenu");
    if (!submenu) {
      return;
    }

    const margin = 8;
    const rightGap = 2;
    const opensFromRootMenu = row.parentElement === contextMenu;
    const leftGap = opensFromRootMenu ? 28 : 4;
    submenu.style.left = "";
    submenu.style.right = "auto";
    submenu.style.top = "";
    submenu.style.maxHeight = `${Math.max(120, window.innerHeight - (margin * 2))}px`;

    const rowRect = row.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const availableHeight = Math.max(120, window.innerHeight - margin * 2);
    const submenuHeight = Math.min(submenu.scrollHeight || submenuRect.height || availableHeight, availableHeight);
    const submenuWidth = Math.min(
      Math.max(submenu.scrollWidth || 0, submenu.offsetWidth || 0, submenuRect.width || 0, 268),
      window.innerWidth - margin * 2
    );

    const opensLeft =
      rowRect.right + submenuWidth + rightGap > window.innerWidth - margin &&
      rowRect.left - submenuWidth - leftGap >= margin;
    const preferredLeft = opensLeft ? rowRect.left - submenuWidth - leftGap : rowRect.right + rightGap;
    const viewportLeft = Math.max(margin, Math.min(preferredLeft, window.innerWidth - submenuWidth - margin));
    const preferredTop = rowRect.top - 7;
    const viewportTop = Math.max(margin, Math.min(preferredTop, window.innerHeight - submenuHeight - margin));

    submenu.style.left = `${Math.round(viewportLeft)}px`;
    submenu.style.top = `${Math.round(viewportTop)}px`;
    submenu.style.maxHeight = `${Math.max(120, Math.floor(window.innerHeight - viewportTop - margin))}px`;
  };

  const closeSiblingContextSubmenus = (host = contextMenu, activeRow = null) => {
    Array.from(host.children).forEach((child) => {
      if (child !== activeRow) {
        child.classList?.remove("is-open");
      }
    });
  };

  const openContextSubmenu = (row = null, host = contextMenu) => {
    closeSiblingContextSubmenus(host, row);
    row?.classList.add("is-open");
    window.requestAnimationFrame(() => placeContextSubmenu(row));
  };

  const makeContextColorSwatchButton = (color = "", kind = "fill") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-context-color-swatch";
    button.title = color;
    button.style.background = color;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (kind === "border") {
        setSelectedBorderColor(color);
      } else {
        setSelectedFillColor(color);
      }
      closeContextMenu();
    });
    return button;
  };

  const appendContextPaletteAction = (host, label = "", icon = "", onSelect = null) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-sheet-context-palette-action";
    const iconNode = document.createElement("span");
    iconNode.className = "workspace-sheet-context-palette-action-icon";
    iconNode.textContent = icon;
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    button.append(iconNode, labelNode);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect?.();
    });
    host.appendChild(button);
    return button;
  };

  const appendContextColorPalette = (host = contextMenu, kind = "fill") => {
    const palette = document.createElement("div");
    palette.className = "workspace-sheet-context-color-palette";

    const themeTitle = document.createElement("strong");
    themeTitle.className = "workspace-sheet-context-color-title";
    themeTitle.textContent = "Couleurs du theme";
    const themeGrid = document.createElement("div");
    themeGrid.className = "workspace-sheet-context-color-grid";
    themeColorRows.flat().forEach((color) => themeGrid.appendChild(makeContextColorSwatchButton(color, kind)));

    const standardTitle = document.createElement("strong");
    standardTitle.className = "workspace-sheet-context-color-title";
    standardTitle.textContent = "Couleurs standard";
    const standardGrid = document.createElement("div");
    standardGrid.className = "workspace-sheet-context-color-grid is-standard";
    standardColors.forEach((color) => standardGrid.appendChild(makeContextColorSwatchButton(color, kind)));

    palette.append(themeTitle, themeGrid, standardTitle, standardGrid);
    if (kind === "fill") {
      appendContextPaletteAction(palette, "Aucun remplissage", "/", () => {
        setSelectedFillColor("");
        closeContextMenu();
      });
      appendContextPaletteAction(palette, "Autres couleurs...", "+", () => {
        closeContextMenu();
        openNativeColorPicker("fill", getActiveFillColorValue());
      });
      appendContextPaletteAction(palette, "Pipette", "P", () => {
        closeContextMenu();
        pickColorWithEyedropper("fill", getActiveFillColorValue());
      });
    } else {
      appendContextPaletteAction(palette, "Autres couleurs...", "+", () => {
        closeContextMenu();
        openNativeBorderColorPicker(getActiveBorderColorValue());
      });
    }
    host.appendChild(palette);
  };

  const renderContextMenuItems = (items = [], host = contextMenu) => {
    normalizeContextMenuItems(items).forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.className = "workspace-sheet-context-separator";
        separator.setAttribute("role", "separator");
        host.appendChild(separator);
        return;
      }
      if (item.palette) {
        appendContextColorPalette(host, item.palette);
        return;
      }

      const submenuItems = getContextSubmenuItems(item);
      const hasSubmenu = submenuItems.length > 0;
      const row = document.createElement("div");
      row.className = "workspace-sheet-context-item";
      row.classList.toggle("is-disabled", Boolean(item.disabled));
      row.addEventListener("mouseenter", () => {
        if (hasSubmenu && !item.disabled) {
          openContextSubmenu(row, host);
        } else {
          closeSiblingContextSubmenus(host, row);
        }
      });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-sheet-context-action";
      button.disabled = Boolean(item.disabled);
      button.setAttribute("role", "menuitem");
      if (hasSubmenu) {
        button.setAttribute("aria-haspopup", "menu");
      }

      button.appendChild(
        createSheetIconNode(item.icon || getSheetCommandIcon(item.label), {
          className: "workspace-sheet-context-icon",
          label: item.label
        })
      );

      const label = document.createElement("span");
      label.className = "workspace-sheet-context-label";
      label.textContent = item.label || "";
      button.appendChild(label);

      const meta = document.createElement("span");
      meta.className = "workspace-sheet-context-meta";
      if (hasSubmenu) {
        meta.appendChild(
          createSheetIconNode("chevronRight", {
            className: "workspace-sheet-context-chevron",
            label: "Open submenu"
          })
        );
      } else if (item.shortcut) {
        meta.textContent = item.shortcut;
      }
      button.appendChild(meta);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) {
          return;
        }
        if (hasSubmenu) {
          if (row.classList.contains("is-open")) {
            row.classList.remove("is-open");
          } else {
            openContextSubmenu(row, host);
          }
          return;
        }
        closeContextMenu();
        item.onSelect?.();
      });

      row.appendChild(button);
      if (hasSubmenu) {
        const submenu = document.createElement("div");
        submenu.className = "workspace-sheet-context-submenu";
        submenu.setAttribute("role", "menu");
        renderContextMenuItems(submenuItems, submenu);
        row.appendChild(submenu);
      }
      host.appendChild(row);
    });
  };

  const installContextMenuListeners = () => {
    if (contextMenu.hidden || !contextMenu.isConnected) {
      return;
    }
    teardownContextMenuListeners();
    contextOutsidePointerHandler = (event) => {
      if (!contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    };
    contextKeydownHandler = (event) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };
    contextViewportHandler = (event) => {
      if (!contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", contextOutsidePointerHandler);
    document.addEventListener("contextmenu", contextOutsidePointerHandler);
    document.addEventListener("keydown", contextKeydownHandler);
    window.addEventListener("scroll", contextViewportHandler, true);
    window.addEventListener("resize", contextViewportHandler);
  };

  const openContextMenu = (clientX = 0, clientY = 0, items = []) => {
    contextMenu.innerHTML = "";
    renderContextMenuItems(items);
    if (!contextMenu.isConnected) {
      document.body.appendChild(contextMenu);
    }
    contextMenu.hidden = false;
    placeContextMenu(clientX, clientY);
    window.setTimeout(installContextMenuListeners, 0);
  };

  const buildContextClipboardItems = () => [
    { label: "Couper", icon: "cut", shortcut: "Ctrl+X", onSelect: () => cutSelectedCells() },
    { label: "Copier", icon: "copy", shortcut: "Ctrl+C", onSelect: () => copySelectedCells() },
    { label: "Coller", icon: "paste", shortcut: "Ctrl+V", onSelect: () => pasteFromClipboard() }
  ];

  const buildContextInsertItems = () => [
    { label: "1 ligne au-dessus", icon: "insert", onSelect: () => insertRowAtSelection(0) },
    { label: "1 ligne en dessous", icon: "insert", onSelect: () => insertRowAtSelection(1) },
    { separator: true },
    { label: "1 colonne a gauche", icon: "insert", onSelect: () => insertColumnAtSelection(0) },
    { label: "1 colonne a droite", icon: "insert", onSelect: () => insertColumnAtSelection(1) }
  ];

  const buildContextDeleteItems = () => [
    { label: "Ligne entiere", icon: "delete", onSelect: deleteActiveRow },
    { label: "Colonne entiere", icon: "delete", onSelect: deleteActiveColumn }
  ];

  const buildContextSortItems = () => [
    { label: "Trier de A a Z", icon: "sortAsc", onSelect: () => sortActiveColumn("asc") },
    { label: "Trier de Z a A", icon: "sortDesc", onSelect: () => sortActiveColumn("desc") }
  ];

  const buildContextFilterItems = () => [
    { label: "Creer un filtre", icon: "filter", onSelect: filterActiveColumn },
    { label: "Filtrer par valeur selectionnee", icon: "filter", onSelect: filterBySelectedValue },
    { label: "Effacer le filtre", icon: "filterClear", onSelect: clearActiveFilter }
  ];

  const buildContextFillItems = () => [{ palette: "fill" }];

  const buildContextBorderItems = () => [
    { label: "Aucune bordure", icon: "eraser", onSelect: () => setSelectedBorder("clear") },
    { label: "Toutes les bordures", icon: "border", onSelect: () => setSelectedBorder("all") },
    { label: "Bordures exterieures", icon: "border", onSelect: () => setSelectedBorder("outer") },
    { label: "Bordures interieures", icon: "border", onSelect: () => setSelectedBorder("inside") },
    { separator: true },
    { label: "Bordure superieure", icon: "border", onSelect: () => setSelectedBorder("top") },
    { label: "Bordure inferieure", icon: "border", onSelect: () => setSelectedBorder("bottom") },
    { label: "Bordure gauche", icon: "border", onSelect: () => setSelectedBorder("left") },
    { label: "Bordure droite", icon: "border", onSelect: () => setSelectedBorder("right") },
    { label: "Bordures horizontales interieures", icon: "border", onSelect: () => setSelectedBorder("insideHorizontal") },
    { label: "Bordures verticales interieures", icon: "border", onSelect: () => setSelectedBorder("insideVertical") },
    { separator: true },
    { label: "Bordure exterieure epaisse", icon: "border", onSelect: () => setSelectedBorder("outer", { style: "thick" }) },
    { label: "Bordure inferieure double", icon: "border", onSelect: () => setSelectedBorder("bottom", { style: "double" }) },
    { separator: true },
    { label: "Couleur de bordure", icon: "palette", items: [{ palette: "border" }] },
    { label: "Style de bordure", icon: "border", items: buildBorderStyleMenuItems() }
  ];

  const buildContextFormatItems = () => [
    { label: "Gras", icon: "bold", shortcut: "Ctrl+B", onSelect: () => toggleSelectedTextStyle("bold") },
    { label: "Italique", icon: "italic", shortcut: "Ctrl+I", onSelect: () => toggleSelectedTextStyle("italic") },
    { label: "Souligne", icon: "underline", shortcut: "Ctrl+U", onSelect: () => toggleSelectedTextStyle("underline") },
    { separator: true },
    { label: "Nombre", icon: "number", onSelect: () => setSelectedRangeFormat("number") },
    { label: "Devise", icon: "currency", onSelect: () => setSelectedRangeFormat("currency") },
    { label: "Pourcentage", icon: "percent", onSelect: () => setSelectedRangeFormat("percent") },
    { label: "Date", icon: "calendar", onSelect: () => setSelectedRangeFormat("date") },
    { label: "Effacer le format de nombre", icon: "eraser", onSelect: () => setSelectedRangeFormat("") },
    { separator: true },
    { label: "Remplissage", icon: "fill", items: buildContextFillItems() },
    { label: "Bordures", icon: "border", items: buildContextBorderItems() },
    { separator: true },
    { label: "Fusionner les cellules", icon: "merge", onSelect: mergeSelectionRange },
    { label: "Annuler la fusion", icon: "merge", onSelect: unmergeSelectionRange },
    { separator: true },
    { label: "Effacer toute la mise en forme", icon: "eraser", onSelect: clearSelectedFormatting }
  ];

  const buildContextDataItems = (rowIndex = 0, columnIndex = 0) => [
    { label: "Validation des donnees", icon: "checkbox", onSelect: addOrEditSelectedDataValidation },
    {
      label: "Effacer la validation",
      icon: "eraser",
      onSelect: clearSelectedDataValidation,
      disabled: !getCellDataValidation(rowIndex, columnIndex)
    },
    { separator: true },
    { label: "Mise en forme conditionnelle", icon: "palette", items: buildConditionalFormatMenuItems() }
  ];

  const buildContextTableItems = () => {
    const activeTable = getActiveTableForSelection();
    const hasTable = Boolean(activeTable);
    return [
      {
        label: hasTable ? "Convertir en plage" : "Mettre sous forme de tableau",
        icon: "table",
        onSelect: () => (hasTable ? removeActiveTable() : createTableFromSelection())
      },
      { label: "Renommer le tableau", icon: "rename", onSelect: renameActiveTable, disabled: !hasTable },
      { label: "Redimensionner le tableau", icon: "move", onSelect: resizeActiveTable, disabled: !hasTable },
      { separator: true },
      { label: "Ligne des totaux", icon: "function", onSelect: toggleActiveTableTotalRow, disabled: !hasTable },
      {
        label: "Fonction de total",
        icon: "function",
        disabled: !hasTable,
        items: [
          { label: "Somme", icon: "function", onSelect: () => setActiveTableTotalFunction("sum") },
          { label: "Moyenne", icon: "function", onSelect: () => setActiveTableTotalFunction("average") },
          { label: "Nombre", icon: "function", onSelect: () => setActiveTableTotalFunction("count") },
          { label: "Aucun", icon: "eraser", onSelect: () => setActiveTableTotalFunction("none") }
        ]
      },
      {
        label: "Options du tableau",
        icon: "table",
        disabled: !hasTable,
        items: [
          { label: "Ligne d'en-tete", icon: "table", onSelect: toggleActiveTableHeaderRow },
          { label: "Boutons de filtre", icon: "filter", onSelect: toggleActiveTableFilterButtons },
          { label: "Lignes a bandes", icon: "table", onSelect: toggleActiveTableBandedRows },
          { label: "Colonnes a bandes", icon: "table", onSelect: toggleActiveTableBandedColumns },
          { label: "Premiere colonne", icon: "table", onSelect: toggleActiveTableFirstColumn },
          { label: "Derniere colonne", icon: "table", onSelect: toggleActiveTableLastColumn }
        ]
      },
      { separator: true },
      { label: "Tableau croise dynamique", icon: "pivot", onSelect: createPivotTableFromSelection }
    ];
  };

  const buildCellContextMenuItems = (rowIndex = 0, columnIndex = 0) => [
    ...buildContextClipboardItems(),
    { separator: true },
    { label: "Inserer", icon: "insert", items: buildContextInsertItems() },
    { label: "Supprimer", icon: "delete", items: buildContextDeleteItems() },
    { label: "Effacer le contenu", icon: "eraser", onSelect: clearSelectedCells },
    { separator: true },
    { label: "Filtrer", icon: "filter", items: buildContextFilterItems() },
    { label: "Trier", icon: "sort", items: buildContextSortItems() },
    { separator: true },
    {
      label: "Mettre en forme les cellules",
      icon: "palette",
      shortcut: "Ctrl+1",
      items: buildContextFormatItems()
    },
    { label: "Donnees", icon: "checkbox", items: buildContextDataItems(rowIndex, columnIndex) },
    { label: "Tableau", icon: "table", items: buildContextTableItems() },
    { separator: true },
    {
      label: getCellNote(rowIndex, columnIndex) ? "Modifier la note" : "Nouvelle note",
      icon: "note",
      onSelect: addOrEditActiveCellNote
    },
    {
      label: "Supprimer la note",
      icon: "eraser",
      onSelect: removeActiveCellNote,
      disabled: !getCellNote(rowIndex, columnIndex)
    }
  ];

  const buildColumnHeaderContextMenuItems = () => [
    ...buildContextClipboardItems(),
    { separator: true },
    {
      label: "Inserer",
      icon: "insert",
      items: [
        { label: "1 colonne a gauche", icon: "insert", onSelect: () => insertColumnAtSelection(0) },
        { label: "1 colonne a droite", icon: "insert", onSelect: () => insertColumnAtSelection(1) }
      ]
    },
    { label: "Supprimer", icon: "delete", items: [{ label: "Colonne entiere", icon: "delete", onSelect: deleteActiveColumn }] },
    { label: "Figer cette colonne", icon: "freeze", onSelect: freezeColumnsToSelection }
  ];

  const buildRowHeaderContextMenuItems = () => [
    ...buildContextClipboardItems(),
    { separator: true },
    {
      label: "Inserer",
      icon: "insert",
      items: [
        { label: "1 ligne au-dessus", icon: "insert", onSelect: () => insertRowAtSelection(0) },
        { label: "1 ligne en dessous", icon: "insert", onSelect: () => insertRowAtSelection(1) }
      ]
    },
    { label: "Supprimer", icon: "delete", items: [{ label: "Ligne entiere", icon: "delete", onSelect: deleteActiveRow }] },
    { label: "Figer cette ligne", icon: "freeze", onSelect: freezeRowsToSelection }
  ];

  const focusSelection = (
    rowIndex = 0,
    columnIndex = 0,
    { suppressFormulaEdit = false, preserveRange = false } = {}
  ) => {
    const leavingActiveEditor =
      cellTextEditState.active &&
      (
        cellTextEditState.rowIndex !== rowIndex ||
        cellTextEditState.columnIndex !== columnIndex
      );
    if (leavingActiveEditor && !commitActiveCellTextEdit()) {
      return false;
    }
    clearEditFocusGuard();
    table.querySelectorAll(".workspace-sheet-cell-input.is-editing").forEach((node) => node.classList.remove("is-editing"));
    hideFormulaHelpPanel();
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1, originalValue: "" };
    activeSelection = {
      rowIndex: Math.max(0, Math.min(rowIndex, sheetGrid.length - 1)),
      columnIndex: Math.max(0, Math.min(columnIndex, sheetGrid[0].length - 1))
    };
    if (!preserveRange) {
      selectionRange = {
        startRowIndex: activeSelection.rowIndex,
        startColumnIndex: activeSelection.columnIndex,
        endRowIndex: activeSelection.rowIndex,
        endColumnIndex: activeSelection.columnIndex
      };
    }
    saveCurrentSelectionState();
    suppressFormulaActivation = suppressFormulaEdit;
    if (ensureVirtualWindowContainsRow(activeSelection.rowIndex)) {
      rerenderPreview({ persistGrid: false });
      rerenderAndFocusCell(activeSelection.rowIndex, activeSelection.columnIndex);
      return;
    }
    syncSelectionUi();
    const target = getCellInput(activeSelection.rowIndex, activeSelection.columnIndex);
    preserveRangeOnNextFocus = preserveRange;
    target?.focus();
  };

  const moveSelection = (rowDelta = 0, columnDelta = 0) => {
    focusSelection(activeSelection.rowIndex + rowDelta, activeSelection.columnIndex + columnDelta, {
      suppressFormulaEdit: true
    });
  };

  const getCellInput = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) =>
    renderedCellInputByKey.get(getRenderedCellKey(rowIndex, columnIndex)) ||
    table.querySelector(`[data-sheet-grid-cell="${rowIndex}:${columnIndex}"]`);

  const markCellEditingUi = (input = null, rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    table.querySelectorAll(".workspace-sheet-cell-input.is-editing").forEach((node) => {
      if (node !== input) {
        node.classList.remove("is-editing");
      }
    });
    (input || getCellInput(rowIndex, columnIndex))?.classList.add("is-editing");
  };

  const clearCellEditingUi = () => {
    table.querySelectorAll(".workspace-sheet-cell-input.is-editing").forEach((node) => node.classList.remove("is-editing"));
  };

  const clearEditFocusGuard = () => {
    if (editFocusGuardHandle) {
      window.clearTimeout(editFocusGuardHandle);
      editFocusGuardHandle = null;
    }
  };

  const queueEditFocusGuard = () => {
    clearEditFocusGuard();
    const run = () => {
      editFocusGuardHandle = null;
      if (!cellTextEditState.active || !previewShell.isConnected) {
        return;
      }
      const { rowIndex, columnIndex } = cellTextEditState;
      const input = getCellInput(rowIndex, columnIndex);
      if (!input?.isConnected || !input.classList.contains("is-editing")) {
        return;
      }
      const activeElement = document.activeElement;
      const activeIsOtherCell =
        activeElement?.classList?.contains("workspace-sheet-cell-input") &&
        (
          Number(activeElement.dataset.rowIndex || -1) !== rowIndex ||
          Number(activeElement.dataset.columnIndex || -1) !== columnIndex
        );
      if (activeIsOtherCell) {
        return;
      }
      if (activeElement !== input && activeElement !== formulaInput) {
        const selectionStart = input.selectionStart ?? input.value.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        window.requestAnimationFrame(() => {
          if (!cellTextEditState.active || !previewShell.isConnected || !input.isConnected) {
            return;
          }
          const latestActive = document.activeElement;
          const latestIsOtherCell =
            latestActive?.classList?.contains("workspace-sheet-cell-input") &&
            (
              Number(latestActive.dataset.rowIndex || -1) !== rowIndex ||
              Number(latestActive.dataset.columnIndex || -1) !== columnIndex
            );
          if (latestIsOtherCell) {
            return;
          }
          if (latestActive !== formulaInput) {
            markCellEditingUi(input, rowIndex, columnIndex);
            input.focus();
            if (typeof input.setSelectionRange === "function") {
              input.setSelectionRange(selectionStart, selectionEnd);
            }
            formulaInput.value = input.value;
            syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
          }
          queueEditFocusGuard();
        });
        return;
      }
      editFocusGuardHandle = window.setTimeout(run, 120);
    };
    editFocusGuardHandle = window.setTimeout(run, 120);
  };

  const focusKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    focusSelection(rowIndex, columnIndex, { suppressFormulaEdit: true });
  };

  const extendKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex) => {
    const nextRowIndex = clamp(rowIndex, 0, sheetGrid.length - 1);
    const nextColumnIndex = clamp(columnIndex, 0, (sheetGrid[0] || []).length - 1);
    activeSelection = { rowIndex: nextRowIndex, columnIndex: nextColumnIndex };
    setSelectionRange({
      startRowIndex: selectionRange.startRowIndex,
      startColumnIndex: selectionRange.startColumnIndex,
      endRowIndex: nextRowIndex,
      endColumnIndex: nextColumnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(nextRowIndex, nextColumnIndex)?.focus();
  };

  const moveKeyboardSelection = (rowIndex = activeSelection.rowIndex, columnIndex = activeSelection.columnIndex, { extend = false } = {}) => {
    if (extend) {
      extendKeyboardSelection(rowIndex, columnIndex);
      return;
    }
    focusKeyboardSelection(rowIndex, columnIndex);
  };

  const findDataBoundary = (rowDelta = 0, columnDelta = 0) => {
    const rowLimit = rowDelta > 0 ? sheetGrid.length - 1 : 0;
    const columnLimit = columnDelta > 0 ? (sheetGrid[0] || []).length - 1 : 0;
    const isFilled = (rowIndex, columnIndex) => String(getRawCellValue(rowIndex, columnIndex) || "").trim().length > 0;

    if (rowDelta) {
      let rowIndex = activeSelection.rowIndex;
      const columnIndex = activeSelection.columnIndex;
      const startsFilled = isFilled(rowIndex, columnIndex);
      while (rowIndex !== rowLimit) {
        const nextRowIndex = rowIndex + rowDelta;
        const nextFilled = isFilled(nextRowIndex, columnIndex);
        if (startsFilled && !nextFilled) {
          return { rowIndex, columnIndex };
        }
        if (!startsFilled && nextFilled) {
          return { rowIndex: nextRowIndex, columnIndex };
        }
        rowIndex = nextRowIndex;
      }
      return { rowIndex: rowLimit, columnIndex };
    }

    let columnIndex = activeSelection.columnIndex;
    const rowIndex = activeSelection.rowIndex;
    const startsFilled = isFilled(rowIndex, columnIndex);
    while (columnIndex !== columnLimit) {
      const nextColumnIndex = columnIndex + columnDelta;
      const nextFilled = isFilled(rowIndex, nextColumnIndex);
      if (startsFilled && !nextFilled) {
        return { rowIndex, columnIndex };
      }
      if (!startsFilled && nextFilled) {
        return { rowIndex, columnIndex: nextColumnIndex };
      }
      columnIndex = nextColumnIndex;
    }
    return { rowIndex, columnIndex: columnLimit };
  };

  const selectUsedRange = () => {
    const lastUsedCell = getLastUsedCell();
    activeSelection = { rowIndex: 0, columnIndex: 0 };
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: 0,
      endRowIndex: lastUsedCell.rowIndex,
      endColumnIndex: lastUsedCell.columnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(0, 0)?.focus();
  };

  const selectAllVisibleCells = () => {
    activeSelection = { rowIndex: 0, columnIndex: 0 };
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: 0,
      endRowIndex: sheetGrid.length - 1,
      endColumnIndex: (sheetGrid[0] || []).length - 1
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(0, 0)?.focus();
  };

  const selectActiveColumn = () => {
    setSelectionRange({
      startRowIndex: 0,
      startColumnIndex: activeSelection.columnIndex,
      endRowIndex: sheetGrid.length - 1,
      endColumnIndex: activeSelection.columnIndex
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(activeSelection.rowIndex, activeSelection.columnIndex)?.focus();
  };

  const selectActiveRow = () => {
    setSelectionRange({
      startRowIndex: activeSelection.rowIndex,
      startColumnIndex: 0,
      endRowIndex: activeSelection.rowIndex,
      endColumnIndex: (sheetGrid[0] || []).length - 1
    });
    preserveRangeOnNextFocus = true;
    suppressFormulaActivation = true;
    syncSelectionUi();
    getCellInput(activeSelection.rowIndex, activeSelection.columnIndex)?.focus();
  };

  const beginCellTextEdit = ({
    initialValue = null,
    selectAll = false,
    selectionStart = null,
    selectionEnd = null
  } = {}) => {
    if (!ensureActiveCellEditable("edit the active cell")) {
      return false;
    }
    const input = getCellInput();
    if (!input) {
      return false;
    }
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    beginSpreadsheetHistoryTransaction();
    formulaHelpCollapsed = true;
    formulaHelpDetailsExpanded = false;
    formulaHelpClosedForName = "";
    cellTextEditState = {
      active: true,
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      originalValue: getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex)
    };
    const nextValue = initialValue === null ? getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex) : initialValue;
    setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, nextValue);
    input.focus();
    markCellEditingUi(input, activeSelection.rowIndex, activeSelection.columnIndex);
    queueEditFocusGuard();
    input.value = nextValue;
    formulaInput.value = nextValue;
    syncFormulaEditorState({
      mode: "cell",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input
    });
    if (typeof input.setSelectionRange === "function") {
      if (selectAll) {
        input.setSelectionRange(0, input.value.length);
      } else if (Number.isFinite(selectionStart) || Number.isFinite(selectionEnd)) {
        const start = clamp(Number(selectionStart ?? selectionEnd ?? input.value.length), 0, input.value.length);
        const end = clamp(Number(selectionEnd ?? selectionStart ?? start), 0, input.value.length);
        input.setSelectionRange(start, end);
      } else {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (initialValue !== null) {
      scheduleCommit();
    }
    return true;
  };

  const syncCellTextEditInputValue = (input, rowIndex, columnIndex) => {
    if (!input) {
      return false;
    }
    beginSpreadsheetHistoryTransaction();
    setRawCellValue(rowIndex, columnIndex, input.value);
    syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
    if (activeSelection.rowIndex === rowIndex && activeSelection.columnIndex === columnIndex) {
      formulaInput.value = input.value;
    }
    scheduleCommit();
    scheduleGridValueRefresh();
    return true;
  };

  const routeKeyIntoActiveCellEditor = (event) => {
    if (!cellTextEditState.active || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const { rowIndex, columnIndex } = cellTextEditState;
    const input = getCellInput(rowIndex, columnIndex);
    if (!input?.isConnected || !input.classList.contains("is-editing")) {
      return false;
    }
    if (event.target === input || event.target === formulaInput) {
      return false;
    }
    const isPrintableKey = event.key.length === 1;
    const isDeleteKey = event.key === "Backspace" || event.key === "Delete";
    if (!isPrintableKey && !isDeleteKey) {
      return false;
    }
    stopSpreadsheetKeyboardEvent(event);
    markCellEditingUi(input, rowIndex, columnIndex);
    input.focus();
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
    if (typeof input.setRangeText === "function") {
      if (event.key === "Backspace") {
        if (selectionStart === selectionEnd) {
          if (selectionStart > 0) {
            input.setRangeText("", selectionStart - 1, selectionStart, "end");
          }
        } else {
          input.setRangeText("", selectionStart, selectionEnd, "end");
        }
      } else if (event.key === "Delete") {
        if (selectionStart === selectionEnd) {
          input.setRangeText("", selectionStart, selectionStart + 1, "end");
        } else {
          input.setRangeText("", selectionStart, selectionEnd, "end");
        }
      } else {
        input.setRangeText(event.key, selectionStart, selectionEnd, "end");
      }
    } else if (event.key.length === 1) {
      input.value = `${input.value.slice(0, selectionStart)}${event.key}${input.value.slice(selectionEnd)}`;
      const nextCaret = selectionStart + event.key.length;
      if (typeof input.setSelectionRange === "function") {
        input.setSelectionRange(nextCaret, nextCaret);
      }
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    queueEditFocusGuard();
    return true;
  };

  const commitActiveCellTextEdit = () => {
    if (!cellTextEditState.active) {
      return false;
    }
    clearScheduledCommit();
    const input = getCellInput(cellTextEditState.rowIndex, cellTextEditState.columnIndex);
    const nextValue = input ? input.value : getRawCellValue(cellTextEditState.rowIndex, cellTextEditState.columnIndex);
    const validationResult = validateCellValue(cellTextEditState.rowIndex, cellTextEditState.columnIndex, nextValue);
    if (!validationResult.valid) {
      window.alert(validationResult.message || "This value does not match the validation rule.");
      const fallbackValue = cellTextEditState.originalValue || "";
      setRawCellValue(cellTextEditState.rowIndex, cellTextEditState.columnIndex, fallbackValue);
      if (input) {
        input.value = fallbackValue;
        input.focus();
        if (typeof input.setSelectionRange === "function") {
          input.setSelectionRange(0, input.value.length);
        }
      }
      formulaInput.value = fallbackValue;
      commitModel(false, { trackHistory: false, updateHistoryBaseline: false });
      scheduleGridValueRefresh();
      return false;
    }
    if (input) {
      setRawCellValue(cellTextEditState.rowIndex, cellTextEditState.columnIndex, nextValue);
      committedCellBlurSkipSet.add(input);
    }
    clearEditFocusGuard();
    clearCellEditingUi();
    hideFormulaHelpPanel();
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1, originalValue: "" };
    commitModel(false, { beforeSnapshot: editHistorySnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const cancelActiveCellTextEdit = () => {
    if (!cellTextEditState.active) {
      return false;
    }
    clearScheduledCommit();
    const snapshot = editHistorySnapshot ? cloneSpreadsheetSnapshot(editHistorySnapshot) : null;
    clearEditFocusGuard();
    clearCellEditingUi();
    hideFormulaHelpPanel();
    cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1, originalValue: "" };
    if (snapshot) {
      applySpreadsheetHistorySnapshot(snapshot);
    } else {
      refreshGridValues({ preserveActiveEditor: false });
    }
    return true;
  };

  const fillSelectionFromEdge = (direction = "down") => {
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    const vertical = direction === "down";
    if ((vertical && maxRow <= minRow) || (!vertical && maxColumn <= minColumn)) {
      return false;
    }
    if (!ensureEditableBounds({ minRow, maxRow, minColumn, maxColumn }, `fill ${direction}`)) {
      return false;
    }
    clearScheduledCommit();
    setStoredClipboardPayload(null);
    persistGridIntoActiveSheet();
    const beforeSnapshot = getWorkbookSnapshot();
    let blockedValidationCount = 0;
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        if ((vertical && rowIndex === minRow) || (!vertical && columnIndex === minColumn)) {
          continue;
        }
        const sourceRowIndex = vertical ? minRow : rowIndex;
        const sourceColumnIndex = vertical ? columnIndex : minColumn;
        const sourceValue = getRawCellValue(sourceRowIndex, sourceColumnIndex);
        const nextValue = sourceValue.startsWith("=")
          ? shiftFormulaReferences(sourceValue, rowIndex - sourceRowIndex, columnIndex - sourceColumnIndex)
          : sourceValue;
        if (!setValidatedCellValue(rowIndex, columnIndex, nextValue, { silent: true })) {
          blockedValidationCount += 1;
          continue;
        }
        setCellFormat(rowIndex, columnIndex, getCellFormat(sourceRowIndex, sourceColumnIndex));
      }
    }
    showValidationBlockedAlert(blockedValidationCount);
    commitModel(false, { beforeSnapshot });
    refreshGridValues({ preserveActiveEditor: false });
    return true;
  };

  const syncClipboardOutlineUi = () => {
    const payload = getStoredClipboardPayload();
    const source = payload?.source;
    if (
      !source ||
      payload.kind !== "hydria-sheet-clipboard" ||
      source.sheetId !== workbookModel.activeSheetId ||
      source.rowCount <= 0 ||
      source.columnCount <= 0
    ) {
      clipboardOutline.hidden = true;
      return;
    }

    const startCell = table.querySelector(`[data-sheet-grid-cell="${source.minRow}:${source.minColumn}"]`);
    const endCell = table.querySelector(
      `[data-sheet-grid-cell="${source.minRow + source.rowCount - 1}:${source.minColumn + source.columnCount - 1}"]`
    );
    if (!startCell || !endCell) {
      clipboardOutline.hidden = true;
      return;
    }

    const startCellBox = startCell.closest("td");
    const endCellBox = endCell.closest("td");
    if (!startCellBox || !endCellBox) {
      clipboardOutline.hidden = true;
      return;
    }

    const leftEdge = Math.min(startCellBox.offsetLeft, endCellBox.offsetLeft);
    const topEdge = Math.min(startCellBox.offsetTop, endCellBox.offsetTop);
    const rightEdge = Math.max(
      startCellBox.offsetLeft + startCellBox.offsetWidth,
      endCellBox.offsetLeft + endCellBox.offsetWidth
    );
    const bottomEdge = Math.max(
      startCellBox.offsetTop + startCellBox.offsetHeight,
      endCellBox.offsetTop + endCellBox.offsetHeight
    );
    const left = leftEdge;
    const top = topEdge;
    const width = rightEdge - leftEdge;
    const height = bottomEdge - topEdge;

    clipboardOutline.hidden = false;
    clipboardOutline.className = `workspace-sheet-clipboard-outline${payload.mode === "cut" ? " is-cut" : ""}`;
    clipboardOutline.style.left = `${left}px`;
    clipboardOutline.style.top = `${top}px`;
    clipboardOutline.style.width = `${Math.max(8, width)}px`;
    clipboardOutline.style.height = `${Math.max(8, height)}px`;
  };

  const syncSelectionUi = () => {
    saveCurrentSelectionState();
    if (document.activeElement !== nameBox) {
      nameBox.value = getNameBoxSelectionLabel();
    }
    const rawValue = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
    const activeCellBounds = {
      minRow: activeSelection.rowIndex,
      maxRow: activeSelection.rowIndex,
      minColumn: activeSelection.columnIndex,
      maxColumn: activeSelection.columnIndex
    };
    const activeCellProtected = !isBoundsEditable(activeCellBounds);
    if (document.activeElement !== formulaInput || formulaInput.value !== rawValue) {
      formulaInput.value = rawValue;
    }
    formulaInput.readOnly = activeCellProtected;
    formulaInput.classList.toggle("is-protected", activeCellProtected);
    formulaInput.title = activeCellProtected ? describeProtectionConflict("edit the active cell", activeCellBounds) : "";
    fillHandle.disabled = !isBoundsEditable(getSelectionBounds());
    syncToolbarFormatControls();
    table.querySelectorAll(".is-selected, .is-range-selected, .is-find-match, .is-find-active").forEach((node) => {
      node.classList.remove("is-selected");
      node.classList.remove("is-range-selected");
      node.classList.remove("is-find-match");
      node.classList.remove("is-find-active");
    });
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    forEachSelectedCell((rowIndex, columnIndex) => {
      getCellInput(rowIndex, columnIndex)?.classList.add("is-range-selected");
    });
    const target = getCellInput(activeSelection.rowIndex, activeSelection.columnIndex);
    target?.classList.add("is-selected");
    findReplaceState.matches.forEach((match, index) => {
      const node = getCellInput(match.rowIndex, match.columnIndex);
      if (!node) {
        return;
      }
      node.classList.add("is-find-match");
      if (index === findReplaceState.activeMatchIndex) {
        node.classList.add("is-find-active");
      }
    });

    table.querySelectorAll(".workspace-sheet-column-letter.is-selected").forEach((node) => node.classList.remove("is-selected"));
    table
      .querySelector(`[data-sheet-column-letter="${activeSelection.columnIndex}"]`)
      ?.classList.add("is-selected");

    table.querySelectorAll(".workspace-sheet-row-label.is-selected").forEach((node) => node.classList.remove("is-selected"));
    table
      .querySelector(`[data-sheet-row-label="${activeSelection.rowIndex}"]`)
      ?.classList.add("is-selected");
    syncClipboardOutlineUi();
    updateFormulaReferenceHighlights();
    const rangeTarget = table.querySelector(`[data-sheet-grid-cell="${maxRow}:${maxColumn}"]`);
    const targetBox = rangeTarget?.closest("td");
    if (targetBox) {
      const gridShellRect = gridShell.getBoundingClientRect();
      const targetRect = targetBox.getBoundingClientRect();
      const gridScaleX = gridShell.offsetWidth ? gridShellRect.width / gridShell.offsetWidth : 1;
      const gridScaleY = gridShell.offsetHeight ? gridShellRect.height / gridShell.offsetHeight : 1;
      const rightEdge = ((targetRect.right - gridShellRect.left) / (gridScaleX || 1)) + gridShell.scrollLeft;
      const bottomEdge = ((targetRect.bottom - gridShellRect.top) / (gridScaleY || 1)) + gridShell.scrollTop;
      fillHandle.style.display = "block";
      fillHandle.style.left = `${rightEdge}px`;
      fillHandle.style.top = `${bottomEdge}px`;
    } else {
      fillHandle.style.display = "none";
    }
  };

  const refreshRenderedCharts = () => {
    const activeChartsById = new Map(getActiveSheetCharts().map((chart) => [chart.id, chart]));
    previewShell.querySelectorAll(".workspace-sheet-chart-object[data-chart-id]").forEach((card) => {
      const chart = activeChartsById.get(card.dataset.chartId || "");
      if (!chart) {
        return;
      }
      const titleNode = card.querySelector(".workspace-sheet-chart-title");
      if (titleNode) {
        titleNode.textContent = chart.title || "Chart";
      }
      const chartCanvas = card.querySelector(".workspace-sheet-chart-canvas");
      if (chartCanvas) {
        chartCanvas.replaceChildren(renderSpreadsheetChartGraphic(chart));
      }
      const legend = card.querySelector(".workspace-sheet-chart-legend");
      if (legend) {
        const legendItems = getSpreadsheetChartLegendItems(chart);
        legend.hidden = chart.showLegend === false || !legendItems.length;
        legend.replaceChildren(
          ...legendItems.map((item) => {
            const chip = document.createElement("span");
            chip.className = "workspace-sheet-chart-legend-item";
            const swatch = document.createElement("span");
            swatch.className = "workspace-sheet-chart-legend-swatch";
            swatch.style.background = item.color || chartPalette[0];
            const label = document.createElement("span");
            label.textContent = item.label || "Series";
            chip.append(swatch, label);
            return chip;
          })
        );
      }
      const rangeLabel = card.querySelector(".workspace-sheet-chart-footer .tiny");
      if (rangeLabel) {
        rangeLabel.textContent = [
          chart.seriesName || String(chart.title || "").split(/\s+by\s+/i)[0] || "",
          chart.range || ""
        ].filter(Boolean).join("  |  ");
      }
    });
  };

  const refreshGridValues = ({ preserveActiveEditor = true } = {}) => {
    renderedCellInputByKey.forEach((input) => {
      const rowIndex = Number(input.dataset.rowIndex || 0);
      const columnIndex = Number(input.dataset.columnIndex || 0);
      if (
        preserveActiveEditor &&
        rowIndex === activeSelection.rowIndex &&
        columnIndex === activeSelection.columnIndex &&
        document.activeElement === input
      ) {
        return;
      }
      const rawValue = getRawCellValue(rowIndex, columnIndex);
      const computedValue = rawValue.startsWith("=") ? evaluateCellValue(rowIndex, columnIndex) : rawValue;
      const displayValue = formatCellDisplayValue(
        rawValue.startsWith("=") ? formatFormulaResult(computedValue) : rawValue,
        rowIndex,
        columnIndex
      );
      input.value = displayValue;
      const wrapper = input.closest("td");
      if (wrapper) {
        applyCellVisualFormat(input, wrapper, rowIndex, columnIndex);
      }
    });
    applyFilterVisibility();
    applyFreezeState();
    refreshRenderedCharts();
    syncSelectionUi();
  };

  const clearQueuedGridValueRefresh = () => {
    if (gridValueRefreshFrame) {
      window.cancelAnimationFrame(gridValueRefreshFrame);
      gridValueRefreshFrame = null;
    }
    pendingGridValueRefreshOptions = null;
  };

  const scheduleGridValueRefresh = (options = {}) => {
    const nextOptions = {
      preserveActiveEditor: options.preserveActiveEditor !== false
    };
    if (pendingGridValueRefreshOptions?.preserveActiveEditor === false) {
      nextOptions.preserveActiveEditor = false;
    }
    pendingGridValueRefreshOptions = nextOptions;
    if (gridValueRefreshFrame) {
      return;
    }
    gridValueRefreshFrame = window.requestAnimationFrame(() => {
      gridValueRefreshFrame = null;
      const refreshOptions = pendingGridValueRefreshOptions || {};
      pendingGridValueRefreshOptions = null;
      refreshGridValues(refreshOptions);
    });
  };

  const applyFilterVisibility = () => {
    const currentSheet = getActiveSheetState();
    const query = String(currentSheet.filterQuery || "").trim().toLowerCase();
    const filterColumnIndex = Number(currentSheet.filterColumnIndex ?? -1);
    const tableFilters = normalizeSpreadsheetTableFilters(currentSheet.tableFilters);
    const activeTables = normalizeSpreadsheetTables(currentSheet.tables);
    const activeSlicers = getActiveSheetSlicers().filter((slicer) => String(slicer.selectedValue || "").length);
    tbody.querySelectorAll("tr").forEach((row) => {
      const rowIndex = Number(row.dataset.sheetBodyRow || 0);
      if (rowIndex === 0) {
        row.style.display = "";
        return;
      }
      if (!query) {
        row.style.display = "";
      }
      const cells = Array.from({ length: sheetGrid[0].length }, (_, columnIndex) => getRawCellValue(rowIndex, columnIndex));
      const haystack =
        filterColumnIndex >= 0 && filterColumnIndex < cells.length
          ? String(cells[filterColumnIndex] || "")
          : cells.join(" ");
      const matchesQuery = !query || haystack.toLowerCase().includes(query);
      const matchesSlicers = activeSlicers.every((slicer) =>
        String(cells[slicer.columnIndex] || "").trim().toLowerCase() === String(slicer.selectedValue || "").trim().toLowerCase()
      );
      const matchesTableFilters = activeTables.every((table) => {
        const bounds = getStructureBounds(table);
        const firstDataRow = getTableDataStartRow(table);
        const lastDataRow = getTableDataEndRow(table);
        if (rowIndex < firstDataRow || rowIndex > lastDataRow) {
          return true;
        }
        for (let columnIndex = bounds.minColumn; columnIndex <= bounds.maxColumn; columnIndex += 1) {
          const filter = tableFilters[getTableFilterKey(table, columnIndex)];
          if (!filter?.active) {
            continue;
          }
          if (!filter.selectedValues.includes(String(cells[columnIndex] ?? ""))) {
            return false;
          }
        }
        return true;
      });
      row.style.display = matchesQuery && matchesSlicers && matchesTableFilters ? "" : "none";
    });
  };

  const applyFreezeState = () => {
    const currentSheet = getActiveSheetState();
    const frozenRows = Math.max(0, Number(currentSheet.frozenRows || 0));
    const frozenColumns = Math.max(0, Number(currentSheet.frozenColumns || 0));
    const headerHeight = table.querySelector("thead tr")?.offsetHeight || 0;
    const firstColumnWidth = table.querySelector("thead th:first-child")?.offsetWidth || 52;
    const headerCells = Array.from(table.querySelectorAll("thead th"));

    headerCells.forEach((cell, index) => {
      cell.style.left = "";
      if (index > 0) {
        const width = getColumnWidth(index - 1);
        cell.style.minWidth = `${width}px`;
        cell.style.width = `${width}px`;
      }
      if (index === 0) {
        cell.style.left = "0px";
        return;
      }
      if (index <= frozenColumns) {
        let leftOffset = firstColumnWidth;
        for (let currentIndex = 1; currentIndex < index; currentIndex += 1) {
          leftOffset += headerCells[currentIndex]?.offsetWidth || 132;
        }
        cell.style.position = "sticky";
        cell.style.left = `${leftOffset}px`;
        cell.style.zIndex = "6";
      }
    });

    tbody.querySelectorAll("tr").forEach((row) => {
      const actualRowIndex = Number(row.dataset.sheetBodyRow || 0);
      const bodyCells = Array.from(row.children);
      row.style.height = `${getRowHeight(actualRowIndex)}px`;
      bodyCells.forEach((cell, columnIndex) => {
        const isRowLabel = columnIndex === 0;
        cell.style.position = "";
        cell.style.top = "";
        cell.style.left = "";
        cell.style.zIndex = "";
        if (columnIndex > 0) {
          const width = getColumnWidth(columnIndex - 1);
          cell.style.minWidth = `${width}px`;
          cell.style.width = `${width}px`;
        }

        if (actualRowIndex < frozenRows) {
          cell.style.position = "sticky";
          cell.style.top = `${headerHeight + actualRowIndex * (row.offsetHeight || 35)}px`;
          cell.style.zIndex = isRowLabel ? "7" : "6";
          cell.style.background = "#ffffff";
        }

        if (columnIndex > 0 && columnIndex <= frozenColumns) {
          let leftOffset = firstColumnWidth;
          for (let index = 1; index < columnIndex; index += 1) {
            leftOffset += bodyCells[index]?.offsetWidth || 132;
          }
          cell.style.position = "sticky";
          cell.style.left = `${leftOffset}px`;
          cell.style.zIndex = actualRowIndex < frozenRows ? "8" : "5";
          cell.style.background = "#ffffff";
        }

        if (isRowLabel) {
          cell.style.position = "sticky";
          cell.style.left = "0px";
          cell.style.zIndex = actualRowIndex < frozenRows ? "9" : "4";
          cell.style.background = "#f8f9fa";
        }
      });
    });
  };

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "workspace-sheet-corner";
  corner.textContent = "";
  headerRow.appendChild(corner);
  sheetGrid[0].forEach((_, columnIndex) => {
    const th = document.createElement("th");
    th.className = "workspace-sheet-column-letter";
    th.dataset.sheetColumnLetter = String(columnIndex);
    th.textContent = columnLetter(columnIndex);
    th.style.minWidth = `${getColumnWidth(columnIndex)}px`;
    th.style.width = `${getColumnWidth(columnIndex)}px`;
    th.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      setSelectionRange({
        startRowIndex: 0,
        startColumnIndex: columnIndex,
        endRowIndex: sheetGrid.length - 1,
        endColumnIndex: columnIndex
      });
      activeSelection = { rowIndex: activeSelection.rowIndex, columnIndex };
      syncSelectionUi();
    });
    th.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      setSelectionRange({
        startRowIndex: 0,
        startColumnIndex: columnIndex,
        endRowIndex: sheetGrid.length - 1,
        endColumnIndex: columnIndex
      });
      activeSelection = { rowIndex: activeSelection.rowIndex, columnIndex };
      syncSelectionUi();
      openContextMenu(event.clientX, event.clientY, buildColumnHeaderContextMenuItems());
    });
    const resizeHandle = document.createElement("span");
    resizeHandle.className = "workspace-sheet-column-resize-handle";
    resizeHandle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      resizeState = {
        active: true,
        kind: "column",
        index: columnIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSize: getColumnWidth(columnIndex)
      };
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    });
    th.appendChild(resizeHandle);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const renderedRowBounds = getVirtualWindowBounds();
  const frozenBodyRowCount = Math.max(0, Number(getActiveSheetState().frozenRows || 0));
  const renderedRowIndexes = Array.from(
    new Set([
      ...Array.from({ length: Math.min(frozenBodyRowCount, sheetGrid.length) }, (_, index) => index),
      ...Array.from(
        { length: renderedRowBounds.endRowIndex - renderedRowBounds.startRowIndex + 1 },
        (_, offset) => renderedRowBounds.startRowIndex + offset
      )
    ])
  ).sort((left, right) => left - right);
  renderedRowIndexes.forEach((rowIndex) => {
    const row = sheetGrid[rowIndex] || [];
    const tr = document.createElement("tr");
    tr.dataset.sheetBodyRow = String(rowIndex);
    const rowLabel = document.createElement("th");
    rowLabel.className = "workspace-sheet-row-label";
    rowLabel.dataset.sheetRowLabel = String(rowIndex);
    rowLabel.textContent = String(rowIndex + 1);
    rowLabel.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      setSelectionRange({
        startRowIndex: rowIndex,
        startColumnIndex: 0,
        endRowIndex: rowIndex,
        endColumnIndex: sheetGrid[0].length - 1
      });
      activeSelection = { rowIndex, columnIndex: activeSelection.columnIndex };
      syncSelectionUi();
    });
    rowLabel.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      setSelectionRange({
        startRowIndex: rowIndex,
        startColumnIndex: 0,
        endRowIndex: rowIndex,
        endColumnIndex: sheetGrid[0].length - 1
      });
      activeSelection = { rowIndex, columnIndex: activeSelection.columnIndex };
      syncSelectionUi();
      openContextMenu(event.clientX, event.clientY, buildRowHeaderContextMenuItems());
    });
    const rowResizeHandle = document.createElement("span");
    rowResizeHandle.className = "workspace-sheet-row-resize-handle";
    rowResizeHandle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      resizeState = {
        active: true,
        kind: "row",
        index: rowIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSize: getRowHeight(rowIndex)
      };
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    });
    rowLabel.appendChild(rowResizeHandle);
    tr.appendChild(rowLabel);
    row.forEach((_, columnIndex) => {
      const merge = findMergeAt(rowIndex, columnIndex);
      if (merge && !isMergeAnchor(rowIndex, columnIndex)) {
        return;
      }
      const td = document.createElement("td");
      if (merge && isMergeAnchor(rowIndex, columnIndex)) {
        td.rowSpan = merge.rowSpan;
        td.colSpan = merge.columnSpan;
        td.classList.add("workspace-sheet-merged-cell");
        td.style.minWidth = `${Array.from({ length: merge.columnSpan }, (_, offset) => getColumnWidth(columnIndex + offset)).reduce((sum, value) => sum + value, 0)}px`;
        td.style.width = td.style.minWidth;
      }
      const input = document.createElement("input");
      input.type = "text";
      input.className = "workspace-sheet-cell-input";
      input.dataset.sheetGridCell = `${rowIndex}:${columnIndex}`;
      input.dataset.rowIndex = String(rowIndex);
      input.dataset.columnIndex = String(columnIndex);
      renderedCellInputByKey.set(getRenderedCellKey(rowIndex, columnIndex), input);
      const rawValue = getRawCellValue(rowIndex, columnIndex);
      const cellIsProtected = isCellProtected(rowIndex, columnIndex);
      const cellNote = getCellNote(rowIndex, columnIndex);
      input.readOnly = cellIsProtected;
      input.classList.toggle("is-protected", cellIsProtected);
      input.title = [cellIsProtected ? "Protected cell" : "", cellNote?.text || ""].filter(Boolean).join("\n");
      input.value = formatCellDisplayValue(
        rawValue.startsWith("=") ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex)) : rawValue,
        rowIndex,
        columnIndex
      );
      applyCellVisualFormat(input, td, rowIndex, columnIndex);
      let preserveFormulaDisplayOnBlur = false;
      if (merge && isMergeAnchor(rowIndex, columnIndex)) {
        input.style.minHeight = `${Array.from({ length: merge.rowSpan }, (_, offset) => getRowHeight(rowIndex + offset)).reduce((sum, value) => sum + value, 0) - 2}px`;
      }
      input.addEventListener("mousedown", (event) => {
        if (maybeHandleFormulaReferencePointer(event, rowIndex, columnIndex)) {
          return;
        }
        if (event.button !== 0) {
          return;
        }
        if (
          cellTextEditState.active &&
          cellTextEditState.rowIndex === rowIndex &&
          cellTextEditState.columnIndex === columnIndex
        ) {
          return;
        }
        if (event.detail >= 2) {
          event.preventDefault();
          event.stopPropagation();
          if (cellIsProtected) {
            setSelectionRange({
              startRowIndex: rowIndex,
              startColumnIndex: columnIndex,
              endRowIndex: rowIndex,
              endColumnIndex: columnIndex
            });
            activeSelection = { rowIndex, columnIndex };
            syncSelectionUi();
            ensureEditableBounds(
              {
                minRow: rowIndex,
                maxRow: rowIndex,
                minColumn: columnIndex,
                maxColumn: columnIndex
              },
              "edit this cell"
            );
            return;
          }
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          activeSelection = { rowIndex, columnIndex };
          saveCurrentSelectionState();
          preserveRangeOnNextFocus = false;
          suppressFormulaActivation = false;
          syncSelectionUi();
          beginCellTextEdit();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          setSelectionRange({
            startRowIndex: selectionRange.startRowIndex,
            startColumnIndex: selectionRange.startColumnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        } else {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        }
        selectionDragState = {
          active: true,
          anchorRowIndex: event.shiftKey ? selectionRange.startRowIndex : rowIndex,
          anchorColumnIndex: event.shiftKey ? selectionRange.startColumnIndex : columnIndex
        };
        document.addEventListener("mousemove", handleSelectionDragMove);
        document.addEventListener("mouseup", handleSelectionDragEnd);
        focusSelection(rowIndex, columnIndex, { suppressFormulaEdit: true, preserveRange: true });
      });
      input.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
        if (
          rowIndex < minRow ||
          rowIndex > maxRow ||
          columnIndex < minColumn ||
          columnIndex > maxColumn
        ) {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          activeSelection = { rowIndex, columnIndex };
          syncSelectionUi();
        }
        openContextMenu(event.clientX, event.clientY, buildCellContextMenuItems(rowIndex, columnIndex));
      });
      input.addEventListener("focus", () => {
        activeSelection = { rowIndex, columnIndex };
        const rawCellValue = getRawCellValue(rowIndex, columnIndex);
        if (cellIsProtected) {
          clearCellEditingUi();
          preserveFormulaDisplayOnBlur = false;
          input.value = rawCellValue.startsWith("=")
            ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex))
            : rawCellValue;
          suppressFormulaActivation = false;
          formulaEditState = {
            mode: null,
            rowIndex,
            columnIndex,
            input: null,
            selectionStart: 0,
            selectionEnd: 0
          };
        } else if (suppressFormulaActivation) {
          clearCellEditingUi();
          preserveFormulaDisplayOnBlur = rawCellValue.startsWith("=");
          input.value = rawCellValue.startsWith("=")
            ? formatFormulaResult(evaluateCellValue(rowIndex, columnIndex))
            : rawCellValue;
          formulaEditState = {
            mode: null,
            rowIndex,
            columnIndex,
            input: null,
            selectionStart: 0,
            selectionEnd: 0
          };
          suppressFormulaActivation = false;
        } else {
          beginSpreadsheetHistoryTransaction();
          cellTextEditState = {
            active: true,
            rowIndex,
            columnIndex,
            originalValue: rawCellValue
          };
          markCellEditingUi(input, rowIndex, columnIndex);
          queueEditFocusGuard();
          preserveFormulaDisplayOnBlur = false;
          input.value = rawCellValue;
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        }
        if (!selectionDragState.active && !preserveRangeOnNextFocus) {
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
        }
        preserveRangeOnNextFocus = false;
        syncSelectionUi();
      });
      input.addEventListener("input", (event) => {
        preserveFormulaDisplayOnBlur = false;
        syncCellTextEditInputValue(event.target, rowIndex, columnIndex);
      });
      ["click", "keyup", "select"].forEach((eventName) => {
        input.addEventListener(eventName, () => {
          if (preserveFormulaDisplayOnBlur) {
            return;
          }
          syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        });
      });
      input.addEventListener("blur", (event) => {
        if (suppressRerenderBlurCommit || !previewShell.isConnected) {
          preserveFormulaDisplayOnBlur = false;
          return;
        }
        if (committedCellBlurSkipSet.has(input)) {
          committedCellBlurSkipSet.delete(input);
          preserveFormulaDisplayOnBlur = false;
          return;
        }
        const relatedTarget = event.relatedTarget;
        const relatedIsCellInput = relatedTarget?.classList?.contains("workspace-sheet-cell-input");
        const relatedIsOtherCell =
          relatedIsCellInput &&
          (
            Number(relatedTarget.dataset.rowIndex || -1) !== rowIndex ||
            Number(relatedTarget.dataset.columnIndex || -1) !== columnIndex
          );
        if (
          input.classList.contains("is-editing") &&
          (!relatedTarget || relatedTarget === document.body || !relatedIsOtherCell)
        ) {
          const selectionStart = input.selectionStart ?? input.value.length;
          const selectionEnd = input.selectionEnd ?? selectionStart;
          window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            const activeIsCellInput = activeElement?.classList?.contains("workspace-sheet-cell-input");
            const activeIsOtherCell =
              activeIsCellInput &&
              (
                Number(activeElement.dataset.rowIndex || -1) !== rowIndex ||
                Number(activeElement.dataset.columnIndex || -1) !== columnIndex
              );
            if (
              previewShell.isConnected &&
              input.isConnected &&
              !activeIsOtherCell &&
              activeElement !== formulaInput
            ) {
              cellTextEditState = {
                active: true,
                rowIndex,
                columnIndex,
                originalValue: cellTextEditState.originalValue || getRawCellValue(rowIndex, columnIndex)
              };
              markCellEditingUi(input, rowIndex, columnIndex);
              input.focus();
              if (typeof input.setSelectionRange === "function") {
                input.setSelectionRange(selectionStart, selectionEnd);
              }
              formulaInput.value = input.value;
              syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
            }
          });
          return;
        }
        const shouldCommitInputValue =
          !preserveFormulaDisplayOnBlur ||
          (cellTextEditState.active &&
            cellTextEditState.rowIndex === rowIndex &&
            cellTextEditState.columnIndex === columnIndex);
        if (shouldCommitInputValue) {
          const validationResult = validateCellValue(rowIndex, columnIndex, input.value);
          if (!validationResult.valid) {
            window.alert(validationResult.message || "This value does not match the validation rule.");
            const fallbackValue =
              cellTextEditState.rowIndex === rowIndex && cellTextEditState.columnIndex === columnIndex
                ? cellTextEditState.originalValue || ""
                : getRawCellValue(rowIndex, columnIndex);
            setRawCellValue(rowIndex, columnIndex, fallbackValue);
            input.value = fallbackValue;
            formulaInput.value = fallbackValue;
            preserveFormulaDisplayOnBlur = false;
            commitModel(false, { beforeSnapshot: editHistorySnapshot });
            refreshGridValues({ preserveActiveEditor: false });
            if (cellTextEditState.rowIndex === rowIndex && cellTextEditState.columnIndex === columnIndex) {
              clearEditFocusGuard();
              clearCellEditingUi();
              cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1, originalValue: "" };
            }
            return;
          }
          setRawCellValue(rowIndex, columnIndex, input.value);
        }
        preserveFormulaDisplayOnBlur = false;
        syncFormulaEditorState({ mode: "cell", rowIndex, columnIndex, input });
        commitModel(false, { beforeSnapshot: editHistorySnapshot });
        refreshGridValues();
        if (cellTextEditState.rowIndex === rowIndex && cellTextEditState.columnIndex === columnIndex) {
          clearEditFocusGuard();
          clearCellEditingUi();
          cellTextEditState = { active: false, rowIndex: -1, columnIndex: -1, originalValue: "" };
        }
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (commitActiveCellTextEdit()) {
            moveSelection(1, 0);
          }
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          if (commitActiveCellTextEdit()) {
            moveSelection(0, event.shiftKey ? -1 : 1);
          }
        }
      });
      const tableHeaderInfo = getTableCellInfo(rowIndex, columnIndex);
      const validationRule = getCellDataValidation(rowIndex, columnIndex);
      const validationListValues =
        validationRule?.type === "list" && validationRule.showDropdown !== false
          ? getValidationListValues(validationRule)
          : [];
      if (tableHeaderInfo?.isHeader && tableHeaderInfo.table.showFilterButtons) {
        td.classList.add("has-sheet-table-filter-button");
        input.classList.add("has-table-filter-button");
        const tableFilterButton = document.createElement("button");
        tableFilterButton.type = "button";
        tableFilterButton.className = "workspace-sheet-table-filter-button";
        tableFilterButton.classList.toggle("is-active", isTableColumnFilterActive(tableHeaderInfo.table, columnIndex));
        tableFilterButton.setAttribute("aria-label", `Open filter menu for ${input.value || columnLetter(columnIndex)}`);
        tableFilterButton.appendChild(
          createSheetIconNode(isTableColumnFilterActive(tableHeaderInfo.table, columnIndex) ? "filter" : "chevronDown", {
            className: "workspace-sheet-table-filter-button-icon",
            label: "Open filter menu"
          })
        );
        ["mousedown", "pointerdown"].forEach((eventName) => {
          tableFilterButton.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
        });
        tableFilterButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          activeSelection = { rowIndex, columnIndex };
          syncSelectionUi();
          openTableColumnMenu(tableFilterButton, tableHeaderInfo.table, columnIndex);
        });
        td.append(input, tableFilterButton);
      } else if (validationListValues.length) {
        td.classList.add("has-sheet-validation-dropdown");
        input.classList.add("has-validation-dropdown");
        const validationButton = document.createElement("button");
        validationButton.type = "button";
        validationButton.className = "workspace-sheet-validation-dropdown-button";
        validationButton.title = "Choose a validation value";
        validationButton.appendChild(
          createSheetIconNode("chevronDown", {
            className: "workspace-sheet-validation-dropdown-icon",
            label: "Choose value"
          })
        );
        ["mousedown", "pointerdown"].forEach((eventName) => {
          validationButton.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
        });
        validationButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectionRange({
            startRowIndex: rowIndex,
            startColumnIndex: columnIndex,
            endRowIndex: rowIndex,
            endColumnIndex: columnIndex
          });
          activeSelection = { rowIndex, columnIndex };
          syncSelectionUi();
          openSheetFloatingMenu(
            validationListValues.map((value) => ({
              label: value,
              icon: "checkbox",
              onSelect: () => {
                if (!ensureEditableBounds({
                  minRow: rowIndex,
                  maxRow: rowIndex,
                  minColumn: columnIndex,
                  maxColumn: columnIndex
                }, "change the validation value")) {
                  return false;
                }
                clearScheduledCommit();
                persistGridIntoActiveSheet();
                const beforeSnapshot = getWorkbookSnapshot();
                setRawCellValue(rowIndex, columnIndex, value);
                commitModel(false, { beforeSnapshot });
                refreshGridValues({ preserveActiveEditor: false });
                return true;
              }
            })),
            validationButton
          );
        });
        td.append(input, validationButton);
      } else {
        td.appendChild(input);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  getActiveSheetCharts().forEach((chart) => {
    const chartFrame = clampChartFrame(chart);
    const card = document.createElement("article");
    card.className = "workspace-sheet-chart-object";
    card.dataset.chartId = chart.id;
    card.style.left = `${chartFrame.x}px`;
    card.style.top = `${chartFrame.y}px`;
    card.style.width = `${chartFrame.width}px`;
    card.style.height = `${chartFrame.height}px`;
    const syncChartCardFrameData = (frame = chartFrame) => {
      card.dataset.chartX = String(Number(frame.x) || 16);
      card.dataset.chartY = String(Number(frame.y) || 16);
      card.dataset.chartWidth = String(Number(frame.width) || 432);
      card.dataset.chartHeight = String(Number(frame.height) || 284);
    };
    syncChartCardFrameData(chartFrame);
    card.tabIndex = 0;
    const readChartCardFrame = () =>
      clampChartFrame({
        x: Number.parseFloat(card.dataset.chartX || card.style.left || "") || chartFrame.x,
        y: Number.parseFloat(card.dataset.chartY || card.style.top || "") || chartFrame.y,
        width: Number.parseFloat(card.dataset.chartWidth || card.style.width || "") || chartFrame.width,
        height: Number.parseFloat(card.dataset.chartHeight || card.style.height || "") || chartFrame.height
      });

    const toolbar = document.createElement("div");
    toolbar.className = "workspace-sheet-chart-toolbar";
    const kindBadge = document.createElement("span");
    kindBadge.className = "workspace-sheet-chart-kind tiny";
    kindBadge.textContent = formatChartKindLabel(chart.kind);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "workspace-sheet-chart-icon-button workspace-preview-ignore-drag";
    removeButton.textContent = "×";
    removeButton.title = "Remove chart";
    removeButton.addEventListener("click", () => removeActiveSheetChart(chart.id));
    toolbar.append(kindBadge, removeButton);
    card.appendChild(toolbar);

    const title = document.createElement("div");
    title.className = "workspace-sheet-chart-title";
    title.textContent = chart.title || "Chart";
    title.title = "Double-click to rename";
    title.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextTitle = window.prompt("Chart title", chart.title || "Chart");
      if (nextTitle === null) {
        return;
      }
      updateActiveSheetChart(chart.id, () => ({
        title: String(nextTitle || chart.title || "Chart").trim() || chart.title || "Chart"
      }));
    });
    card.appendChild(title);

    const stage = document.createElement("div");
    stage.className = "workspace-sheet-chart-stage";
    const chartCanvas = document.createElement("div");
    chartCanvas.className = "workspace-sheet-chart-canvas is-floating";
    chartCanvas.appendChild(renderSpreadsheetChartGraphic(chart));
    stage.appendChild(chartCanvas);
    card.appendChild(stage);

    const legendItems = getSpreadsheetChartLegendItems(chart);
    const legend = document.createElement("div");
    legend.className = "workspace-sheet-chart-legend";
    legend.hidden = chart.showLegend === false || !legendItems.length;
    legendItems.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "workspace-sheet-chart-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "workspace-sheet-chart-legend-swatch";
      swatch.style.background = item.color || chartPalette[0];
      const label = document.createElement("span");
      label.textContent = item.label || "Series";
      chip.append(swatch, label);
      legend.appendChild(chip);
    });
    card.appendChild(legend);

    const footer = document.createElement("div");
    footer.className = "workspace-sheet-chart-footer";
    const rangeLabel = document.createElement("span");
    rangeLabel.className = "tiny";
    rangeLabel.textContent = [
      chart.seriesName || String(chart.title || "").split(/\s+by\s+/i)[0] || "",
      chart.range || ""
    ].filter(Boolean).join("  |  ");
    footer.appendChild(rangeLabel);
    card.appendChild(footer);

    ["top", "right", "bottom", "left"].forEach((edge) => {
      const dragEdge = document.createElement("span");
      dragEdge.className = `workspace-sheet-chart-drag-edge is-${edge}`;
      dragEdge.setAttribute("aria-hidden", "true");
      card.appendChild(dragEdge);
    });

    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "workspace-sheet-chart-resize-handle workspace-preview-resize-handle";
    resizeHandle.title = "Resize chart";
    card.appendChild(resizeHandle);

    attachPreviewDrag(card, {
      initialX: chartFrame.x,
      initialY: chartFrame.y,
      minX: 16,
      minY: 16,
      getBounds: getChartLayerBounds,
      getScale: getGridShellScaleFactor,
      onStart: beginChartFrameGesture,
      onEnd: endChartFrameGesture,
      onUpdate: (nextX, nextY) => {
        const nextFrame = clampChartFrame({ ...readChartCardFrame(), x: nextX, y: nextY });
        syncChartCardFrameData(nextFrame);
        updateActiveSheetChartFrameModel(chart.id, nextFrame, { syncDraft: true });
      },
      onCommit: (nextX, nextY) => {
        const nextFrame = clampChartFrame({ ...readChartCardFrame(), x: nextX, y: nextY });
        syncChartCardFrameData(nextFrame);
        commitActiveSheetChartFrame(chart.id, card, nextFrame);
      }
    });

    attachPreviewResize(resizeHandle, {
      target: card,
      initialWidth: chartFrame.width,
      initialHeight: chartFrame.height,
      minWidth: 280,
      minHeight: 180,
      getBounds: () => {
        const layerBounds = getChartLayerBounds();
        const currentFrame = readChartCardFrame();
        return {
          width: Math.max(280, layerBounds.width - currentFrame.x + 12),
          height: Math.max(180, layerBounds.height - currentFrame.y + 12)
        };
      },
      getScale: getGridShellScaleFactor,
      onStart: beginChartFrameGesture,
      onEnd: endChartFrameGesture,
      onUpdate: (nextWidth, nextHeight) => {
        const nextFrame = clampChartFrame({ ...readChartCardFrame(), width: nextWidth, height: nextHeight });
        syncChartCardFrameData(nextFrame);
        updateActiveSheetChartFrameModel(chart.id, nextFrame, { syncDraft: true });
      },
      onCommit: (nextWidth, nextHeight) => {
        const nextFrame = clampChartFrame({ ...readChartCardFrame(), width: nextWidth, height: nextHeight });
        syncChartCardFrameData(nextFrame);
        commitActiveSheetChartFrame(chart.id, card, nextFrame);
      }
    });

    gridContent.appendChild(card);
  });

  previewShell.appendChild(gridShell);

  const handleFillDragMove = (event) => {
    const targetInput = findCellInputFromPointer(event.clientX, event.clientY);
    if (!targetInput) {
      return;
    }
    fillDragState.targetRowIndex = Number(targetInput.dataset.rowIndex || fillDragState.targetRowIndex);
    fillDragState.targetColumnIndex = Number(targetInput.dataset.columnIndex || fillDragState.targetColumnIndex);
    updateFillPreview();
  };

  const handleFillDragEnd = () => {
    if (!fillDragState.active) {
      return;
    }
    document.removeEventListener("mousemove", handleFillDragMove);
    document.removeEventListener("mouseup", handleFillDragEnd);
    applyFillDrag();
  };

  fillHandle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const { minRow, maxRow, minColumn, maxColumn } = getSelectionBounds();
    fillDragState = {
      active: true,
      startRowIndex: minRow,
      startColumnIndex: minColumn,
      endRowIndex: maxRow,
      endColumnIndex: maxColumn,
      targetRowIndex: maxRow,
      targetColumnIndex: maxColumn
    };
    updateFillPreview();
    document.addEventListener("mousemove", handleFillDragMove);
    document.addEventListener("mouseup", handleFillDragEnd);
  });

  gridShell.addEventListener("scroll", () => {
    syncSelectionUi();
  });
  gridShell.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      adjustActiveSheetZoom(event.deltaY < 0 ? 0.05 : -0.05);
    },
    { passive: false }
  );

  formulaInput.addEventListener("input", (event) => {
    if (!ensureActiveCellEditable("edit the formula")) {
      event.target.value = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
      return;
    }
    beginSpreadsheetHistoryTransaction();
    setRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex, event.target.value);
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: event.target
    });
    scheduleCommit();
    scheduleGridValueRefresh();
  });
  const commitFormulaInputValue = () => {
    const { rowIndex, columnIndex } = activeSelection;
    const validationResult = validateCellValue(rowIndex, columnIndex, formulaInput.value);
    if (!validationResult.valid) {
      clearScheduledCommit();
      window.alert(validationResult.message || "This value does not match the validation rule.");
      setRawCellValue(rowIndex, columnIndex, formulaInputOriginalValue || "");
      formulaInput.value = formulaInputOriginalValue || "";
      commitModel(false, { trackHistory: false, updateHistoryBaseline: false });
      scheduleGridValueRefresh();
      formulaInput.focus();
      if (typeof formulaInput.setSelectionRange === "function") {
        formulaInput.setSelectionRange(0, formulaInput.value.length);
      }
      return false;
    }
    commitModel(false, { beforeSnapshot: editHistorySnapshot });
    formulaInputOriginalValue = formulaInput.value;
    return true;
  };
  formulaInput.addEventListener("focus", (event) => {
    if (!isBoundsEditable({
      minRow: activeSelection.rowIndex,
      maxRow: activeSelection.rowIndex,
      minColumn: activeSelection.columnIndex,
      maxColumn: activeSelection.columnIndex
    })) {
      syncSelectionUi();
      return;
    }
    beginSpreadsheetHistoryTransaction();
    formulaHelpCollapsed = true;
    formulaHelpDetailsExpanded = false;
    formulaInputOriginalValue = getRawCellValue(activeSelection.rowIndex, activeSelection.columnIndex);
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: event.target
    });
    syncSelectionUi();
  });
  ["click", "keyup", "select"].forEach((eventName) => {
    formulaInput.addEventListener(eventName, (event) => {
      syncFormulaEditorState({
        mode: "formula",
        rowIndex: activeSelection.rowIndex,
        columnIndex: activeSelection.columnIndex,
        input: event.target
      });
    });
  });
  formulaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitFormulaInputValue()) {
        focusSelection(activeSelection.rowIndex, activeSelection.columnIndex, { suppressFormulaEdit: true });
      }
    }
  });
  formulaInput.addEventListener("blur", () => {
    if (suppressRerenderBlurCommit || !previewShell.isConnected) {
      return;
    }
    syncFormulaEditorState({
      mode: "formula",
      rowIndex: activeSelection.rowIndex,
      columnIndex: activeSelection.columnIndex,
      input: formulaInput
    });
    if (commitFormulaInputValue()) {
      refreshGridValues();
    }
  });

  const sheetIsKeyboardContext = (event) => {
    const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
    const targetIsInsideSheet =
      eventPath.includes(previewShell) || previewShell.contains(event.target);
    return (
      previewShell.isConnected &&
      (targetIsInsideSheet ||
        previewShell.contains(document.activeElement) ||
        document.activeElement === document.body)
    );
  };

  const stopSpreadsheetClipboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const stopSpreadsheetKeyboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const shouldUseNativeSpreadsheetKeyboard = (event) => {
    const target = event.target;
    if (!target || !previewShell.contains(target)) {
      return false;
    }
    if (target === formulaInput || target === nameBox || target.isContentEditable) {
      return true;
    }
    if (target.matches?.("textarea")) {
      return true;
    }
    if (target.matches?.("input") && !target.classList.contains("workspace-sheet-cell-input")) {
      return true;
    }
    if (target.classList?.contains("workspace-sheet-cell-input")) {
      return target.classList.contains("is-editing");
    }
    return false;
  };

  const getKeyboardMoveTarget = (event) => {
    const pageStep = Math.max(1, Math.floor((gridShell.clientHeight || 340) / Math.max(1, getRowHeight(activeSelection.rowIndex))) - 2);
    const lastUsedCell = getLastUsedCell();
    switch (event.key) {
      case "ArrowUp":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(-1, 0)
          : { rowIndex: activeSelection.rowIndex - 1, columnIndex: activeSelection.columnIndex };
      case "ArrowDown":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(1, 0)
          : { rowIndex: activeSelection.rowIndex + 1, columnIndex: activeSelection.columnIndex };
      case "ArrowLeft":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(0, -1)
          : { rowIndex: activeSelection.rowIndex, columnIndex: activeSelection.columnIndex - 1 };
      case "ArrowRight":
        return event.ctrlKey || event.metaKey
          ? findDataBoundary(0, 1)
          : { rowIndex: activeSelection.rowIndex, columnIndex: activeSelection.columnIndex + 1 };
      case "Home":
        return event.ctrlKey || event.metaKey
          ? { rowIndex: 0, columnIndex: 0 }
          : { rowIndex: activeSelection.rowIndex, columnIndex: 0 };
      case "End":
        return event.ctrlKey || event.metaKey
          ? lastUsedCell
          : { rowIndex: activeSelection.rowIndex, columnIndex: getRowLastUsedColumn(activeSelection.rowIndex) };
      case "PageUp":
        return { rowIndex: activeSelection.rowIndex - pageStep, columnIndex: activeSelection.columnIndex };
      case "PageDown":
        return { rowIndex: activeSelection.rowIndex + pageStep, columnIndex: activeSelection.columnIndex };
      default:
        return null;
    }
  };

  const handleSpreadsheetKeyboardShortcut = (event) => {
    if (cellTextEditState.active) {
      if (routeKeyIntoActiveCellEditor(event)) {
        return true;
      }
      if (event.key === "Escape") {
        stopSpreadsheetKeyboardEvent(event);
        cancelActiveCellTextEdit();
        return true;
      }
      if (event.key === "Enter") {
        stopSpreadsheetKeyboardEvent(event);
        const rowDelta = event.shiftKey ? -1 : 1;
        if (commitActiveCellTextEdit()) {
          focusKeyboardSelection(activeSelection.rowIndex + rowDelta, activeSelection.columnIndex);
        }
        return true;
      }
      if (event.key === "Tab") {
        stopSpreadsheetKeyboardEvent(event);
        const columnDelta = event.shiftKey ? -1 : 1;
        if (commitActiveCellTextEdit()) {
          focusKeyboardSelection(activeSelection.rowIndex, activeSelection.columnIndex + columnDelta);
        }
        return true;
      }
      return false;
    }

    if (shouldUseNativeSpreadsheetKeyboard(event)) {
      return false;
    }

    if (event.key === "Escape" && !sheetMenuPanel.hidden) {
      stopSpreadsheetKeyboardEvent(event);
      closeSheetMenu();
      return true;
    }

    if (event.key === "Escape" && isRibbonVisible) {
      stopSpreadsheetKeyboardEvent(event);
      setActiveRibbonTab(activeRibbonTab, { visible: false });
      return true;
    }

    if (event.key === "Escape" && isSheetExpanded) {
      stopSpreadsheetKeyboardEvent(event);
      setExpandedMode(false);
      return true;
    }

    if (event.key === "Escape" && getStoredClipboardPayload()) {
      stopSpreadsheetKeyboardEvent(event);
      setStoredClipboardPayload(null);
      syncSelectionUi();
      return true;
    }

    const key = String(event.key || "").toLowerCase();
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier) {
      if (key === "z" && !event.shiftKey) {
        stopSpreadsheetKeyboardEvent(event);
        undoSpreadsheetAction();
        return true;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        stopSpreadsheetKeyboardEvent(event);
        redoSpreadsheetAction();
        return true;
      }
      if (key === "a") {
        stopSpreadsheetKeyboardEvent(event);
        selectUsedRange();
        return true;
      }
      if (key === "f") {
        stopSpreadsheetKeyboardEvent(event);
        openFindReplaceBar();
        return true;
      }
      if (key === "h") {
        stopSpreadsheetKeyboardEvent(event);
        openFindReplaceBar({ showReplace: true });
        return true;
      }
      if (event.code === "Space") {
        stopSpreadsheetKeyboardEvent(event);
        if (event.shiftKey) {
          selectAllVisibleCells();
        } else {
          selectActiveColumn();
        }
        return true;
      }
      if (key === "d") {
        stopSpreadsheetKeyboardEvent(event);
        fillSelectionFromEdge("down");
        return true;
      }
      if (key === "r") {
        stopSpreadsheetKeyboardEvent(event);
        fillSelectionFromEdge("right");
        return true;
      }
      if (key === "b") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("bold");
        return true;
      }
      if (key === "i") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("italic");
        return true;
      }
      if (key === "u") {
        stopSpreadsheetKeyboardEvent(event);
        toggleSelectedTextStyle("underline");
        return true;
      }
    }

    if (!hasCommandModifier && event.shiftKey && event.code === "Space") {
      stopSpreadsheetKeyboardEvent(event);
      selectActiveRow();
      return true;
    }

    const moveTarget = getKeyboardMoveTarget(event);
    if (moveTarget) {
      stopSpreadsheetKeyboardEvent(event);
      moveKeyboardSelection(moveTarget.rowIndex, moveTarget.columnIndex, { extend: event.shiftKey });
      return true;
    }

    if (event.key === "Enter") {
      stopSpreadsheetKeyboardEvent(event);
      focusKeyboardSelection(activeSelection.rowIndex + (event.shiftKey ? -1 : 1), activeSelection.columnIndex);
      return true;
    }

    if (event.key === "Tab") {
      stopSpreadsheetKeyboardEvent(event);
      focusKeyboardSelection(activeSelection.rowIndex, activeSelection.columnIndex + (event.shiftKey ? -1 : 1));
      return true;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      stopSpreadsheetKeyboardEvent(event);
      clearSelectedCells();
      return true;
    }

    if (event.key === "F2") {
      stopSpreadsheetKeyboardEvent(event);
      beginCellTextEdit();
      return true;
    }

    if (!event.altKey && !hasCommandModifier && event.key.length === 1) {
      stopSpreadsheetKeyboardEvent(event);
      beginCellTextEdit({ initialValue: event.key });
      return true;
    }

    return false;
  };

  registerSpreadsheetShortcutHandler(historyKey, previewShell, {
    keydown: (event) => {
      if (!sheetIsKeyboardContext(event)) {
        return;
      }
      handleSpreadsheetKeyboardShortcut(event);
    },
    copy: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      copySelectedCells(event.clipboardData);
    },
    cut: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      cutSelectedCells(event.clipboardData);
    },
    paste: (event) => {
      if (!sheetIsKeyboardContext(event) || shouldUseNativeTextClipboard(event)) {
        return;
      }
      stopSpreadsheetClipboardEvent(event);
      pasteFromClipboard(event.clipboardData);
    }
  });

  const bottomBar = document.createElement("div");
  bottomBar.className = "workspace-sheet-bottom-bar";
  const sheetTabs = document.createElement("div");
  sheetTabs.className = "workspace-sheet-tabbar";
  const addSheetButton = document.createElement("button");
  addSheetButton.type = "button";
  addSheetButton.className = "workspace-sheet-add-button";
  addSheetButton.textContent = "+";
  addSheetButton.title = "New sheet";
  addSheetButton.addEventListener("click", () => createSheetFromActive());
  sheetTabs.appendChild(addSheetButton);
  const hiddenSheets = getHiddenSheets();
  if (hiddenSheets.length) {
    const hiddenSheetButton = document.createElement("button");
    hiddenSheetButton.type = "button";
    hiddenSheetButton.className = "workspace-sheet-tab-pill workspace-sheet-tab-pill-ghost";
    hiddenSheetButton.textContent = `Hidden (${hiddenSheets.length})`;
    hiddenSheetButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSheetFloatingMenu(
        hiddenSheets.map((sheet) => ({
          label: `Unhide ${sheet.name || "Sheet"}`,
          onSelect: () => unhideSheet(sheet.id)
        })),
        hiddenSheetButton
      );
    });
    sheetTabs.appendChild(hiddenSheetButton);
  }
  getVisibleSheets().forEach((sheet) => {
    const sheetTab = document.createElement("button");
    sheetTab.type = "button";
    sheetTab.className = `workspace-sheet-tab-pill${sheet.id === workbookModel.activeSheetId ? " active" : ""}${sheet.protected ? " is-protected" : ""}`;
    sheetTab.textContent = sheet.name || "Sheet";
    sheetTab.title = sheet.protected
      ? `${sheet.name || "Sheet"} (Protected)`
      : normalizeSpreadsheetProtectionRanges(sheet.protectedRanges).length
        ? `${sheet.name || "Sheet"} (${normalizeSpreadsheetProtectionRanges(sheet.protectedRanges).length} protected range${normalizeSpreadsheetProtectionRanges(sheet.protectedRanges).length > 1 ? "s" : ""})`
        : sheet.name || "Sheet";
    sheetTab.addEventListener("click", () => {
      if (sheet.id === workbookModel.activeSheetId) {
        return;
      }
      persistGridIntoActiveSheet();
      workbookModel.activeSheetId = sheet.id;
      persistWorkbookState(false, { trackHistory: false });
      rerenderPreview({ persistGrid: false });
    });
    sheetTab.addEventListener("dblclick", () => {
      renameSheetById(sheet.id);
    });
    sheetTab.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSheetFloatingMenu(
        buildSheetTabContextMenuItems(sheet.id),
        sheetTab,
        {
          clientX: event.clientX,
          clientY: event.clientY,
          contextMenu: true
        }
      );
    });
    sheetTabs.appendChild(sheetTab);
  });
  const status = document.createElement("div");
  status.className = "workspace-sheet-status";
  const protectedRangeCount = getActiveSheetProtectedRanges().length;
  const protectionStatus = getActiveSheetState().protected
    ? " | Protected"
    : protectedRangeCount
      ? ` | ${protectedRangeCount} protected range${protectedRangeCount > 1 ? "s" : ""}`
      : "";
  status.textContent = `${profile?.contextLabelA || "Sheet profile"}: ${getActiveSheetState().name || profile?.contextValueA || "Working sheet"}${protectionStatus}`;

  const zoomControls = document.createElement("div");
  zoomControls.className = "workspace-sheet-zoom-controls";
  const currentZoomPercent = Math.round(getActiveSheetZoomLevel() * 100);
  const zoomOutButton = document.createElement("button");
  zoomOutButton.type = "button";
  zoomOutButton.className = "workspace-sheet-zoom-button";
  zoomOutButton.textContent = "-";
  zoomOutButton.title = "Zoom out";
  zoomOutButton.disabled = currentZoomPercent <= 50;
  zoomOutButton.addEventListener("click", () => adjustActiveSheetZoom(-0.05));

  const zoomSelect = document.createElement("select");
  zoomSelect.className = "workspace-sheet-zoom-select";
  zoomSelect.title = "Zoom";
  const zoomPercentOptions = [50, 60, 70, 75, 80, 85, 90, 100, 110, 125, 150, 175, 200];
  if (!zoomPercentOptions.includes(currentZoomPercent)) {
    zoomPercentOptions.push(currentZoomPercent);
  }
  zoomPercentOptions
    .sort((left, right) => left - right)
    .forEach((percent) => {
      const option = document.createElement("option");
      option.value = String(percent);
      option.textContent = `${percent}%`;
      zoomSelect.appendChild(option);
    });
  zoomSelect.value = String(currentZoomPercent);
  zoomSelect.addEventListener("change", () => {
    setActiveSheetZoomLevel(Number(zoomSelect.value) / 100);
  });

  const zoomInButton = document.createElement("button");
  zoomInButton.type = "button";
  zoomInButton.className = "workspace-sheet-zoom-button";
  zoomInButton.textContent = "+";
  zoomInButton.title = "Zoom in";
  zoomInButton.disabled = currentZoomPercent >= 200;
  zoomInButton.addEventListener("click", () => adjustActiveSheetZoom(0.05));

  zoomControls.append(zoomOutButton, zoomSelect, zoomInButton);
  const bottomActions = document.createElement("div");
  bottomActions.className = "workspace-sheet-bottom-actions";
  bottomActions.append(status, zoomControls);
  bottomBar.append(sheetTabs, bottomActions);
  previewShell.appendChild(bottomBar);

  mountPreviewShell();
  syncFindReplaceBarUi();
  applyFilterVisibility();
  applyFreezeState();
  syncSelectionUi();
}

function renderDataPreview(
  container,
  filePath = "",
  content = "",
  {
    workObject = null,
    onHeaderEdit = null,
    onCellEdit = null,
    onGridEdit = null
  } = {}
) {
  const profile = getDatasetWorkspacePreviewProfile(workObject);
  if (isJsonPath(filePath)) {
    try {
      const parsed = JSON.parse(content);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? Object.entries(parsed).map(([key, value]) => ({ key, value }))
          : [];

      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "workspace-surface-empty";
        empty.textContent = "This dataset is empty.";
        container.appendChild(empty);
        return;
      }

      const columns = Array.isArray(rows[0])
        ? rows[0].map((_, index) => `Column ${index + 1}`)
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
      const insightGrid = createPreviewInsightGrid([
        { label: "Rows", value: rows.length, meta: "JSON records visible in this workspace" },
        { label: "Columns", value: columns.length, meta: columns.slice(0, 3).join(", ") || "Structured fields" }
      ]);
      if (insightGrid) {
        container.appendChild(insightGrid);
      }

      const previewShell = document.createElement("section");
      previewShell.className = "workspace-spreadsheet-preview-shell";
      const previewToolbar = document.createElement("div");
      previewToolbar.className = "workspace-spreadsheet-preview-toolbar";
      const toolbarMeta = document.createElement("div");
      toolbarMeta.className = "workspace-code-toolbar-meta";
      const toolbarTitle = document.createElement("strong");
      toolbarTitle.textContent = workObject?.title || friendlyPathLabel(filePath) || profile.workspaceLabel;
      const toolbarHint = document.createElement("span");
      toolbarHint.className = "tiny";
      toolbarHint.textContent = `${rows.length} records | ${columns.length} fields`;
      toolbarMeta.append(toolbarTitle, toolbarHint);
      const tabs = document.createElement("div");
      tabs.className = "workspace-sheet-tabs";
      [profile.primaryTab, profile.secondaryTab].forEach((label, index) => {
        const tab = document.createElement("span");
        tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
        tab.textContent = label;
        tabs.appendChild(tab);
      });
      previewToolbar.append(toolbarMeta, tabs);
      previewShell.appendChild(previewToolbar);

      const profileRow = document.createElement("div");
      profileRow.className = "workspace-document-context-grid";
      [
        { label: profile.contextLabelA, value: Array.isArray(parsed) ? profile.contextValueA : "Object dataset" },
        { label: profile.contextLabelB, value: columns[0] || "key" }
      ].forEach((item) => {
        const card = document.createElement("article");
        card.className = "workspace-document-context-card";
        const label = document.createElement("span");
        label.className = "tiny";
        label.textContent = item.label;
        const text = document.createElement("p");
        text.textContent = item.value;
        card.append(label, text);
        profileRow.appendChild(card);
      });
      previewShell.appendChild(profileRow);

      const selectionStrip = document.createElement("div");
      selectionStrip.className = "workspace-flow-chip-list";
      [
        profile.primaryTab,
        `${rows.length} rows`,
        `${columns.length} fields`,
        Array.isArray(parsed) ? "Array source" : "Object source"
      ].forEach((label, index) => {
        const chip = document.createElement("span");
        chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
        chip.textContent = label;
        selectionStrip.appendChild(chip);
      });
      previewShell.appendChild(selectionStrip);

      const tableShell = document.createElement("div");
      tableShell.className = "workspace-table-shell workspace-sheet-stage-table-shell";
      const table = document.createElement("table");
      table.className = "workspace-data-table";
      const headerRow = document.createElement("tr");
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.appendChild(th);
      });
      const thead = document.createElement("thead");
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rows.slice(0, 20).forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
          const td = document.createElement("td");
          td.textContent =
            row && typeof row === "object" && !Array.isArray(row)
              ? JSON.stringify(row[column] ?? "")
              : JSON.stringify(row);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableShell.appendChild(table);
      previewShell.appendChild(tableShell);
      container.appendChild(previewShell);
      return;
    } catch {
      renderCodePreview(container, content, filePath);
      return;
    }
  }

  if (isCsvPath(filePath)) {
    const model = parseSpreadsheetPreviewContent(content, {
      defaultSheetName: profile?.sheetName || "Sheet 1"
    });
    renderSpreadsheetClonePreview(container, {
      model,
      profile,
      workObject,
      filePath,
      onGridEdit
    });
    return;
    const columnLetter = (index) => {
      let value = index + 1;
      let label = "";
      while (value > 0) {
        const remainder = (value - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        value = Math.floor((value - 1) / 26);
      }
      return label;
    };
    const previewShell = document.createElement("section");
    previewShell.className = "workspace-sheet-app";

    const commitModel = (refreshWorkspace = false) => {
      onGridEdit?.(
        {
          columns: [...model.columns],
          rows: model.rows.map((row) => [...row])
        },
        { refreshWorkspace }
      );
    };

    let commitHandle = null;
    const scheduleCommit = () => {
      if (commitHandle) {
        window.clearTimeout(commitHandle);
      }
      commitHandle = window.setTimeout(() => {
        commitModel(false);
        commitHandle = null;
      }, 140);
    };

    const menuBar = document.createElement("div");
    menuBar.className = "workspace-sheet-menubar";
    ["File", "Edit", "View", "Insert", "Format", "Data", "Tools", "Extensions", "Help"].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-sheet-menu-button";
      button.textContent = label;
      menuBar.appendChild(button);
    });
    previewShell.appendChild(menuBar);

    const topBar = document.createElement("div");
    topBar.className = "workspace-sheet-topbar";
    const titleGroup = document.createElement("div");
    titleGroup.className = "workspace-sheet-title-group";
    const title = document.createElement("strong");
    title.textContent = workObject?.title || friendlyPathLabel(filePath) || profile.sheetName;
    const subtitle = document.createElement("span");
    subtitle.className = "tiny";
    subtitle.textContent = `${model.rows.length} rows | ${model.columns.length} columns`;
    titleGroup.append(title, subtitle);
    const topTabs = document.createElement("div");
    topTabs.className = "workspace-sheet-tabs";
    [profile.primaryTab, profile.secondaryTab].forEach((label, index) => {
      const tab = document.createElement("span");
      tab.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
      tab.textContent = label;
      topTabs.appendChild(tab);
    });
    topBar.append(titleGroup, topTabs);
    previewShell.appendChild(topBar);

    const toolbar = document.createElement("div");
    toolbar.className = "workspace-sheet-toolbar";
    const makeToolbarButton = (label, onClick, accent = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-sheet-toolbar-button${accent ? " accent" : ""}`;
      button.textContent = label;
      button.addEventListener("click", onClick);
      return button;
    };
    const toolbarGroupEdit = document.createElement("div");
    toolbarGroupEdit.className = "workspace-sheet-toolbar-group";
    toolbarGroupEdit.append(
      makeToolbarButton("Undo", () => document.execCommand("undo")),
      makeToolbarButton("Redo", () => document.execCommand("redo")),
      makeToolbarButton("Bold", () => document.execCommand("bold")),
      makeToolbarButton("Italic", () => document.execCommand("italic"))
    );
    const toolbarGroupStructure = document.createElement("div");
    toolbarGroupStructure.className = "workspace-sheet-toolbar-group";
    toolbarGroupStructure.append(
      makeToolbarButton("Insert row", () => {
        model.rows.push(Array.from({ length: model.columns.length }, () => ""));
        commitModel(true);
      }),
      makeToolbarButton("Insert column", () => {
        model.columns.push(`Column ${model.columns.length + 1}`);
        model.rows = model.rows.map((row) => [...row, ""]);
        commitModel(true);
      }),
      makeToolbarButton("Delete row", () => {
        if (model.rows.length <= 1) {
          return;
        }
        model.rows = model.rows.slice(0, -1);
        commitModel(true);
      }),
      makeToolbarButton("Delete column", () => {
        if (model.columns.length <= 1) {
          return;
        }
        model.columns = model.columns.slice(0, -1);
        model.rows = model.rows.map((row) => row.slice(0, -1));
        commitModel(true);
      }),
      makeToolbarButton("Sum row", () => {
        const totals = model.columns.map((_, index) => {
          if (index === 0) {
            return "Total";
          }
          const values = model.rows
            .map((row) => Number(String(row[index] || "").replace(",", ".")))
            .filter((value) => Number.isFinite(value));
          if (!values.length) {
            return "";
          }
          const total = values.reduce((sum, value) => sum + value, 0);
          return Number.isInteger(total) ? String(total) : total.toFixed(2);
        });
        model.rows.push(totals);
        commitModel(true);
      }, true)
    );
    toolbar.append(toolbarGroupEdit, toolbarGroupStructure);
    previewShell.appendChild(toolbar);

    const formulaBar = document.createElement("div");
    formulaBar.className = "workspace-formula-bar workspace-formula-bar-live";
    const nameBox = document.createElement("input");
    nameBox.type = "text";
    nameBox.className = "workspace-sheet-name-box";
    nameBox.readOnly = true;
    const formulaLabel = document.createElement("span");
    formulaLabel.className = "tiny";
    formulaLabel.textContent = "fx";
    const formulaValue = document.createElement("input");
    formulaValue.type = "text";
    formulaValue.className = "workspace-sheet-formula-input";
    formulaBar.append(nameBox, formulaLabel, formulaValue);
    previewShell.appendChild(formulaBar);

    const gridShell = document.createElement("div");
    gridShell.className = "workspace-sheet-grid-shell";
    const table = document.createElement("table");
    table.className = "workspace-sheet-grid-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "workspace-sheet-corner";
    corner.textContent = "";
    headRow.appendChild(corner);

    let activeSelection = { kind: "header", columnIndex: 0, rowIndex: 0 };
    const cellSelector = (selection) =>
      selection.kind === "header"
        ? `[data-sheet-header-cell="${selection.columnIndex}"]`
        : `[data-sheet-body-cell="${selection.rowIndex}:${selection.columnIndex}"]`;
    const addressForSelection = (selection) =>
      selection.kind === "header"
        ? `${columnLetter(selection.columnIndex)}1`
        : `${columnLetter(selection.columnIndex)}${selection.rowIndex + 2}`;
    const getSelectionValue = (selection) =>
      selection.kind === "header"
        ? model.columns[selection.columnIndex] || ""
        : model.rows[selection.rowIndex]?.[selection.columnIndex] || "";
    const setSelectionValue = (selection, value) => {
      if (selection.kind === "header") {
        model.columns[selection.columnIndex] = value;
      } else if (model.rows[selection.rowIndex]) {
        model.rows[selection.rowIndex][selection.columnIndex] = value;
      }
    };
    const syncSelectionUi = () => {
      nameBox.value = addressForSelection(activeSelection);
      formulaValue.value = getSelectionValue(activeSelection);
      formulaValue.placeholder = activeSelection.kind === "header" ? "Column title" : "Cell value";
      table.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
      const target = table.querySelector(cellSelector(activeSelection));
      target?.classList.add("is-selected");
    };
    const focusSelection = (selection) => {
      activeSelection = selection;
      syncSelectionUi();
      table.querySelector(cellSelector(selection))?.focus();
    };
    const moveSelection = (selection, rowDelta = 0, columnDelta = 0) => {
      const nextColumnIndex = Math.max(0, Math.min(model.columns.length - 1, selection.columnIndex + columnDelta));
      if (selection.kind === "header") {
        if (rowDelta > 0) {
          focusSelection({ kind: "cell", rowIndex: 0, columnIndex: nextColumnIndex });
          return;
        }
        focusSelection({ kind: "header", columnIndex: nextColumnIndex, rowIndex: 0 });
        return;
      }
      const nextRowIndex = Math.max(0, Math.min(model.rows.length - 1, selection.rowIndex + rowDelta));
      focusSelection({ kind: "cell", rowIndex: nextRowIndex, columnIndex: nextColumnIndex });
    };
    const bindCellNavigation = (input, selection) => {
      input.addEventListener("focus", () => {
        activeSelection = selection;
        syncSelectionUi();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          moveSelection(selection, 1, 0);
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          moveSelection(selection, 0, event.shiftKey ? -1 : 1);
        }
      });
    };

    model.columns.forEach((_, columnIndex) => {
      const th = document.createElement("th");
      th.className = "workspace-sheet-column-letter";
      th.textContent = columnLetter(columnIndex);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const headerRow = document.createElement("tr");
    const headerRowLabel = document.createElement("th");
    headerRowLabel.className = "workspace-sheet-row-label";
    headerRowLabel.textContent = "1";
    headerRow.appendChild(headerRowLabel);
    model.columns.forEach((value, columnIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.className = "workspace-sheet-header-cell-input";
      input.dataset.sheetHeaderCell = String(columnIndex);
      bindCellNavigation(input, { kind: "header", columnIndex, rowIndex: 0 });
      input.addEventListener("input", (event) => {
        model.columns[columnIndex] = event.target.value;
        if (activeSelection.kind === "header" && activeSelection.columnIndex === columnIndex) {
          syncSelectionUi();
        }
        scheduleCommit();
      });
      input.addEventListener("blur", () => {
        model.columns[columnIndex] = input.value.trim() || `Column ${columnIndex + 1}`;
        input.value = model.columns[columnIndex];
        commitModel(false);
        syncSelectionUi();
      });
      td.appendChild(input);
      headerRow.appendChild(td);
    });
    tbody.appendChild(headerRow);

    model.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      const rowLabel = document.createElement("th");
      rowLabel.className = "workspace-sheet-row-label";
      rowLabel.textContent = String(rowIndex + 2);
      tr.appendChild(rowLabel);
      model.columns.forEach((_, columnIndex) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = row[columnIndex] || "";
        input.className = "workspace-sheet-cell-input";
        input.dataset.sheetBodyCell = `${rowIndex}:${columnIndex}`;
        bindCellNavigation(input, { kind: "cell", rowIndex, columnIndex });
        input.addEventListener("input", (event) => {
          model.rows[rowIndex][columnIndex] = event.target.value;
          if (
            activeSelection.kind === "cell" &&
            activeSelection.rowIndex === rowIndex &&
            activeSelection.columnIndex === columnIndex
          ) {
            syncSelectionUi();
          }
          scheduleCommit();
        });
        input.addEventListener("blur", () => {
          model.rows[rowIndex][columnIndex] = input.value;
          commitModel(false);
        });
        td.appendChild(input);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    gridShell.appendChild(table);
    previewShell.appendChild(gridShell);

    formulaValue.addEventListener("input", (event) => {
      setSelectionValue(activeSelection, event.target.value);
      const target = table.querySelector(cellSelector(activeSelection));
      if (target) {
        target.value = event.target.value;
      }
      scheduleCommit();
    });
    formulaValue.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitModel(false);
        focusSelection(activeSelection);
      }
    });
    formulaValue.addEventListener("blur", () => {
      commitModel(false);
    });

    const bottomBar = document.createElement("div");
    bottomBar.className = "workspace-sheet-bottom-bar";
    const sheetTabs = document.createElement("div");
    sheetTabs.className = "workspace-sheet-tabbar";
    const addSheetButton = document.createElement("button");
    addSheetButton.type = "button";
    addSheetButton.className = "workspace-sheet-add-button";
    addSheetButton.textContent = "+";
    addSheetButton.title = "Add sheet";
    const activeSheetTab = document.createElement("button");
    activeSheetTab.type = "button";
    activeSheetTab.className = "workspace-sheet-tab-pill active";
    activeSheetTab.textContent = profile.sheetName;
    sheetTabs.append(addSheetButton, activeSheetTab);
    const status = document.createElement("div");
    status.className = "workspace-sheet-status";
    status.textContent = `${profile.contextLabelA}: ${profile.contextValueA}`;
    bottomBar.append(sheetTabs, status);
    previewShell.appendChild(bottomBar);

    container.appendChild(previewShell);
    syncSelectionUi();
    return;
  }

  renderCodePreview(container, content, filePath);
}

function stripPresentationSlideTitle(value = "") {
  return String(value || "").replace(/^slide\s+\d+\s*-\s*/i, "").trim();
}

function extractPresentationCallouts(values = []) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => {
      const pair = value.match(/^([^:]{2,32}):\s+(.+)$/);
      if (pair) {
        return {
          label: pair[1].trim(),
          value: pair[2].trim()
        };
      }

      return {
        label: "Point",
        value
      };
    })
    .slice(0, 4);
}

function parsePresentationBlock(block = "") {
  const lines = normalizeText(block)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^##\s+/i.test(line));

  const bullets = [];
  const paragraphs = [];

  for (const line of lines) {
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim());
      continue;
    }

    paragraphs.push(line);
  }

  return {
    lead: paragraphs[0] || bullets[0] || "",
    bullets: bullets.slice(0, 6),
    supporting: paragraphs.slice(1, 3),
    callouts: extractPresentationCallouts([...bullets, ...paragraphs.slice(1, 5)])
  };
}

function inferPresentationSlideTheme(title = "", parsed = {}) {
  const normalized = normalizeText(title).toLowerCase();
  if (/\b(why|problem|matters|opportunity)\b/.test(normalized)) {
    return "problem";
  }
  if (/\b(walkthrough|product|demo|overview)\b/.test(normalized)) {
    return "product";
  }
  if (/\b(proof|signal|traction|metrics|kpi)\b/.test(normalized)) {
    return "proof";
  }
  if (/\b(next|roadmap|milestone|move)\b/.test(normalized)) {
    return "roadmap";
  }
  if ((parsed.callouts || []).length >= 3) {
    return "insight";
  }
  return "default";
}

function renderPresentationPreview(
  container,
  content = "",
  sections = [],
  currentSectionId = "",
  onSlideFocus = null,
  onSlideEdit = null
) {
  const usableSections = (sections || []).filter(
    (section) => section.id !== "whole-file" && section.level >= 2
  );

  const slides = usableSections.length
    ? usableSections
    : [{
        id: "slide-1",
        title: "Slide 1",
        block: content
      }];

  const activeSlide =
    slides.find((slide) => slide.id === currentSectionId) ||
    slides[0];
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlide.id));
  const parsed = parsePresentationBlock(activeSlide.block || "");
  const stageTheme = inferPresentationSlideTheme(activeSlide.title, parsed);

  const stats = document.createElement("div");
  stats.className = "workspace-preview-summary";
  stats.textContent = `${slides.length} slides · deck preview`;
  stats.textContent = `${slides.length} slides | deck preview`;
  container.appendChild(stats);

  const deckShell = document.createElement("section");
  deckShell.className = "workspace-deck-shell";

  const deckToolbar = document.createElement("div");
  deckToolbar.className = "workspace-deck-toolbar";

  const deckMeta = document.createElement("div");
  deckMeta.className = "workspace-deck-meta";
  const deckTitle = document.createElement("strong");
  deckTitle.textContent = stripPresentationSlideTitle(activeSlide.title || "Slide");
  const deckPosition = document.createElement("span");
  deckPosition.className = "tiny";
  deckPosition.textContent = `Slide ${activeIndex + 1} of ${slides.length}`;
  deckMeta.append(deckTitle, deckPosition);

  const themeTokens = document.createElement("div");
  themeTokens.className = "workspace-deck-theme";
  [
    { label: "Story", active: ["default", "product"].includes(stageTheme) },
    { label: "Proof", active: ["proof", "insight"].includes(stageTheme) },
    { label: "Decision", active: ["problem", "roadmap"].includes(stageTheme) }
  ].forEach((tokenConfig) => {
    const token = document.createElement("span");
    token.className = `workspace-deck-theme-chip${tokenConfig.active ? " active" : ""}`;
    token.textContent = tokenConfig.label;
    themeTokens.appendChild(token);
  });
  deckToolbar.append(deckMeta, themeTokens);
  deckShell.appendChild(deckToolbar);

  const deckInsightRow = document.createElement("div");
  deckInsightRow.className = "workspace-document-context-grid";
  [
    {
      label: "Narrative spine",
      value: slides.slice(0, 3).map((slide) => stripPresentationSlideTitle(slide.title || "Slide")).join(" -> ")
    },
    {
      label: "Presenter focus",
      value: parsed.lead || "Use the active slide to make one decision obvious."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    deckInsightRow.appendChild(card);
  });
  deckShell.appendChild(deckInsightRow);

  const deckWorkbench = document.createElement("div");
  deckWorkbench.className = "workspace-deck-preview-workbench";

  const stage = document.createElement("article");
  stage.className = `workspace-slide-stage workspace-slide-stage-${stageTheme}`;

  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-slide-stage-header";

  const stageLabelGroup = document.createElement("div");

  const stageMeta = document.createElement("span");
  stageMeta.className = "workspace-slide-kicker";
  stageMeta.textContent = `Current slide · ${slides.findIndex((slide) => slide.id === activeSlide.id) + 1}`;

  const stageTitle = document.createElement("h3");
  stageTitle.textContent = activeSlide.title || "Slide";
  stageMeta.textContent = `Slide ${activeIndex + 1} of ${slides.length}`;
  stageTitle.textContent = stripPresentationSlideTitle(activeSlide.title || "Slide");

  const commitSlideEdit = () => {
    const nextBodyParts = [];
    const nextLead = String(stageLead.textContent || "").trim();
    if (nextLead) {
      nextBodyParts.push(nextLead);
    }
    bodyColumn.querySelectorAll(".workspace-slide-paragraph").forEach((paragraph) => {
      const value = String(paragraph.textContent || "").trim();
      if (value) {
        nextBodyParts.push(value);
      }
    });
    const bulletValues = Array.from(bodyColumn.querySelectorAll(".workspace-slide-bullet-list li"))
      .map((item) => String(item.textContent || "").trim())
      .filter(Boolean)
      .map((item) => `- ${item}`);
    if (bulletValues.length) {
      nextBodyParts.push(bulletValues.join("\n"));
    }
    onSlideEdit?.(activeSlide.id, {
      title: stripPresentationSlideTitle(stageTitle.textContent || activeSlide.title || "Slide").trim() || "Slide",
      body: nextBodyParts.join("\n\n").trim()
    });
  };

  wireInlineEditable(stageTitle, {
    onCommit: commitSlideEdit
  });

  stageLabelGroup.append(stageMeta, stageTitle);

  const stageHint = document.createElement("span");
  stageHint.className = "workspace-slide-stage-hint";
  stageHint.textContent = "Presentation surface";
  stageHeader.append(stageLabelGroup, stageHint);

  const stageLead = document.createElement("p");
  stageLead.className = "workspace-slide-lead";
  stageLead.textContent =
    parsed.lead ||
    "Use this slide to make one point obvious immediately.";
  wireInlineEditable(stageLead, {
    multiline: true,
    onCommit: commitSlideEdit
  });

  const leadRail = document.createElement("div");
  leadRail.className = "workspace-slide-lead-rail";
  const leadLabel = document.createElement("span");
  leadLabel.className = "tiny";
  leadLabel.textContent = "Presenter angle";
  const leadValue = document.createElement("strong");
  leadValue.textContent =
    parsed.callouts[0]?.value ||
    parsed.supporting[0] ||
    "Sharpen the slide in edit mode to make the narrative stronger.";
  leadRail.append(leadLabel, leadValue);

  const stageGrid = document.createElement("div");
  stageGrid.className = "workspace-slide-grid";

  const bodyColumn = document.createElement("div");
  bodyColumn.className = "workspace-slide-column";
  parsed.supporting.forEach((paragraph) => {
    const block = document.createElement("p");
    block.className = "workspace-slide-paragraph";
    block.textContent = paragraph;
    wireInlineEditable(block, {
      multiline: true,
      onCommit: commitSlideEdit
    });
    bodyColumn.appendChild(block);
  });

  if (parsed.bullets.length) {
    const bulletList = document.createElement("ul");
    bulletList.className = "workspace-slide-bullet-list";
    parsed.bullets.forEach((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      wireInlineEditable(item, {
        onCommit: commitSlideEdit
      });
      bulletList.appendChild(item);
    });
    bodyColumn.appendChild(bulletList);
  }

  if (!bodyColumn.childNodes.length) {
    const fallback = document.createElement("p");
    fallback.className = "workspace-slide-paragraph";
    fallback.textContent = "Open this slide in the editor to sharpen the narrative and add stronger proof.";
    wireInlineEditable(fallback, {
      multiline: true,
      onCommit: commitSlideEdit
    });
    bodyColumn.appendChild(fallback);
  }

  const insightColumn = document.createElement("div");
  insightColumn.className = "workspace-slide-insight-column";
  const insightMeta = document.createElement("span");
  insightMeta.className = "tiny";
  insightMeta.textContent = ["proof", "insight"].includes(stageTheme) ? "Signals" : "Key points";
  insightColumn.appendChild(insightMeta);

  const insightGrid = document.createElement("div");
  insightGrid.className = "workspace-slide-insight-grid";
  (parsed.callouts.length
    ? parsed.callouts
    : [{ label: "Focus", value: parsed.lead || "Clarify the message on this slide." }]).forEach((callout) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-insight-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = callout.label;
    const value = document.createElement("strong");
    value.textContent = callout.value;
    card.append(label, value);
    insightGrid.appendChild(card);
  });
  insightColumn.appendChild(insightGrid);

  stageGrid.append(bodyColumn, insightColumn);
  stage.append(stageHeader, stageLead, leadRail, stageGrid);

  const strip = document.createElement("div");
  strip.className = "workspace-slide-strip";
  slides.forEach((slide, index) => {
    const card = document.createElement(onSlideFocus ? "button" : "article");
    card.className = `workspace-slide-card${slide.id === activeSlide.id ? " active" : ""}`;
    if (onSlideFocus) {
      card.type = "button";
      card.addEventListener("click", () => onSlideFocus(slide.id));
    }

    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Slide ${index + 1}`;

    const title = document.createElement("h4");
    title.textContent = stripPresentationSlideTitle(slide.title || `Slide ${index + 1}`);

    const preview = document.createElement("p");
    preview.textContent =
      parsePresentationBlock(slide.block || "").lead ||
      "Use this slide to make one point clear and memorable.";

    card.append(meta, title, preview);
    strip.appendChild(card);
  });

  const notesPanel = document.createElement("div");
  notesPanel.className = "workspace-presentation-speaker-notes";
  const notesHeader = document.createElement("div");
  notesHeader.className = "workspace-code-toolbar-meta";
  const notesTitle = document.createElement("strong");
  notesTitle.textContent = "Speaker notes";
  const notesHint = document.createElement("span");
  notesHint.className = "tiny";
  notesHint.textContent = "How to present the active slide";
  notesHeader.append(notesTitle, notesHint);
  notesPanel.appendChild(notesHeader);
  const notesGrid = document.createElement("div");
  notesGrid.className = "workspace-document-context-grid";
  [
    {
      label: "Lead line",
      value: parsed.lead || "Open with the strongest message on the current slide."
    },
    {
      label: "Audience move",
      value: activeIndex === slides.length - 1 ? "Make the next action explicit." : activeIndex === 0 ? "Hook attention fast." : "Support the narrative with proof."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    notesGrid.appendChild(card);
  });
  notesPanel.appendChild(notesGrid);

  deckWorkbench.append(strip, stage, notesPanel);
  deckShell.appendChild(deckWorkbench);
  container.appendChild(deckShell);
}

function parsePreviewNumber(value = "") {
  const normalized = String(value || "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyDeltaTone(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "neutral";
  }
  if (/^\+/.test(normalized) || /\b(up|growth|gain|lift)\b/i.test(normalized)) {
    return "positive";
  }
  if (/^-/.test(normalized) || /\b(down|drop|loss|risk)\b/i.test(normalized)) {
    return "negative";
  }
  return "neutral";
}

function renderDashboardPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.summary || "Live dashboard view";
  container.appendChild(summary);

  const dashboardToolbar = document.createElement("div");
  dashboardToolbar.className = "workspace-dashboard-preview-toolbar";
  const dashboardMeta = document.createElement("div");
  dashboardMeta.className = "workspace-code-toolbar-meta";
  const dashboardTitle = document.createElement("strong");
  dashboardTitle.textContent = model.title || "Dashboard";
  const dashboardHint = document.createElement("span");
  dashboardHint.className = "tiny";
  dashboardHint.textContent = `${(model.filters || []).length} filters | ${(model.widgets || []).length} widgets`;
  dashboardMeta.append(dashboardTitle, dashboardHint);
  const dashboardTabs = document.createElement("div");
  dashboardTabs.className = "workspace-code-tabs";
  ["Overview", "Charts", "Table"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    dashboardTabs.appendChild(tab);
  });
  dashboardToolbar.append(dashboardMeta, dashboardTabs);
  container.appendChild(dashboardToolbar);

  const metricGrid = document.createElement("div");
  metricGrid.className = "workspace-overview-grid";
  (model.metrics || []).forEach((metric) => {
    const card = document.createElement("article");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = metric.label || "Metric";
    const value = document.createElement("strong");
    value.textContent = metric.value || "-";
    const delta = document.createElement("span");
    delta.className = "tiny";
    delta.textContent = metric.delta || "";
    card.append(label, value, delta);
    metricGrid.appendChild(card);
  });
  if (metricGrid.children.length) {
    container.appendChild(metricGrid);
  }

  const chartStrip = document.createElement("div");
  chartStrip.className = "workspace-slide-strip";
  (model.charts || []).forEach((chart, index) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `${chart.kind || "chart"} ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = chart.title || `Chart ${index + 1}`;
    const preview = document.createElement("p");
    preview.textContent = (chart.points || [])
      .slice(0, 4)
      .map((point) => `${point.label}: ${point.value}`)
      .join(" · ");
    card.append(meta, title, preview);
    chartStrip.appendChild(card);
  });
  if (chartStrip.children.length) {
    container.appendChild(chartStrip);
  }

  if (model.table?.columns?.length) {
    renderDataPreview(
      container,
      "table.csv",
      [
        model.table.columns.join(","),
        ...(model.table.rows || []).map((row) => row.map((cell) => String(cell || "")).join(","))
      ].join("\n")
    );
  }
}

function renderWorkflowPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = `${model.objective || "Workflow"} · Trigger: ${model.trigger || "manual"}`;
  container.appendChild(summary);

  const workflowToolbar = document.createElement("div");
  workflowToolbar.className = "workspace-dashboard-preview-toolbar";
  const workflowMeta = document.createElement("div");
  workflowMeta.className = "workspace-code-toolbar-meta";
  const workflowTitle = document.createElement("strong");
  workflowTitle.textContent = model.title || "Workflow";
  const workflowHint = document.createElement("span");
  workflowHint.className = "tiny";
  workflowHint.textContent = `${(model.stages || []).length} steps | ${(model.links || []).length} links`;
  workflowMeta.append(workflowTitle, workflowHint);
  const workflowTabs = document.createElement("div");
  workflowTabs.className = "workspace-code-tabs";
  ["Canvas", "Nodes", "Outputs"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    workflowTabs.appendChild(tab);
  });
  workflowToolbar.append(workflowMeta, workflowTabs);
  container.appendChild(workflowToolbar);

  const strip = document.createElement("div");
  strip.className = "workspace-slide-strip";
  (model.stages || []).forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Step ${index + 1} · ${stage.owner || "Hydria"}`;
    const title = document.createElement("h4");
    title.textContent = stage.label || `Step ${index + 1}`;
    const preview = document.createElement("p");
    preview.textContent = stage.note || "";
    card.append(meta, title, preview);
    strip.appendChild(card);
  });
  container.appendChild(strip);

  if ((model.automations || []).length) {
    const list = document.createElement("ul");
    (model.automations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
}

function renderDesignPreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.brief || "Design surface";
  container.appendChild(summary);

  const totalBlocks = (model.frames || []).reduce((count, frame) => count + ((frame.blocks || []).length || 0), 0);
  const designInsights = createPreviewInsightGrid([
    { label: "Frames", value: (model.frames || []).length || 0, meta: model.frames?.[0]?.name || "No frame yet" },
    { label: "Blocks", value: totalBlocks, meta: totalBlocks ? "Layout spread across frames" : "No blocks yet" },
    { label: "Palette", value: (model.palette || []).length || 0, meta: model.palette?.[0]?.name || "No color token yet" },
    { label: "Components", value: (model.components || []).length || 0, meta: model.components?.[0] || "No component vocabulary yet" }
  ]);
  if (designInsights) {
    container.appendChild(designInsights);
  }

  const palette = document.createElement("div");
  palette.className = "workspace-slide-strip";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-slide-card";
    const swatch = document.createElement("div");
    swatch.style.width = "100%";
    swatch.style.height = "64px";
    swatch.style.borderRadius = "14px";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    palette.appendChild(card);
  });
  if (palette.children.length) {
    container.appendChild(palette);
  }

  const frames = document.createElement("div");
  frames.className = "workspace-overview-grid";
  (model.frames || []).forEach((frameModel) => {
    const card = document.createElement("article");
    card.className = "workspace-overview-card";
    const name = document.createElement("strong");
    name.textContent = frameModel.name || "Frame";
    const goal = document.createElement("span");
    goal.className = "tiny";
    goal.textContent = frameModel.goal || "";
    card.append(name, goal);
    frames.appendChild(card);
  });
  if (frames.children.length) {
    container.appendChild(frames);
  }
}

function clampPreviewPosition(value = 0, min = 0, max = 0) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function attachPreviewDrag(element, {
  initialX = 0,
  initialY = 0,
  getBounds = () => ({ width: 0, height: 0 }),
  getScale = () => 1,
  preferMouse = false,
  minX = 8,
  minY = 8,
  maxX = Number.POSITIVE_INFINITY,
  maxY = Number.POSITIVE_INFINITY,
  onStart = null,
  onEnd = null,
  onUpdate = null,
  onCommit = null
} = {}) {
  let dragState = null;
  let mouseMoveHandler = null;
  let mouseUpHandler = null;
  let dragAnimationFrame = null;
  let pendingDragPoint = null;

  const readCurrentDragPosition = () => {
    const currentX = Number.parseFloat(element.style.left || "");
    const currentY = Number.parseFloat(element.style.top || "");
    return {
      x: Number.isFinite(currentX) ? currentX : Number(initialX) || 0,
      y: Number.isFinite(currentY) ? currentY : Number(initialY) || 0
    };
  };

  const updateDrag = (clientX = 0, clientY = 0) => {
    if (!dragState) {
      return;
    }
    const bounds = dragState.bounds || getBounds() || { width: 0, height: 0 };
    const scale = dragState.scale || Math.max(0.0001, Number(getScale?.() || 1) || 1);
    const deltaX = (clientX - dragState.startClientX) / scale;
    const deltaY = (clientY - dragState.startClientY) / scale;
    dragState.nextX = clampPreviewPosition(dragState.startX + deltaX, minX, Math.max(minX, Math.min(maxX, (bounds.width || 0) - 24)));
    dragState.nextY = clampPreviewPosition(dragState.startY + deltaY, minY, Math.max(minY, Math.min(maxY, (bounds.height || 0) - 24)));
    element.style.transform = `translate(${dragState.nextX - dragState.startX}px, ${dragState.nextY - dragState.startY}px)`;
    onUpdate?.(dragState.nextX, dragState.nextY, element);
  };

  const flushQueuedDrag = () => {
    if (!pendingDragPoint) {
      return;
    }
    const point = pendingDragPoint;
    pendingDragPoint = null;
    updateDrag(point.clientX, point.clientY);
  };

  const queueDragUpdate = (clientX = 0, clientY = 0) => {
    pendingDragPoint = { clientX, clientY };
    if (dragAnimationFrame) {
      return;
    }
    dragAnimationFrame = window.requestAnimationFrame(() => {
      dragAnimationFrame = null;
      flushQueuedDrag();
    });
  };

  const finishDrag = (pointerId = null) => {
    if (!dragState) {
      return;
    }
    if (dragState.mode === "pointer" && pointerId !== null && pointerId !== dragState.pointerId) {
      return;
    }
    if (dragAnimationFrame) {
      window.cancelAnimationFrame(dragAnimationFrame);
      dragAnimationFrame = null;
    }
    flushQueuedDrag();
    const nextX = dragState.nextX;
    const nextY = dragState.nextY;
    element.classList.remove("is-dragging");
    element.style.left = `${nextX}px`;
    element.style.top = `${nextY}px`;
    element.style.transform = "";
    if (dragState.mode === "pointer" && pointerId !== null) {
      element.releasePointerCapture?.(pointerId);
    }
    if (mouseMoveHandler) {
      document.removeEventListener("mousemove", mouseMoveHandler, true);
      mouseMoveHandler = null;
    }
    if (mouseUpHandler) {
      document.removeEventListener("mouseup", mouseUpHandler, true);
      mouseUpHandler = null;
    }
    dragState = null;
    pendingDragPoint = null;
    onEnd?.(element);
    onCommit?.(nextX, nextY);
  };

  element.addEventListener("pointerdown", (event) => {
    if (preferMouse && event.pointerType !== "touch") {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (
      (target?.closest?.("button") && target !== element) ||
      target?.closest?.(".workspace-preview-ignore-drag, .workspace-preview-resize-handle, .workspace-workflow-port")
    ) {
      return;
    }

    const currentPosition = readCurrentDragPosition();
    const currentBounds = getBounds() || { width: 0, height: 0 };
    const currentScale = Math.max(0.0001, Number(getScale?.() || 1) || 1);
    dragState = {
      pointerId: event.pointerId,
      mode: "pointer",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentPosition.x,
      startY: currentPosition.y,
      nextX: currentPosition.x,
      nextY: currentPosition.y,
      bounds: currentBounds,
      scale: currentScale
    };

    element.setPointerCapture?.(event.pointerId);
    element.classList.add("is-dragging");
    onStart?.(element);
    event.stopPropagation();
    event.preventDefault();
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    queueDragUpdate(event.clientX, event.clientY);
  });

  const finish = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    finishDrag(event.pointerId);
  };

  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);

  element.addEventListener("mousedown", (event) => {
    if (dragState || event.button !== 0) {
      return;
    }

    const target = event.target;
    if (
      (target?.closest?.("button") && target !== element) ||
      target?.closest?.(".workspace-preview-ignore-drag, .workspace-preview-resize-handle, .workspace-workflow-port")
    ) {
      return;
    }

    const currentPosition = readCurrentDragPosition();
    const currentBounds = getBounds() || { width: 0, height: 0 };
    const currentScale = Math.max(0.0001, Number(getScale?.() || 1) || 1);
    dragState = {
      pointerId: null,
      mode: "mouse",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentPosition.x,
      startY: currentPosition.y,
      nextX: currentPosition.x,
      nextY: currentPosition.y,
      bounds: currentBounds,
      scale: currentScale
    };

    element.classList.add("is-dragging");
    onStart?.(element);
    mouseMoveHandler = (moveEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      queueDragUpdate(moveEvent.clientX, moveEvent.clientY);
    };
    mouseUpHandler = (upEvent) => {
      upEvent?.stopPropagation?.();
      upEvent?.preventDefault?.();
      finishDrag();
    };
    document.addEventListener("mousemove", mouseMoveHandler, true);
    document.addEventListener("mouseup", mouseUpHandler, true);
    event.stopPropagation();
    event.preventDefault();
  });
}

function attachPreviewResize(handle, {
  target = null,
  initialWidth = 160,
  initialHeight = 36,
  getBounds = () => ({ width: 0, height: 0 }),
  getScale = () => 1,
  preferMouse = false,
  minWidth = 80,
  minHeight = 24,
  onStart = null,
  onEnd = null,
  onUpdate = null,
  onCommit = null
} = {}) {
  let resizeState = null;
  let mouseMoveHandler = null;
  let mouseUpHandler = null;
  let resizeAnimationFrame = null;
  let pendingResizePoint = null;

  const readCurrentResizeSize = () => {
    const currentWidth = Number.parseFloat(target?.style?.width || "");
    const currentHeight = Number.parseFloat(target?.style?.height || "");
    return {
      width: Number.isFinite(currentWidth) ? currentWidth : Number(initialWidth) || 160,
      height: Number.isFinite(currentHeight) ? currentHeight : Number(initialHeight) || 36
    };
  };

  const updateResize = (clientX = 0, clientY = 0) => {
    if (!resizeState) {
      return;
    }
    const bounds = resizeState.bounds || getBounds() || { width: 0, height: 0 };
    const scale = resizeState.scale || Math.max(0.0001, Number(getScale?.() || 1) || 1);
    const deltaX = (clientX - resizeState.startClientX) / scale;
    const deltaY = (clientY - resizeState.startClientY) / scale;
    resizeState.nextWidth = clampPreviewPosition(
      resizeState.startWidth + deltaX,
      minWidth,
      Math.max(minWidth, (bounds.width || resizeState.startWidth) - 12)
    );
    resizeState.nextHeight = clampPreviewPosition(
      resizeState.startHeight + deltaY,
      minHeight,
      Math.max(minHeight, (bounds.height || resizeState.startHeight) - 12)
    );

    if (target) {
      target.style.width = `${resizeState.nextWidth}px`;
      target.style.height = `${resizeState.nextHeight}px`;
    }
    onUpdate?.(resizeState.nextWidth, resizeState.nextHeight, target);
  };

  const flushQueuedResize = () => {
    if (!pendingResizePoint) {
      return;
    }
    const point = pendingResizePoint;
    pendingResizePoint = null;
    updateResize(point.clientX, point.clientY);
  };

  const queueResizeUpdate = (clientX = 0, clientY = 0) => {
    pendingResizePoint = { clientX, clientY };
    if (resizeAnimationFrame) {
      return;
    }
    resizeAnimationFrame = window.requestAnimationFrame(() => {
      resizeAnimationFrame = null;
      flushQueuedResize();
    });
  };

  const finishResize = (pointerId = null) => {
    if (!resizeState) {
      return;
    }
    if (resizeState.mode === "pointer" && pointerId !== null && pointerId !== resizeState.pointerId) {
      return;
    }
    if (resizeAnimationFrame) {
      window.cancelAnimationFrame(resizeAnimationFrame);
      resizeAnimationFrame = null;
    }
    flushQueuedResize();
    const nextWidth = resizeState.nextWidth;
    const nextHeight = resizeState.nextHeight;
    target?.classList?.remove("is-dragging");
    if (resizeState.mode === "pointer" && pointerId !== null) {
      handle.releasePointerCapture?.(pointerId);
    }
    if (mouseMoveHandler) {
      document.removeEventListener("mousemove", mouseMoveHandler, true);
      mouseMoveHandler = null;
    }
    if (mouseUpHandler) {
      document.removeEventListener("mouseup", mouseUpHandler, true);
      mouseUpHandler = null;
    }
    resizeState = null;
    pendingResizePoint = null;
    onEnd?.(target);
    onCommit?.(nextWidth, nextHeight);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (preferMouse && event.pointerType !== "touch") {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    const currentSize = readCurrentResizeSize();
    const currentBounds = getBounds() || { width: 0, height: 0 };
    const currentScale = Math.max(0.0001, Number(getScale?.() || 1) || 1);
    resizeState = {
      pointerId: event.pointerId,
      mode: "pointer",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: currentSize.width,
      startHeight: currentSize.height,
      nextWidth: currentSize.width,
      nextHeight: currentSize.height,
      bounds: currentBounds,
      scale: currentScale
    };

    handle.setPointerCapture?.(event.pointerId);
    target?.classList?.add("is-dragging");
    onStart?.(target);
    event.stopPropagation();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    queueResizeUpdate(event.clientX, event.clientY);
  });

  const finish = (event) => {
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    finishResize(event.pointerId);
  };

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);

  handle.addEventListener("mousedown", (event) => {
    if (resizeState || event.button !== 0) {
      return;
    }

    const currentSize = readCurrentResizeSize();
    const currentBounds = getBounds() || { width: 0, height: 0 };
    const currentScale = Math.max(0.0001, Number(getScale?.() || 1) || 1);
    resizeState = {
      pointerId: null,
      mode: "mouse",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: currentSize.width,
      startHeight: currentSize.height,
      nextWidth: currentSize.width,
      nextHeight: currentSize.height,
      bounds: currentBounds,
      scale: currentScale
    };

    target?.classList?.add("is-dragging");
    onStart?.(target);
    mouseMoveHandler = (moveEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      queueResizeUpdate(moveEvent.clientX, moveEvent.clientY);
    };
    mouseUpHandler = (upEvent) => {
      upEvent?.stopPropagation?.();
      upEvent?.preventDefault?.();
      finishResize();
    };
    document.addEventListener("mousemove", mouseMoveHandler, true);
    document.addEventListener("mouseup", mouseUpHandler, true);
    event.stopPropagation();
    event.preventDefault();
  });
}

function renderDashboardExperiencePreview(
  container,
  content = "",
  {
    activeFilter = "",
    activeWidgetId = "",
    activeChartId = "",
    onFilterToggle = null,
    onWidgetMove = null,
    onWidgetDrop = null,
    onWidgetResize = null,
    onWidgetFocus = null,
    onChartFocus = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDashboardPreview(container, content);
    return;
  }

  const normalizedFilter = String(activeFilter || "").trim().toLowerCase();
  const matchesFilter = (value = "") =>
    !normalizedFilter || String(value || "").toLowerCase().includes(normalizedFilter);
  const visibleWidgets = normalizedFilter
    ? (model.widgets || []).filter(
        (widget) =>
          matchesFilter(widget.title) || matchesFilter(widget.summary) || matchesFilter(widget.type)
      )
    : model.widgets || [];
  const visibleMetrics = normalizedFilter
    ? (model.metrics || []).filter((metric) => matchesFilter(metric.label))
    : model.metrics || [];
  const visibleCharts = normalizedFilter
    ? (model.charts || []).filter((chart) => matchesFilter(chart.title))
    : model.charts || [];

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = normalizedFilter
    ? `${model.summary || "Live dashboard view"} - Focus: ${activeFilter}`
    : model.summary || "Live dashboard view";
  container.appendChild(summary);

  const dashboardInsights = createPreviewInsightGrid([
    { label: "Metrics", value: visibleMetrics.length || 0, meta: visibleMetrics[0]?.label || "No visible metric" },
    { label: "Widgets", value: visibleWidgets.length || 0, meta: visibleWidgets[0]?.title || "No visible widget" },
    { label: "Charts", value: visibleCharts.length || 0, meta: visibleCharts[0]?.title || "No visible chart" },
    { label: "Focus", value: activeFilter || "All", meta: normalizedFilter ? "Preview filter is active" : "Showing the full dashboard" }
  ]);
  if (dashboardInsights) {
    container.appendChild(dashboardInsights);
  }

  if ((model.filters || []).length) {
    const filters = document.createElement("div");
    filters.className = "workspace-flow-chip-list";
    (model.filters || []).forEach((filter) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `workspace-flow-chip workspace-flow-chip-button${
        String(filter || "") === String(activeFilter || "") ? " is-active" : ""
      }`;
      chip.textContent = filter;
      chip.addEventListener("click", () => {
        onFilterToggle?.(filter);
      });
      filters.appendChild(chip);
    });
    container.appendChild(filters);
  }

  if (visibleWidgets.length) {
    const widgetGrid = document.createElement("div");
    widgetGrid.className = "workspace-dashboard-widget-grid";
    visibleWidgets.forEach((widget) => {
      const widgetSize = ["small", "medium", "large"].includes(String(widget.size || ""))
        ? String(widget.size)
        : "medium";
      const card = document.createElement("article");
      card.className = `workspace-dashboard-widget${
        widget.id === activeWidgetId ? " is-active" : ""
      } workspace-dashboard-widget--${widgetSize}`;
      card.tabIndex = 0;
      card.draggable = true;
      card.addEventListener("click", () => onWidgetFocus?.(widget.id));
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", widget.id);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        card.classList.remove("is-drop-target");
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("is-drop-target");
      });
      card.addEventListener("dragleave", () => {
        card.classList.remove("is-drop-target");
      });
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("is-drop-target");
        const sourceId = event.dataTransfer?.getData("text/plain") || "";
        onWidgetDrop?.(sourceId, widget.id);
      });
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = `${widget.type || "widget"} · ${widgetSize}`;
      const title = document.createElement("strong");
      title.textContent = widget.title || "Widget";
      const summary = document.createElement("p");
      summary.textContent = widget.summary || "";
      const actions = document.createElement("div");
      actions.className = "workspace-surface-card-actions";
      const focusButton = document.createElement("button");
      focusButton.type = "button";
      focusButton.className = "workspace-mini-action";
      focusButton.textContent = "Edit";
      focusButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetFocus?.(widget.id);
      });
      actions.appendChild(focusButton);
      const shrinkButton = document.createElement("button");
      shrinkButton.type = "button";
      shrinkButton.className = "workspace-mini-action";
      shrinkButton.textContent = "-";
      shrinkButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetResize?.(widget.id, -1);
      });
      actions.appendChild(shrinkButton);
      const growButton = document.createElement("button");
      growButton.type = "button";
      growButton.className = "workspace-mini-action";
      growButton.textContent = "+";
      growButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onWidgetResize?.(widget.id, 1);
      });
      actions.appendChild(growButton);
      const sourceIndex = (model.widgets || []).findIndex((item) => item.id === widget.id);
      if (sourceIndex > 0) {
        const leftButton = document.createElement("button");
        leftButton.type = "button";
        leftButton.className = "workspace-mini-action";
        leftButton.textContent = "←";
        leftButton.addEventListener("click", (event) => {
          event.stopPropagation();
          onWidgetMove?.(widget.id, -1);
        });
        leftButton.textContent = "<";
        actions.appendChild(leftButton);
      }
      if (sourceIndex < (model.widgets || []).length - 1) {
        const rightButton = document.createElement("button");
        rightButton.type = "button";
        rightButton.className = "workspace-mini-action";
        rightButton.textContent = "→";
        rightButton.addEventListener("click", (event) => {
          event.stopPropagation();
          onWidgetMove?.(widget.id, 1);
        });
        rightButton.textContent = ">";
        actions.appendChild(rightButton);
      }
      card.append(meta, title, summary, actions);
      widgetGrid.appendChild(card);
    });
    container.appendChild(widgetGrid);
  }

  const shell = document.createElement("div");
  shell.className = "workspace-dashboard-shell";

  const metricGrid = document.createElement("div");
  metricGrid.className = "workspace-dashboard-metrics";
  visibleMetrics.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-kpi";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = metric.label || "Metric";
    const value = document.createElement("strong");
    value.textContent = metric.value || "-";
    const delta = document.createElement("span");
    delta.className = `workspace-dashboard-delta ${classifyDeltaTone(metric.delta)}`;
    delta.textContent = metric.delta || "Stable";
    card.append(label, value, delta);
    metricGrid.appendChild(card);
  });
  if (metricGrid.children.length) {
    shell.appendChild(metricGrid);
  }

  const activeChart =
    (model.charts || []).find((_, index) => `chart-${index + 1}` === String(activeChartId || "")) ||
    visibleCharts[0] ||
    null;
  if (activeChart) {
    const spotlight = document.createElement("article");
    spotlight.className = "workspace-dashboard-chart-card workspace-dashboard-chart-card--spotlight";
    const spotlightMeta = document.createElement("span");
    spotlightMeta.className = "tiny";
    spotlightMeta.textContent = `${activeChart.kind || "chart"} spotlight`;
    const spotlightTitle = document.createElement("h4");
    spotlightTitle.textContent = activeChart.title || "Active chart";
    const spotlightText = document.createElement("p");
    spotlightText.className = "muted";
    spotlightText.textContent = activeFilter
      ? `This view is focused on ${activeFilter}. Keep the selected chart aligned with that slice.`
      : "Use the active chart as the main story users should understand first.";
    spotlight.append(spotlightMeta, spotlightTitle, spotlightText);
    if ((activeChart.points || []).length) {
      const spotlightBars = document.createElement("div");
      spotlightBars.className = "workspace-dashboard-bars";
      const numericValues = (activeChart.points || [])
        .map((point) => parsePreviewNumber(point.value))
        .filter((value) => value !== null);
      const maxValue = numericValues.length ? Math.max(...numericValues, 1) : 1;
      (activeChart.points || []).slice(0, 8).forEach((point) => {
        const barGroup = document.createElement("div");
        barGroup.className = "workspace-dashboard-bar-group";
        const bar = document.createElement("div");
        bar.className = "workspace-dashboard-bar";
        const fill = document.createElement("div");
        fill.className = "workspace-dashboard-bar-fill";
        const numericValue = parsePreviewNumber(point.value);
        const ratio = numericValue !== null ? Math.max(10, Math.round((numericValue / maxValue) * 100)) : 36;
        fill.style.height = `${ratio}%`;
        bar.appendChild(fill);
        const pointLabel = document.createElement("span");
        pointLabel.className = "tiny";
        pointLabel.textContent = point.label || "Point";
        const pointValue = document.createElement("strong");
        pointValue.textContent = point.value || "-";
        barGroup.append(bar, pointLabel, pointValue);
        spotlightBars.appendChild(barGroup);
      });
      spotlight.appendChild(spotlightBars);
    }
    shell.appendChild(spotlight);
  }

  const chartGrid = document.createElement("div");
  chartGrid.className = "workspace-dashboard-chart-grid";
  visibleCharts.forEach((chart, index) => {
      const card = document.createElement("article");
    const chartKey = `chart-${(model.charts || []).findIndex((item) => item === chart) + 1}`;
    card.className = `workspace-dashboard-chart-card${chartKey === activeChartId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onChartFocus?.(chartKey));
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `${chart.kind || "chart"} ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = chart.title || `Chart ${index + 1}`;
    const actions = document.createElement("div");
    actions.className = "workspace-surface-card-actions";
    const focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "workspace-mini-action";
    focusButton.textContent = "Edit";
    focusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onChartFocus?.(chartKey);
    });
    actions.appendChild(focusButton);
    card.append(meta, title, actions);

    if ((chart.points || []).length) {
      const bars = document.createElement("div");
      bars.className = "workspace-dashboard-bars";
      const numericValues = (chart.points || [])
        .map((point) => parsePreviewNumber(point.value))
        .filter((value) => value !== null);
      const maxValue = numericValues.length ? Math.max(...numericValues, 1) : 1;

      (chart.points || []).slice(0, 6).forEach((point) => {
        const barGroup = document.createElement("div");
        barGroup.className = "workspace-dashboard-bar-group";
        const bar = document.createElement("div");
        bar.className = "workspace-dashboard-bar";
        const fill = document.createElement("div");
        fill.className = "workspace-dashboard-bar-fill";
        const numericValue = parsePreviewNumber(point.value);
        const ratio = numericValue !== null ? Math.max(8, Math.round((numericValue / maxValue) * 100)) : 36;
        fill.style.height = `${ratio}%`;
        bar.appendChild(fill);
        const pointLabel = document.createElement("span");
        pointLabel.className = "tiny";
        pointLabel.textContent = point.label || "Point";
        const pointValue = document.createElement("strong");
        pointValue.textContent = point.value || "-";
        barGroup.append(bar, pointLabel, pointValue);
        bars.appendChild(barGroup);
      });

      card.appendChild(bars);
    } else {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No chart points yet.";
      card.appendChild(empty);
    }

    chartGrid.appendChild(card);
  });
  if (chartGrid.children.length) {
    shell.appendChild(chartGrid);
  }

  if (shell.children.length) {
    container.appendChild(shell);
  }

  if (model.table?.columns?.length) {
    renderDataPreview(
      container,
      "table.csv",
      [
        model.table.columns.join(","),
        ...(model.table.rows || []).map((row) => row.map((cell) => String(cell || "")).join(","))
      ].join("\n")
    );
  }
}

function renderWorkflowExperiencePreview(
  container,
  content = "",
  {
    activeStageId = "",
    activeLinkId = "",
    onStageFocus = null,
    onStageMove = null,
    onWorkflowLinkCreate = null,
    onLinkFocus = null,
    onWorkflowLinkRemove = null,
    onStagePositionChange = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderWorkflowPreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = `${model.objective || "Workflow"} - Trigger: ${model.trigger || "manual"}`;
  container.appendChild(summary);

  const stageNodes = Array.isArray(model.stages) ? model.stages : [];
  const stageLinks = Array.isArray(model.links) ? model.links : [];
  let pendingLinkSourceId = "";
  const stageCardMap = new Map();

  const linkHelper = document.createElement("div");
  linkHelper.className = "workspace-flow-chip-list workspace-workflow-link-builder";
  const linkHelperText = document.createElement("span");
  linkHelperText.className = "workspace-flow-chip";
  const linkHelperClear = document.createElement("button");
  linkHelperClear.type = "button";
  linkHelperClear.className = "workspace-flow-chip workspace-flow-chip-button";
  linkHelperClear.textContent = "Clear";
  linkHelperClear.addEventListener("click", () => {
    pendingLinkSourceId = "";
    refreshPendingLinkState();
  });
  linkHelper.append(linkHelperText, linkHelperClear);
  container.appendChild(linkHelper);

  function refreshPendingLinkState() {
    if (pendingLinkSourceId) {
      const sourceStage = stageNodes.find((stage) => stage.id === pendingLinkSourceId);
      linkHelperText.textContent = `Connecting from ${sourceStage?.label || "selected step"} ? click Link to on another step`;
      linkHelperClear.hidden = false;
    } else {
      linkHelperText.textContent = "Click Link from, then Link to, to connect steps directly on the canvas.";
      linkHelperClear.hidden = true;
    }

    stageCardMap.forEach((card, stageId) => {
      card.classList.toggle("is-linking-source", stageId === pendingLinkSourceId);
      const input = card.querySelector("[data-link-role='input']");
      const output = card.querySelector("[data-link-role='output']");
      if (input) {
        input.disabled = !pendingLinkSourceId || pendingLinkSourceId === stageId;
      }
      if (output) {
        output.textContent = pendingLinkSourceId === stageId ? "Linking..." : "Link from";
      }
    });
  }

  const workflowShell = document.createElement("div");
  workflowShell.className = "workspace-workflow-shell";
  const workflowCanvas = document.createElement("div");
  workflowCanvas.className = "workspace-workflow-canvas";
  workflowCanvas.addEventListener("click", (event) => {
    if (event.target === workflowCanvas) {
      pendingLinkSourceId = "";
      refreshPendingLinkState();
    }
  });

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.setAttribute("class", "workspace-workflow-lines");
  lineSvg.setAttribute("viewBox", "0 0 920 420");
  lineSvg.setAttribute("preserveAspectRatio", "none");
  workflowCanvas.appendChild(lineSvg);

  stageLinks.forEach((link) => {
    const fromStage = stageNodes.find((stage) => stage.id === link.from);
    const toStage = stageNodes.find((stage) => stage.id === link.to);
    if (!fromStage || !toStage) {
      return;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String((Number(fromStage.x) || 0) + 98));
    line.setAttribute("y1", String((Number(fromStage.y) || 0) + 56));
    line.setAttribute("x2", String((Number(toStage.x) || 0) + 98));
    line.setAttribute("y2", String((Number(toStage.y) || 0) + 56));
    line.setAttribute("class", `workspace-workflow-line${link.id === activeLinkId ? " is-active" : ""}`);
    lineSvg.appendChild(line);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-workflow-link-chip${link.id === activeLinkId ? " is-active" : ""}`;
    chip.style.left = `${(((Number(fromStage.x) || 0) + (Number(toStage.x) || 0)) / 2) + 60}px`;
    chip.style.top = `${(((Number(fromStage.y) || 0) + (Number(toStage.y) || 0)) / 2) + 38}px`;
    chip.addEventListener("click", () => onLinkFocus?.(link.id || ""));
    const label = document.createElement("span");
    label.textContent = link.label || "Next";
    chip.appendChild(label);
    const remove = document.createElement("span");
    remove.className = "workspace-link-remove";
    remove.textContent = "?";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      onWorkflowLinkRemove?.(link.id || "");
    });
    chip.appendChild(remove);
    workflowCanvas.appendChild(chip);
  });

  stageNodes.forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = `workspace-workflow-stage workspace-workflow-node${stage.id === activeStageId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.style.left = `${Number(stage.x) || 0}px`;
    card.style.top = `${Number(stage.y) || 0}px`;
    card.addEventListener("click", () => {
      if (pendingLinkSourceId && pendingLinkSourceId !== stage.id) {
        onWorkflowLinkCreate?.(pendingLinkSourceId, stage.id);
        pendingLinkSourceId = "";
        refreshPendingLinkState();
      }
      onStageFocus?.(stage.id);
    });
    attachPreviewDrag(card, {
      initialX: Number(stage.x) || 0,
      initialY: Number(stage.y) || 0,
      getBounds: () => ({ width: workflowCanvas.clientWidth || 920, height: workflowCanvas.clientHeight || 420 }),
      maxX: 920 - 212,
      maxY: 420 - 128,
      onCommit: (x, y) => onStagePositionChange?.(stage.id, x, y)
    });

    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Step ${index + 1}`;
    const title = document.createElement("h4");
    title.textContent = stage.label || `Step ${index + 1}`;
    const owner = document.createElement("span");
    owner.className = "workspace-flow-chip";
    owner.textContent = stage.owner || "Hydria";
    const note = document.createElement("p");
    note.textContent = stage.note || "No note yet.";
    const ownerRow = document.createElement("div");
    ownerRow.className = "workspace-flow-chip-list";
    ownerRow.appendChild(owner);
    const ports = document.createElement("div");
    ports.className = "workspace-workflow-port-row";
    const outputPort = document.createElement("button");
    outputPort.type = "button";
    outputPort.className = "workspace-workflow-port workspace-workflow-port-out workspace-preview-ignore-drag";
    outputPort.dataset.linkRole = "output";
    outputPort.textContent = "Link from";
    outputPort.addEventListener("click", (event) => {
      event.stopPropagation();
      pendingLinkSourceId = stage.id;
      onStageFocus?.(stage.id);
      refreshPendingLinkState();
    });
    const inputPort = document.createElement("button");
    inputPort.type = "button";
    inputPort.className = "workspace-workflow-port workspace-workflow-port-in workspace-preview-ignore-drag";
    inputPort.dataset.linkRole = "input";
    inputPort.textContent = "Link to";
    inputPort.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!pendingLinkSourceId || pendingLinkSourceId === stage.id) {
        return;
      }
      onWorkflowLinkCreate?.(pendingLinkSourceId, stage.id);
      pendingLinkSourceId = "";
      onStageFocus?.(stage.id);
      refreshPendingLinkState();
    });
    ports.append(outputPort, inputPort);

    const actions = document.createElement("div");
    actions.className = "workspace-surface-card-actions";
    if (index > 0) {
      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "workspace-mini-action";
      leftButton.textContent = "<";
      leftButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onStageMove?.(stage.id, -1);
      });
      actions.appendChild(leftButton);
    }
    const focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "workspace-mini-action";
    focusButton.textContent = "Edit";
    focusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onStageFocus?.(stage.id);
    });
    actions.appendChild(focusButton);
    if (index < stageNodes.length - 1) {
      const rightButton = document.createElement("button");
      rightButton.type = "button";
      rightButton.className = "workspace-mini-action";
      rightButton.textContent = ">";
      rightButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onStageMove?.(stage.id, 1);
      });
      actions.appendChild(rightButton);
    }

    card.append(meta, title, note, ownerRow, ports, actions);
    stageCardMap.set(stage.id, card);
    workflowCanvas.appendChild(card);
  });

  workflowShell.appendChild(workflowCanvas);

  const metaGrid = document.createElement("div");
  metaGrid.className = "workspace-workflow-meta-grid";

  if ((model.automations || []).length) {
    const automationCard = document.createElement("article");
    automationCard.className = "workspace-workflow-meta-card";
    const automationTitle = document.createElement("strong");
    automationTitle.textContent = "Automations";
    const list = document.createElement("ul");
    (model.automations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    automationCard.append(automationTitle, list);
    metaGrid.appendChild(automationCard);
  }

  if ((model.outputs || []).length) {
    const outputsCard = document.createElement("article");
    outputsCard.className = "workspace-workflow-meta-card";
    const outputsTitle = document.createElement("strong");
    outputsTitle.textContent = "Outputs";
    const chips = document.createElement("div");
    chips.className = "workspace-flow-chip-list";
    (model.outputs || []).forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = item;
      chips.appendChild(chip);
    });
    outputsCard.append(outputsTitle, chips);
    metaGrid.appendChild(outputsCard);
  }

  if (metaGrid.children.length) {
    workflowShell.appendChild(metaGrid);
  }

  container.appendChild(workflowShell);
  refreshPendingLinkState();
}
function renderDesignExperiencePreview(
  container,
  content = "",
  {
    activeFrameId = "",
    activeBlockId = "",
    onFrameFocus = null,
    onBlockFocus = null,
    onBlockMove = null,
    onBlockPositionChange = null,
    onBlockResize = null
  } = {}
) {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDesignPreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.brief || "Design surface";
  container.appendChild(summary);

  if ((model.components || []).length) {
    const componentChips = document.createElement("div");
    componentChips.className = "workspace-flow-chip-list";
    (model.components || []).forEach((component) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = component;
      componentChips.appendChild(chip);
    });
    container.appendChild(componentChips);
  }

  const designShell = document.createElement("div");
  designShell.className = "workspace-design-shell";
  const activeFrame =
    (model.frames || []).find((frame) => frame.id === activeFrameId) ||
    (model.frames || [])[0] ||
    null;

  const designPalette = document.createElement("div");
  designPalette.className = "workspace-design-palette";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-design-swatch";
    const swatch = document.createElement("div");
    swatch.className = "workspace-design-swatch-fill";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    designPalette.appendChild(card);
  });
  if (designPalette.children.length) {
    designShell.appendChild(designPalette);
  }

  if (activeFrame) {
    const stage = document.createElement("section");
    stage.className = "workspace-design-stage";
    const stageHeader = document.createElement("div");
    stageHeader.className = "workspace-design-stage-header";
    const stageMeta = document.createElement("div");
    stageMeta.className = "workspace-design-stage-meta";
    const stageTitle = document.createElement("strong");
    stageTitle.textContent = activeFrame.name || "Active frame";
    const stageGoal = document.createElement("span");
    stageGoal.className = "muted";
    stageGoal.textContent = activeFrame.goal || "Shape the active screen directly on the canvas.";
    stageMeta.append(stageTitle, stageGoal);
    const stageActions = document.createElement("div");
    stageActions.className = "workspace-flow-chip-list";
    const focusChip = document.createElement("span");
    focusChip.className = "workspace-flow-chip";
    focusChip.textContent = `${(activeFrame.blocks || []).length} layout blocks`;
    stageActions.appendChild(focusChip);
    stageHeader.append(stageMeta, stageActions);

    const stageCanvas = document.createElement("div");
    stageCanvas.className = "workspace-design-frame-canvas workspace-design-layout-canvas workspace-design-stage-canvas";

    (activeFrame.blocks || []).forEach((blockModel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block workspace-design-layout-block${
        activeBlockId === blockModel.id ? " is-active" : ""
      }`;
      block.style.left = `${Number(blockModel.x) || 0}px`;
      block.style.top = `${Number(blockModel.y) || 0}px`;
      block.style.width = `${Number(blockModel.w) || 160}px`;
      block.style.height = `${Number(blockModel.h) || 36}px`;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(activeFrame.id, blockModel.id);
      });
      attachPreviewDrag(block, {
        initialX: Number(blockModel.x) || 0,
        initialY: Number(blockModel.y) || 0,
        getBounds: () => ({ width: stageCanvas.clientWidth || 720, height: stageCanvas.clientHeight || 360 }),
        maxX: (stageCanvas.clientWidth || 720) - (Number(blockModel.w) || 160) - 12,
        maxY: (stageCanvas.clientHeight || 360) - (Number(blockModel.h) || 36) - 12,
        onCommit: (x, y) => onBlockPositionChange?.(activeFrame.id, blockModel.id, x, y)
      });

      const label = document.createElement("span");
      label.className = "workspace-design-frame-block-label";
      label.textContent = blockModel.label || `Block ${blockIndex + 1}`;
      block.appendChild(label);

      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      const focus = document.createElement("span");
      focus.className = "workspace-design-frame-block-action";
      focus.textContent = "Edit";
      focus.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(activeFrame.id, blockModel.id);
      });
      actions.appendChild(focus);
      block.appendChild(actions);

      const resizeHandle = document.createElement("span");
      resizeHandle.className = "workspace-preview-resize-handle workspace-design-resize-handle";
      resizeHandle.title = "Resize block";
      block.appendChild(resizeHandle);
      attachPreviewResize(resizeHandle, {
        target: block,
        initialWidth: Number(blockModel.w) || 160,
        initialHeight: Number(blockModel.h) || 36,
        getBounds: () => ({ width: stageCanvas.clientWidth || 720, height: stageCanvas.clientHeight || 360 }),
        minWidth: 80,
        minHeight: 24,
        onCommit: (nextWidth, nextHeight) =>
          onBlockResize?.(
            activeFrame.id,
            blockModel.id,
            (Number(nextWidth) || 160) - (Number(blockModel.w) || 160),
            (Number(nextHeight) || 36) - (Number(blockModel.h) || 36)
          )
      });
      stageCanvas.appendChild(block);
    });

    stage.append(stageHeader, stageCanvas);
    designShell.appendChild(stage);
  }

  const designFrames = document.createElement("div");
  designFrames.className = "workspace-design-frames";
  (model.frames || []).forEach((frameModel, index) => {
    const card = document.createElement("article");
    card.className = `workspace-design-frame${frameModel.id === activeFrameId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onFrameFocus?.(frameModel.id));

    const canvas = document.createElement("div");
    canvas.className = "workspace-design-frame-canvas workspace-design-layout-canvas";

    (frameModel.blocks || []).forEach((blockModel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block workspace-design-layout-block${
        frameModel.id === activeFrameId && activeBlockId === blockModel.id ? " is-active" : ""
      }`;
      block.style.left = `${Number(blockModel.x) || 0}px`;
      block.style.top = `${Number(blockModel.y) || 0}px`;
      block.style.width = `${Number(blockModel.w) || 160}px`;
      block.style.height = `${Number(blockModel.h) || 36}px`;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(frameModel.id, blockModel.id);
      });
      attachPreviewDrag(block, {
        initialX: Number(blockModel.x) || 0,
        initialY: Number(blockModel.y) || 0,
        getBounds: () => ({ width: canvas.clientWidth || 280, height: canvas.clientHeight || 260 }),
        maxX: (canvas.clientWidth || 280) - (Number(blockModel.w) || 160) - 8,
        maxY: (canvas.clientHeight || 260) - (Number(blockModel.h) || 36) - 8,
        onCommit: (x, y) => onBlockPositionChange?.(frameModel.id, blockModel.id, x, y)
      });

      const label = document.createElement("span");
      label.className = "workspace-design-frame-block-label";
      label.textContent = blockModel.label || `Block ${blockIndex + 1}`;
      block.appendChild(label);

      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      if (blockIndex > 0) {
        const left = document.createElement("span");
        left.className = "workspace-design-frame-block-action";
        left.textContent = "<";
        left.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockModel.id, -1);
        });
        actions.appendChild(left);
      }
      if (blockIndex < (frameModel.blocks || []).length - 1) {
        const right = document.createElement("span");
        right.className = "workspace-design-frame-block-action";
        right.textContent = ">";
        right.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockModel.id, 1);
        });
        actions.appendChild(right);
      }
      if (actions.children.length) {
        block.appendChild(actions);
      }
      const resizeActions = document.createElement("span");
      resizeActions.className = "workspace-design-frame-block-actions";
      const shrink = document.createElement("span");
      shrink.className = "workspace-design-frame-block-action";
      shrink.textContent = "-";
      shrink.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockResize?.(frameModel.id, blockModel.id, -28, -10);
      });
      const grow = document.createElement("span");
      grow.className = "workspace-design-frame-block-action";
      grow.textContent = "+";
      grow.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockResize?.(frameModel.id, blockModel.id, 28, 10);
      });
      resizeActions.append(shrink, grow);
      block.appendChild(resizeActions);
      const resizeHandle = document.createElement("span");
      resizeHandle.className = "workspace-preview-resize-handle workspace-design-resize-handle";
      resizeHandle.title = "Resize block";
      block.appendChild(resizeHandle);
      attachPreviewResize(resizeHandle, {
        target: block,
        initialWidth: Number(blockModel.w) || 160,
        initialHeight: Number(blockModel.h) || 36,
        getBounds: () => ({ width: canvas.clientWidth || 280, height: canvas.clientHeight || 260 }),
        minWidth: 80,
        minHeight: 24,
        onCommit: (nextWidth, nextHeight) =>
          onBlockResize?.(
            frameModel.id,
            blockModel.id,
            (Number(nextWidth) || 160) - (Number(blockModel.w) || 160),
            (Number(nextHeight) || 36) - (Number(blockModel.h) || 36)
          )
      });
      canvas.appendChild(block);
    });

    const name = document.createElement("strong");
    name.textContent = frameModel.name || `Frame ${index + 1}`;
    const goal = document.createElement("span");
    goal.className = "muted";
    goal.textContent = frameModel.goal || `Wireframe ${index + 1}`;
    card.append(canvas, name, goal);
    designFrames.appendChild(card);
  });
  if (designFrames.children.length) {
    designShell.appendChild(designFrames);
  }

  if (designShell.children.length) {
    container.appendChild(designShell);
  }
  return;

  const shell = document.createElement("div");
  shell.className = "workspace-design-shell";

  const palette = document.createElement("div");
  palette.className = "workspace-design-palette";
  (model.palette || []).forEach((token) => {
    const card = document.createElement("article");
    card.className = "workspace-design-swatch";
    const swatch = document.createElement("div");
    swatch.className = "workspace-design-swatch-fill";
    swatch.style.background = token.value || "#ddd";
    const title = document.createElement("h4");
    title.textContent = token.name || "Color";
    const meta = document.createElement("p");
    meta.textContent = token.value || "";
    card.append(swatch, title, meta);
    palette.appendChild(card);
  });
  if (palette.children.length) {
    shell.appendChild(palette);
  }

  const frames = document.createElement("div");
  frames.className = "workspace-design-frames";
  (model.frames || []).forEach((frameModel, index) => {
    const card = document.createElement("article");
    card.className = `workspace-design-frame${frameModel.id === activeFrameId ? " is-active" : ""}`;
    card.tabIndex = 0;
    card.addEventListener("click", () => onFrameFocus?.(frameModel.id));

    const canvas = document.createElement("div");
    canvas.className = "workspace-design-frame-canvas";
    const topBar = document.createElement("div");
    topBar.className = "workspace-design-frame-header";
    const hero = document.createElement("div");
    hero.className = "workspace-design-frame-hero";
    const detailRow = document.createElement("div");
    detailRow.className = "workspace-design-frame-detail-row";
    const detailOne = document.createElement("span");
    detailOne.className = "workspace-design-frame-detail";
    const detailTwo = document.createElement("span");
    detailTwo.className = "workspace-design-frame-detail";
    const cta = document.createElement("div");
    cta.className = "workspace-design-frame-cta";
    detailRow.append(detailOne, detailTwo);
    canvas.append(topBar, hero, detailRow, cta);

    const blockList = document.createElement("div");
    blockList.className = "workspace-design-frame-blocks";
    (frameModel.blocks || []).forEach((blockLabel, blockIndex) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = `workspace-design-frame-block${
        frameModel.id === activeFrameId && activeBlockId === `block-${blockIndex + 1}` ? " is-active" : ""
      }`;
      block.textContent = blockLabel;
      block.addEventListener("click", (event) => {
        event.stopPropagation();
        onBlockFocus?.(frameModel.id, blockIndex);
      });
      const actions = document.createElement("span");
      actions.className = "workspace-design-frame-block-actions";
      if (blockIndex > 0) {
        const left = document.createElement("span");
        left.className = "workspace-design-frame-block-action";
        left.textContent = "←";
        left.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockIndex, -1);
        });
        actions.appendChild(left);
      }
      if (blockIndex < (frameModel.blocks || []).length - 1) {
        const right = document.createElement("span");
        right.className = "workspace-design-frame-block-action";
        right.textContent = "→";
        right.addEventListener("click", (event) => {
          event.stopPropagation();
          onBlockMove?.(frameModel.id, blockIndex, 1);
        });
        actions.appendChild(right);
      }
      if (actions.children.length) {
        block.appendChild(actions);
      }
      blockList.appendChild(block);
    });
    if (blockList.children.length) {
      canvas.appendChild(blockList);
    }

    const name = document.createElement("strong");
    name.textContent = frameModel.name || `Frame ${index + 1}`;
    const goal = document.createElement("span");
    goal.className = "muted";
    goal.textContent = frameModel.goal || `Wireframe ${index + 1}`;
    card.append(canvas, name, goal);
    frames.appendChild(card);
  });
  if (frames.children.length) {
    shell.appendChild(frames);
  }

  if (shell.children.length) {
    container.appendChild(shell);
  }
}

function renderMediaPreview(container, filePath = "", assetUrl = "") {
  const shell = document.createElement("div");
  shell.className = "workspace-media-shell";

  if (!assetUrl) {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "No previewable media asset is available for this surface.";
    shell.appendChild(empty);
    container.appendChild(shell);
    return;
  }

  if (isImagePath(filePath)) {
    const image = document.createElement("img");
    image.src = assetUrl;
    image.alt = filePath;
    shell.appendChild(image);
  } else if (isAudioPath(filePath)) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = assetUrl;
    shell.appendChild(audio);
  } else if (isVideoPath(filePath)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = assetUrl;
    video.playsInline = true;
    shell.appendChild(video);
  } else {
    const fallback = document.createElement("a");
    fallback.href = assetUrl;
    fallback.target = "_blank";
    fallback.rel = "noreferrer noopener";
    fallback.textContent = "Open media asset";
    shell.appendChild(fallback);
  }

  container.appendChild(shell);
}

function renderBenchmarkExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDataPreview(container, "benchmark.json", content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Project benchmark";
  container.appendChild(summary);

  if ((model.criteria || []).length) {
    const criteriaGrid = document.createElement("div");
    criteriaGrid.className = "workspace-overview-meta";
    (model.criteria || []).forEach((criterion) => {
      const card = document.createElement("article");
      card.className = "workspace-overview-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = criterion.label || criterion.id || "Criterion";
      const why = document.createElement("strong");
      why.textContent = criterion.why || "Review this dimension.";
      card.append(label, why);
      criteriaGrid.appendChild(card);
    });
    container.appendChild(criteriaGrid);
  }

  if ((model.competitors || []).length) {
    const competitors = document.createElement("div");
    competitors.className = "workspace-design-frames";
    (model.competitors || []).forEach((competitor, index) => {
      const card = document.createElement("article");
      card.className = "workspace-design-frame";
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = `Competitor ${index + 1}`;
      const title = document.createElement("strong");
      title.textContent = competitor.name || "Competitor";
      const positioning = document.createElement("p");
      positioning.textContent = competitor.positioning || "";
      const chips = document.createElement("div");
      chips.className = "workspace-flow-chip-list";
      Object.entries(competitor.scorecard || {}).forEach(([key, value]) => {
        const chip = document.createElement("span");
        chip.className = "workspace-flow-chip";
        chip.textContent = `${key}: ${value}/5`;
        chips.appendChild(chip);
      });
      card.append(meta, title, positioning);
      if (chips.children.length) {
        card.appendChild(chips);
      }
      competitors.appendChild(card);
    });
    container.appendChild(competitors);
  }

  if ((model.recommendations || []).length) {
    const recommendations = document.createElement("div");
    recommendations.className = "workspace-surface-card";
    const title = document.createElement("strong");
    title.textContent = "Recommendations";
    const list = document.createElement("ul");
    (model.recommendations || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    recommendations.append(title, list);
    container.appendChild(recommendations);
  }
}

function renderCampaignExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderDataPreview(container, "campaign.json", content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.corePromise || model.objective || "Campaign surface";
  container.appendChild(summary);

  if ((model.audiences || []).length) {
    const audiences = document.createElement("div");
    audiences.className = "workspace-overview-meta";
    (model.audiences || []).forEach((audience) => {
      const card = document.createElement("article");
      card.className = "workspace-overview-card";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = audience.segment || "Audience";
      const message = document.createElement("strong");
      message.textContent = audience.message || "";
      const hook = document.createElement("span");
      hook.className = "muted";
      hook.textContent = audience.hook || "";
      card.append(label, message, hook);
      audiences.appendChild(card);
    });
    container.appendChild(audiences);
  }

  const columns = document.createElement("div");
  columns.className = "workspace-dashboard-chart-grid";

  if ((model.channels || []).length) {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-chart-card";
    const title = document.createElement("h4");
    title.textContent = "Channels";
    const list = document.createElement("ul");
    (model.channels || []).forEach((channel) => {
      const li = document.createElement("li");
      li.textContent = `${channel.name || "Channel"} - ${channel.goal || ""}`;
      list.appendChild(li);
    });
    card.append(title, list);
    columns.appendChild(card);
  }

  if ((model.timeline || []).length) {
    const card = document.createElement("article");
    card.className = "workspace-dashboard-chart-card";
    const title = document.createElement("h4");
    title.textContent = "Timeline";
    const list = document.createElement("ul");
    (model.timeline || []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = `${step.phase || "Phase"} - ${step.focus || ""}`;
      list.appendChild(li);
    });
    card.append(title, list);
    columns.appendChild(card);
  }

  if (columns.children.length) {
    container.appendChild(columns);
  }

  if ((model.assets || []).length || (model.kpis || []).length) {
    const chips = document.createElement("div");
    chips.className = "workspace-flow-chip-list";
    [...(model.assets || []), ...(model.kpis || [])].forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "workspace-flow-chip";
      chip.textContent = item;
      chips.appendChild(chip);
    });
    container.appendChild(chips);
  }
}

function renderAudioExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Audio brief";
  container.appendChild(summary);

  const meta = document.createElement("div");
  meta.className = "workspace-flow-chip-list";
  [model.format, model.duration, model.voice?.tone].filter(Boolean).forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "workspace-flow-chip";
    chip.textContent = item;
    meta.appendChild(chip);
  });
  if (meta.children.length) {
    container.appendChild(meta);
  }

  const segments = document.createElement("div");
  segments.className = "workspace-design-frames";
  (model.segments || []).forEach((segment, index) => {
    const card = document.createElement("article");
    card.className = "workspace-design-frame";
    const metaLabel = document.createElement("span");
    metaLabel.className = "tiny";
    metaLabel.textContent = `Segment ${index + 1}`;
    const title = document.createElement("strong");
    title.textContent = segment.title || "Segment";
    const script = document.createElement("p");
    script.textContent = segment.script || segment.purpose || "";
    const cue = document.createElement("span");
    cue.className = "muted";
    cue.textContent = segment.cue || "";
    card.append(metaLabel, title, script, cue);
    segments.appendChild(card);
  });
  if (segments.children.length) {
    container.appendChild(segments);
  }
}

function renderVideoExperiencePreview(container, content = "") {
  const model = safeJsonParse(content);
  if (!model || typeof model !== "object") {
    renderCodePreview(container, content);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "workspace-preview-summary";
  summary.textContent = model.objective || "Video brief";
  container.appendChild(summary);

  const meta = document.createElement("div");
  meta.className = "workspace-flow-chip-list";
  [model.runtime, model.visualDirection].filter(Boolean).forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "workspace-flow-chip";
    chip.textContent = item;
    meta.appendChild(chip);
  });
  if (meta.children.length) {
    container.appendChild(meta);
  }

  const scenes = document.createElement("div");
  scenes.className = "workspace-design-frames";
  (model.scenes || []).forEach((scene, index) => {
    const card = document.createElement("article");
    card.className = "workspace-design-frame";
    const metaLabel = document.createElement("span");
    metaLabel.className = "tiny";
    metaLabel.textContent = scene.duration || `Scene ${index + 1}`;
    const title = document.createElement("strong");
    title.textContent = scene.title || `Scene ${index + 1}`;
    const visual = document.createElement("p");
    visual.textContent = scene.visual || "";
    const voiceover = document.createElement("p");
    voiceover.className = "muted";
    voiceover.textContent = scene.voiceover || scene.onScreen || "";
    card.append(metaLabel, title, visual, voiceover);
    scenes.appendChild(card);
  });
  if (scenes.children.length) {
    container.appendChild(scenes);
  }
}

function buildRuntimeAssetUrl(workObjectId = "", entryPath = "") {
  const normalized = normalizePath(entryPath);
  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return normalized
    ? `/api/work-objects/${encodeURIComponent(String(workObjectId || ""))}/assets/${encodedPath}`
    : "";
}

function resolveRuntimeAssetPath(baseEntryPath = "", relativeAssetPath = "") {
  const normalizedBase = normalizePath(baseEntryPath);
  const normalizedRelative = normalizePath(relativeAssetPath);

  if (
    !normalizedRelative ||
    normalizedRelative.startsWith("#") ||
    normalizedRelative.startsWith("/") ||
    /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(normalizedRelative)
  ) {
    return normalizedRelative;
  }

  const baseParts = normalizedBase.split("/").filter(Boolean);
  baseParts.pop();

  for (const part of normalizedRelative.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }

  return baseParts.join("/");
}

function rewriteDraftRuntimeHtml(html = "", workObject = null, runtimeEntryPath = "") {
  const normalized = String(html || "");
  if (!normalized || !workObject?.id || !runtimeEntryPath) {
    return normalized;
  }

  const rewritten = normalized.replace(
    /\b(src|href)=["']([^"'#][^"']*)["']/gi,
    (match, attr, rawValue) => {
      const resolvedPath = resolveRuntimeAssetPath(runtimeEntryPath, rawValue);
      if (!resolvedPath || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|\/)/i.test(resolvedPath)) {
        return match;
      }

      const assetUrl = buildRuntimeAssetUrl(workObject.id, resolvedPath);
      return `${attr}="${assetUrl}"`;
    }
  );

  if (/<head[\s>]/i.test(rewritten)) {
    return rewritten.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />`
    );
  }

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>${rewritten}</body></html>`;
}

function renderAppPreview(container, assetUrl = "", options = {}) {
  const shell = document.createElement("div");
  shell.className = "workspace-app-shell";

  if (!assetUrl && !options.srcdoc) {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "No app preview is available yet for this object.";
    shell.appendChild(empty);
    container.appendChild(shell);
    return;
  }

  const frame = document.createElement("iframe");
  frame.className = "workspace-app-frame";
  if (options.srcdoc) {
    frame.srcdoc = options.srcdoc;
  } else {
    frame.src = assetUrl;
  }
  frame.title = "Hydria app preview";
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
  shell.appendChild(frame);
  container.appendChild(shell);
}

function classifyRuntimePatch(runtimePatch = {}, runtimeSession = null, surfaceModel = null) {
  const entryPath = normalizePath(runtimePatch?.entryPath || "");
  const runtimeEntryPath = normalizePath(
    surfaceModel?.runtimeEntryPath || runtimeSession?.entryPath || ""
  );

  if (!entryPath) {
    return "reload";
  }
  if (/\.css$/i.test(entryPath)) {
    return "css";
  }
  if (/\.html?$/i.test(entryPath) && entryPath === runtimeEntryPath) {
    return "html";
  }
  return "reload";
}

function applyRuntimePatch(frame, runtimePatch = null, runtimeSession = null, surfaceModel = null) {
  if (!frame?.contentWindow || !runtimePatch || !runtimeSession?.id) {
    return false;
  }

  const patchType = classifyRuntimePatch(runtimePatch, runtimeSession, surfaceModel);
  if (patchType === "reload") {
    return false;
  }

  frame.contentWindow.postMessage(
    {
      type: "hydria-runtime-patch",
      sessionId: runtimeSession.id,
      runtimeVersion: Number(runtimePatch.runtimeVersion || runtimeSession.runtimeVersion || 0),
      patchType,
      entryPath: runtimePatch.entryPath || "",
      content: runtimePatch.content || ""
    },
    "*"
  );
  return true;
}

function upsertPreviewHeader(container, { titleText = "", metaText = "", kindText = "" } = {}) {
  let header = container.querySelector(".workspace-preview-header");
  let title;
  let meta;
  let kind;

  if (!header) {
    header = document.createElement("div");
    header.className = "workspace-preview-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "workspace-preview-title-group";
    title = document.createElement("strong");
    meta = document.createElement("span");
    meta.className = "tiny";
    titleGroup.append(title, meta);

    kind = document.createElement("span");
    kind.className = "workspace-preview-kind";

    header.append(titleGroup, kind);
    container.prepend(header);
  } else {
    title = header.querySelector(".workspace-preview-title-group strong");
    meta = header.querySelector(".workspace-preview-title-group .tiny");
    kind = header.querySelector(".workspace-preview-kind");
  }

  title.textContent = titleText;
  meta.textContent = metaText;
  kind.textContent = kindText;
  return header;
}

function renderSurfaceOverview(container, { workObject = null, project = null, sections = [], blocks = [] } = {}) {
  renderProjectOverview(container, { project, workObject, blocks });
  renderOutline(container, sections, "");

  const meta = document.createElement("div");
  meta.className = "workspace-overview-grid";
  const items = [
    {
      label: "Object",
      value: workObject?.title || "Hydria object"
    },
    {
      label: "Type",
      value: workObject?.objectKind || workObject?.kind || "document"
    },
    {
      label: "Revision",
      value: String(workObject?.revision || 1)
    },
    {
      label: "Primary file",
      value: workObject?.primaryFile || "-"
    }
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-overview-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value;
    card.append(label, value);
    meta.appendChild(card);
  });

  container.appendChild(meta);
}

export function renderWorkspacePreview(
  container,
  {
    workObject = null,
    project = null,
    projectWorkObjects = [],
    filePath = "",
    content = "",
    surfaceModel = null,
    currentSurfaceId = "",
    runtimeSession = null,
    runtimePatch = null,
    editorDirty = false,
    selectedSectionId = "",
    sections = [],
    blocks = [],
    currentBlockId = "",
    selectedStructuredItemId = "",
    selectedStructuredSubItemId = "",
    activePreviewFilter = "",
    onDocumentSectionFocus = null,
    onDocumentInlineEdit = null,
    onProjectObjectSelect = null,
    onPresentationSlideFocus = null,
    onPresentationSlideEdit = null,
    onDataHeaderEdit = null,
    onDataCellEdit = null,
    onDataGridEdit = null,
    onDashboardFilterToggle = null,
    onDashboardWidgetMove = null,
    onDashboardWidgetDrop = null,
    onDashboardWidgetResize = null,
    onDashboardWidgetFocus = null,
    onDashboardChartFocus = null,
    onWorkflowStageFocus = null,
    onWorkflowStageMove = null,
    onWorkflowStagePositionChange = null,
    onWorkflowLinkCreate = null,
    onWorkflowLinkFocus = null,
    onWorkflowLinkRemove = null,
    onDesignFrameFocus = null,
    onDesignBlockFocus = null,
    onDesignBlockMove = null,
    onDesignBlockPositionChange = null,
    onDesignBlockResize = null
  } = {}
) {
  if (!workObject || !filePath) {
    container.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = "Select a project object or file to preview it here.";
    container.appendChild(empty);
    return;
  }

  const normalizedPath = normalizePath(filePath);
  const section =
    selectedSectionId && selectedSectionId !== "whole-file"
      ? sections.find((item) => item.id === selectedSectionId)
      : null;
  const block = currentBlockId ? blocks.find((item) => item.id === currentBlockId) : null;
  const contentToRender = block?.block || section?.block || content;
  const objectKind = workObject.objectKind || workObject.kind || "document";
  const resolvedSurfaceId = currentSurfaceId || surfaceModel?.defaultSurface || "preview";
  const assetUrl = surfaceModel?.assetUrl || "";
  const mediaPreviewPath = surfaceModel?.previewAssetPath || normalizedPath;
  const mediaPreviewUrl = surfaceModel?.previewAssetUrl || assetUrl;
  const runtimeUrl = runtimeSession?.preview?.renderUrl || surfaceModel?.runtimeUrl || "";
  const runtimeLiveUrl = runtimeUrl
    ? `${runtimeUrl}${runtimeUrl.includes("?") ? "&" : "?"}rev=${encodeURIComponent(
        String(runtimeSession?.runtimeVersion || workObject?.revision || 1)
      )}`
    : "";
  const runtimeSessionStatus = runtimeSession?.status || "";
  const fileLabel = friendlyPathLabel(normalizedPath);
  const isDocumentMarkupFile =
    isMarkdownPath(normalizedPath) ||
    (
      workObject?.workspaceFamilyId === "document_knowledge" &&
      /\.html?$/i.test(normalizedPath) &&
      isRichDocumentHtml(contentToRender)
    );
  const metaText = block
    ? `${fileLabel} · ${block.title}`
    : section
      ? `${fileLabel} · ${section.title}`
      : fileLabel;
  const kindText =
    resolvedSurfaceId === "live"
      ? runtimeSessionStatus === "modified"
        ? "Live draft"
        : "Live"
      : toSurfaceLabel(resolvedSurfaceId);

  if (resolvedSurfaceId === "live") {
    upsertPreviewHeader(container, {
      titleText: workObject.title || "Hydria Object",
      metaText,
      kindText
    });

    let shell = container.querySelector(".workspace-app-shell");
    let frame = container.querySelector(".workspace-app-frame");
    if (!shell || !frame) {
      container.querySelectorAll(":scope > :not(.workspace-preview-header)").forEach((node) => node.remove());
      shell = document.createElement("div");
      shell.className = "workspace-app-shell";
      frame = document.createElement("iframe");
      frame.className = "workspace-app-frame";
      frame.title = "Hydria app preview";
      frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
      shell.appendChild(frame);
      container.appendChild(shell);
    }

    if (frame.getAttribute("srcdoc")) {
      frame.removeAttribute("srcdoc");
    }
    const runtimeSessionId = String(runtimeSession?.id || "");
    const nextRuntimeVersion = String(runtimeSession?.runtimeVersion || "");
    const sameSession = frame.dataset.runtimeSessionId === runtimeSessionId;
    const sameBase = frame.dataset.runtimeBase === runtimeUrl;
    const versionChanged = frame.dataset.runtimeVersion !== nextRuntimeVersion;

    if (!sameSession || !sameBase || !frame.dataset.runtimeLoaded) {
      frame.src = runtimeLiveUrl;
      frame.dataset.runtimeSrc = runtimeLiveUrl;
      frame.dataset.runtimeBase = runtimeUrl;
      frame.dataset.runtimeSessionId = runtimeSessionId;
      frame.dataset.runtimeVersion = nextRuntimeVersion;
      frame.dataset.runtimeLoaded = "1";
      return;
    }

    if (versionChanged) {
      const patched = applyRuntimePatch(frame, runtimePatch, runtimeSession, surfaceModel);
      if (!patched) {
        if (frame.dataset.runtimeSrc !== runtimeLiveUrl) {
          frame.src = runtimeLiveUrl;
          frame.dataset.runtimeSrc = runtimeLiveUrl;
        } else if (frame.contentWindow?.location) {
          frame.contentWindow.location.replace(runtimeLiveUrl);
        }
      }
      frame.dataset.runtimeVersion = nextRuntimeVersion;
    }
    return;
  }

  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "workspace-preview-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "workspace-preview-title-group";
  const title = document.createElement("strong");
  title.textContent = workObject.title || "Hydria Object";
  const meta = document.createElement("span");
  meta.className = "tiny";
  meta.textContent = metaText.replace(/Â·/g, "-");
  titleGroup.append(title, meta);

  const kind = document.createElement("span");
  kind.className = "workspace-preview-kind";
  kind.textContent = kindText;
  header.append(titleGroup, kind);
  container.appendChild(header);

  if (resolvedSurfaceId === "overview") {
    renderSurfaceOverview(container, { workObject, project, sections, blocks });
    return;
  }

  if (resolvedSurfaceId === "edit") {
    const empty = document.createElement("div");
    empty.className = "workspace-surface-empty";
    empty.textContent = "Editing mode is active. Use the editor pane to modify the selected surface directly.";
    container.appendChild(empty);
    return;
  }

  if (resolvedSurfaceId === "app") {
    renderAppPreview(container, assetUrl);
    return;
  }

  if (resolvedSurfaceId === "media") {
    renderMediaPreview(container, mediaPreviewPath, mediaPreviewUrl);
    return;
  }

  if (resolvedSurfaceId === "benchmark") {
    renderBenchmarkExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "campaign") {
    renderCampaignExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "audio") {
    renderAudioExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "video") {
    renderVideoExperiencePreview(container, contentToRender);
    return;
  }

  if (resolvedSurfaceId === "data") {
    renderDataPreview(container, normalizedPath, contentToRender, {
      workObject,
      onHeaderEdit: onDataHeaderEdit,
      onCellEdit: onDataCellEdit,
      onGridEdit: onDataGridEdit
    });
    return;
  }

  if (resolvedSurfaceId === "dashboard") {
    renderDashboardExperiencePreview(container, contentToRender, {
      activeFilter: activePreviewFilter,
      activeWidgetId: selectedStructuredSubItemId,
      activeChartId: selectedStructuredItemId,
      onFilterToggle: onDashboardFilterToggle,
      onWidgetMove: onDashboardWidgetMove,
      onWidgetDrop: onDashboardWidgetDrop,
      onWidgetResize: onDashboardWidgetResize,
      onWidgetFocus: onDashboardWidgetFocus,
      onChartFocus: onDashboardChartFocus
    });
    return;
  }

  if (resolvedSurfaceId === "workflow") {
    renderWorkflowExperiencePreview(container, contentToRender, {
      activeStageId: selectedStructuredItemId,
      activeLinkId: selectedStructuredSubItemId,
      onStageFocus: onWorkflowStageFocus,
      onStageMove: onWorkflowStageMove,
      onStagePositionChange: onWorkflowStagePositionChange,
      onWorkflowLinkCreate,
      onLinkFocus: onWorkflowLinkFocus,
      onWorkflowLinkRemove
    });
    return;
  }

  if (resolvedSurfaceId === "design") {
    renderDesignExperiencePreview(container, contentToRender, {
      activeFrameId: selectedStructuredItemId,
      activeBlockId: selectedStructuredSubItemId,
      onFrameFocus: onDesignFrameFocus,
      onBlockFocus: onDesignBlockFocus,
      onBlockMove: onDesignBlockMove,
      onBlockPositionChange: onDesignBlockPositionChange,
      onBlockResize: onDesignBlockResize
    });
    return;
  }

  if (resolvedSurfaceId === "presentation") {
    renderPresentationPreview(
      container,
      contentToRender,
      sections,
      selectedSectionId,
      onPresentationSlideFocus,
      onPresentationSlideEdit
    );
    return;
  }

  if (resolvedSurfaceId === "code") {
    renderCodePreview(container, contentToRender, normalizedPath);
    return;
  }

  if (resolvedSurfaceId === "structure") {
    renderOutline(container, sections, selectedSectionId);
    if (isDocumentMarkupFile) {
      renderMarkdownPreview(
        container,
        contentToRender,
        sections,
        selectedSectionId,
        onDocumentSectionFocus,
        onDocumentInlineEdit,
        workObject,
        projectWorkObjects,
        onProjectObjectSelect
      );
      return;
    }
    if (isCodePath(normalizedPath) || isJsonPath(normalizedPath)) {
      renderCodePreview(container, contentToRender, normalizedPath);
      return;
    }
  }

  if (objectKind === "project") {
    renderProjectOverview(container, { project, workObject, blocks });
  }

  if (isDocumentMarkupFile) {
    if (objectKind === "presentation") {
      renderPresentationPreview(container, contentToRender, sections, selectedSectionId, onPresentationSlideFocus, onPresentationSlideEdit);
      return;
    }
    if (objectKind === "document" || objectKind === "project") {
      renderOutline(container, sections, selectedSectionId);
    }
    renderMarkdownPreview(
      container,
      contentToRender,
      sections,
      selectedSectionId,
      onDocumentSectionFocus,
      onDocumentInlineEdit,
      workObject,
      projectWorkObjects,
      onProjectObjectSelect
    );
    return;
  }

  if (isJsonPath(normalizedPath) || isCsvPath(normalizedPath)) {
    if (objectKind === "dashboard") {
      renderDashboardExperiencePreview(container, contentToRender, {
        activeFilter: activePreviewFilter,
        activeWidgetId: selectedStructuredSubItemId,
        activeChartId: selectedStructuredItemId,
        onFilterToggle: onDashboardFilterToggle,
        onWidgetMove: onDashboardWidgetMove,
        onWidgetDrop: onDashboardWidgetDrop,
        onWidgetResize: onDashboardWidgetResize,
        onWidgetFocus: onDashboardWidgetFocus,
        onChartFocus: onDashboardChartFocus
      });
      return;
    }
    if (objectKind === "workflow") {
      renderWorkflowExperiencePreview(container, contentToRender, {
        activeStageId: selectedStructuredItemId,
        activeLinkId: selectedStructuredSubItemId,
        onStageFocus: onWorkflowStageFocus,
        onStageMove: onWorkflowStageMove,
        onStagePositionChange: onWorkflowStagePositionChange,
        onWorkflowLinkCreate,
        onLinkFocus: onWorkflowLinkFocus,
        onWorkflowLinkRemove
      });
      return;
    }
    if (objectKind === "design") {
      renderDesignExperiencePreview(container, contentToRender, {
        activeFrameId: selectedStructuredItemId,
        activeBlockId: selectedStructuredSubItemId,
        onFrameFocus: onDesignFrameFocus,
        onBlockFocus: onDesignBlockFocus,
        onBlockMove: onDesignBlockMove,
        onBlockPositionChange: onDesignBlockPositionChange,
        onBlockResize: onDesignBlockResize
      });
      return;
    }
    if (objectKind === "benchmark") {
      renderBenchmarkExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "campaign") {
      renderCampaignExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "audio") {
      renderAudioExperiencePreview(container, contentToRender);
      return;
    }
    if (objectKind === "video") {
      renderVideoExperiencePreview(container, contentToRender);
      return;
    }
    renderDataPreview(container, normalizedPath, contentToRender, {
      workObject,
      onHeaderEdit: onDataHeaderEdit,
      onCellEdit: onDataCellEdit,
      onGridEdit: onDataGridEdit
    });
    return;
  }

  if (isImagePath(mediaPreviewPath) || isAudioPath(mediaPreviewPath) || isVideoPath(mediaPreviewPath)) {
    renderMediaPreview(container, mediaPreviewPath, mediaPreviewUrl);
    return;
  }

  if (isHtmlPreviewPath(normalizedPath)) {
    renderAppPreview(container, assetUrl);
    return;
  }

  if (isCodePath(normalizedPath)) {
    renderCodePreview(container, contentToRender, normalizedPath);
    return;
  }

  const pre = document.createElement("pre");
  pre.className = "workspace-code-preview";
  pre.textContent = contentToRender;
  container.appendChild(pre);
}

export function renderWorkspaceDimensionNav(
  container,
  dimensions = [],
  currentDimension = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  const values = ["all", ...dimensions.filter(Boolean)];
  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-chip${
      (value === "all" ? "" : value) === currentDimension ? " active" : ""
    }`;
    button.textContent = value === "all" ? "Everything" : value;
    button.addEventListener("click", () => onSelect(value === "all" ? "" : value));
    container.appendChild(button);
  }
}

export function renderWorkspaceSurfaceNav(
  container,
  surfaces = [],
  currentSurfaceId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  const visibleSurfaces = surfaces
    .filter((item) => item?.enabled !== false)
    .filter((surface) => surface.id !== "edit");

  container.classList.toggle("hidden", visibleSurfaces.length < 2);

  for (const surface of visibleSurfaces) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-chip${surface.id === currentSurfaceId ? " active" : ""}`;
    button.textContent = toSurfaceLabel(surface.id || surface.label);
    button.addEventListener("click", () => onSelect(surface.id));
    container.appendChild(button);
  }
}

export function renderWorkspaceBreadcrumb(
  container,
  items = []
) {
  container.innerHTML = "";

  for (const item of items.filter((entry) => entry?.value)) {
    const crumb = document.createElement("div");
    crumb.className = "workspace-crumb";

    const label = document.createElement("span");
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = item.value;

    crumb.append(label, value);
    container.appendChild(crumb);
  }
}

function formatWorkspaceFamilyLabel(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const map = {
    document_knowledge: "Document & Knowledge",
    data_spreadsheet: "Data & Spreadsheet",
    analytics_dashboard: "Analytics & Dashboard",
    development: "Development",
    app_builder: "App Builder",
    design: "Design",
    presentation: "Presentation",
    project_management: "Project Management",
    strategy_planning: "Strategy & Planning",
    workflow_automation: "Workflow & Automation",
    ai_agent: "AI & Agents",
    crm_sales: "CRM & Sales",
    operations: "Operations",
    finance: "Finance",
    hr: "HR",
    file_storage: "Files & Storage",
    testing_qa: "Testing & QA",
    web_cms: "Web & CMS",
    media: "Media",
    audio: "Audio",
    integration_api: "Integrations & API",
    knowledge_graph: "Knowledge Graph"
  };

  if (map[normalized]) {
    return map[normalized];
  }

  if (/[A-Z&]/.test(normalized) || normalized.includes(" / ")) {
    return normalized;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatObjectKindLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    project: "Project",
    document: "Document",
    dataset: "Spreadsheet",
    dashboard: "Dashboard",
    workflow: "Workflow",
    design: "Design",
    presentation: "Presentation",
    benchmark: "Benchmark",
    campaign: "Campaign",
    image: "Image",
    audio: "Audio",
    video: "Video",
    code: "Code"
  };

  if (map[normalized]) {
    return map[normalized];
  }

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";
}

function createWorkspaceChip(text = "", tone = "default") {
  if (!text) {
    return null;
  }

  const chip = document.createElement("span");
  chip.className = `workspace-mini-chip ${tone}`.trim();
  chip.textContent = text;
  return chip;
}

export function renderWorkspaceObjectList(
  container,
  workObjects = [],
  currentWorkObjectId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  if (!workObjects.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = "No project objects yet. Ask Hydria to add a document, table, deck, workflow or app surface.";
    container.appendChild(empty);
    return;
  }

  for (const workObject of workObjects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentWorkObjectId === workObject.id ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelect(workObject));

    const header = document.createElement("div");
    header.className = "workspace-nav-card-header";

    const title = document.createElement("strong");
    title.textContent = workObject.title;
    const chipRow = document.createElement("div");
    chipRow.className = "workspace-chip-row";
    [
      createWorkspaceChip(formatObjectKindLabel(workObject.objectKind || workObject.kind), "kind"),
      createWorkspaceChip(
        formatWorkspaceFamilyLabel(workObject.workspaceFamilyLabel || workObject.workspaceFamilyId),
        "family"
      )
    ]
      .filter(Boolean)
      .forEach((chip) => chipRow.appendChild(chip));
    header.append(title, chipRow);

    const summary = document.createElement("span");
    summary.className = "workspace-nav-summary";
    summary.textContent =
      workObject.summary ||
      workObject.nextActionHint ||
      "Open this object and continue shaping it inside the project.";

    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = [
      workObject.nextActionHint || "Keep shaping this object",
      workObject.primaryFile ? friendlyPathLabel(workObject.primaryFile) : "",
      workObject.status || ""
    ]
      .filter(Boolean)
      .join(" · ");

    meta.textContent = meta.textContent.replaceAll("Â·", "|");
    button.append(header, summary, meta);
    container.appendChild(button);
  }
}

export function renderWorkspaceSectionList(
  container,
  sections = [],
  currentSectionId = "",
  onSelect = () => {},
  options = {}
) {
  container.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `workspace-nav-item${!currentSectionId ? " active" : ""}`;
  allButton.innerHTML = `<strong>${options.rootLabel || "Everything"}</strong><span class="workspace-nav-meta">${options.rootMeta || "Edit the full page"}</span>`;
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  for (const section of sections) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentSectionId === section.id ? " active" : ""
    }`;
    button.style.paddingLeft = `${0.9 + Math.max(0, section.level - 1) * 0.7}rem`;

    const title = document.createElement("strong");
    title.textContent = section.title;
    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = options.itemMetaLabel || "Part";

    button.append(title, meta);
    button.addEventListener("click", () => onSelect(section.id));
    container.appendChild(button);
  }
}

export function renderWorkspaceBlockList(
  container,
  blocks = [],
  currentBlockId = "",
  onSelect = () => {},
  options = {}
) {
  container.innerHTML = "";

  if (!blocks.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = options.emptyLabel || "Pick a part above to focus a smaller piece.";
    container.appendChild(empty);
    return;
  }

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `workspace-nav-item${!currentBlockId ? " active" : ""}`;
  allButton.innerHTML = `<strong>${options.rootLabel || "Selected part"}</strong><span class="workspace-nav-meta">${options.rootMeta || "Edit the whole part at once"}</span>`;
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  for (const block of blocks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-nav-item${
      currentBlockId === block.id ? " active" : ""
    }`;

    const title = document.createElement("strong");
    title.textContent = block.title || "Block";
    const meta = document.createElement("span");
    meta.className = "workspace-nav-meta";
    meta.textContent = [options.itemMetaLabel || "", `${block.preview || ""}`.slice(0, 140)]
      .filter(Boolean)
      .join(" | ");

    button.append(title, meta);
    button.addEventListener("click", () => onSelect(block.id));
    container.appendChild(button);
  }
}

export function renderProjectCards(
  container,
  projects = [],
  currentProjectId = "",
  onSelect = () => {}
) {
  container.innerHTML = "";

  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = "No projects yet. Start a conversation and Hydria will open the first project here.";
    container.appendChild(empty);
    return;
  }

  for (const project of projects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-card${
      currentProjectId === project.id ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelect(project));

    const title = document.createElement("strong");
    title.textContent = project.name;
    const summary = document.createElement("p");
    summary.className = "workspace-nav-summary";
    summary.textContent =
      project.globalProject?.summary ||
      `Project with ${project.workObjectCount || 0} linked objects ready to keep evolving.`;

    const chipRow = document.createElement("div");
    chipRow.className = "workspace-chip-row";
    (project.workspaceFamilies || [])
      .slice(0, 4)
      .forEach((family) => {
        const chip = createWorkspaceChip(formatWorkspaceFamilyLabel(family), "family");
        if (chip) {
          chipRow.appendChild(chip);
        }
      });

    const meta = document.createElement("p");
    meta.className = "tiny";
    meta.textContent = [
      project.linkedDimensions?.length
        ? project.linkedDimensions.join(", ")
        : project.dimensions?.join(", "),
      `${project.workObjectCount || 0} objects`,
      project.status || ""
    ]
      .filter(Boolean)
      .join(" | ");

    button.append(title, summary, chipRow, meta);
    container.appendChild(button);
  }
}

function humanizeGraphEdgeType(type = "") {
  switch (String(type || "")) {
    case "active_on":
      return "active";
    case "derived_from_project":
      return "derived from project";
    case "derived_for_communication":
      return "derived for communication";
    case "derived_for_analysis":
      return "derived for analysis";
    case "variant_of":
      return "variant";
    case "derived_from":
      return "derived from";
    default:
      return String(type || "").replace(/_/g, " ");
  }
}

export function renderWorkspaceProjectMap(
  container,
  {
    project = null,
    workObjects = [],
    currentWorkObjectId = "",
    onSelectWorkObject = () => {}
  } = {}
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const graph = project?.graph || null;
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const objectNodes = graphNodes.filter((node) => node.type === "work_object");
  const workspaceFamilies = Array.isArray(project?.workspaceFamilies) && project.workspaceFamilies.length
    ? project.workspaceFamilies
    : Array.isArray(graph?.workspaceFamilies)
      ? graph.workspaceFamilies
      : [];

  if (!project || (!objectNodes.length && !workObjects.length)) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  const shell = document.createElement("section");
  shell.className = "workspace-project-map-shell";

  const header = document.createElement("div");
  header.className = "workspace-project-map-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "tiny";
  eyebrow.textContent = "Project map";
  const title = document.createElement("strong");
  title.textContent = project?.name || "Current project";
  heading.append(eyebrow, title);

  const summary = document.createElement("span");
  summary.className = "workspace-project-map-summary";
  summary.textContent = `${workObjects.length || objectNodes.length} objects linked`;
  header.append(heading, summary);
  shell.appendChild(header);

  if (workspaceFamilies.length) {
    const families = document.createElement("div");
    families.className = "workspace-project-family-list";
    workspaceFamilies.forEach((family) => {
      const chip = document.createElement("span");
      chip.className = "workspace-project-family-chip";
      chip.textContent = formatWorkspaceFamilyLabel(family);
      families.appendChild(chip);
    });
    shell.appendChild(families);
  }

  const nodeById = new Map(objectNodes.map((node) => [node.id, node]));
  const objectList = objectNodes.length
    ? objectNodes
    : workObjects.map((workObject) => ({
        id: workObject.id,
        label: workObject.title,
        objectKind: workObject.objectKind || workObject.kind || "",
        workspaceFamilyId: workObject.workspaceFamilyId || "",
        workspaceFamilyLabel: workObject.workspaceFamilyLabel || "",
        primaryFile: workObject.primaryFile || "",
        status: workObject.status || ""
      }));

  const nodeList = document.createElement("div");
  nodeList.className = "workspace-project-node-list";
  objectList.forEach((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-project-node${
      String(node.id) === String(currentWorkObjectId) ? " active" : ""
    }`;
    button.addEventListener("click", () => onSelectWorkObject(node.id));

    const nodeTitle = document.createElement("strong");
    nodeTitle.textContent = node.label || node.primaryFile || node.id;

    const meta = document.createElement("span");
    meta.className = "workspace-project-node-meta";
    meta.textContent = [
      formatWorkspaceFamilyLabel(node.workspaceFamilyLabel || node.workspaceFamilyId),
      formatObjectKindLabel(node.objectKind),
      node.primaryFile ? friendlyPathLabel(node.primaryFile) : "",
      node.status || ""
    ]
      .filter(Boolean)
      .join(" · ");

    meta.textContent = meta.textContent.replaceAll("Â·", "|");
    button.append(nodeTitle, meta);
    nodeList.append(button);
  });
  shell.appendChild(nodeList);

  const relevantEdges = graphEdges.filter((edge) =>
    edge.type !== "contains" && edge.type !== "opens_in_workspace"
  );
  if (relevantEdges.length) {
    const edgeList = document.createElement("div");
    edgeList.className = "workspace-project-edge-list";
    relevantEdges.forEach((edge) => {
      const item = document.createElement("div");
      item.className = "workspace-project-edge";
      const from = nodeById.get(edge.from)?.label || project?.name || edge.from;
      const to = nodeById.get(edge.to)?.label || edge.to;
      item.textContent = `${from} → ${to} (${humanizeGraphEdgeType(edge.type)})`;
      edgeList.appendChild(item);
    });
    shell.appendChild(edgeList);
  }

  container.appendChild(shell);
}
