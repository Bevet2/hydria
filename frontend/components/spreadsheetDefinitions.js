// Spreadsheet formatting and formula metadata; no UI state or side effects.
export const SPREADSHEET_NUMBER_FORMATS = new Set(["number", "currency", "percent", "date"]);
export const SPREADSHEET_HORIZONTAL_ALIGNMENTS = new Set(["left", "center", "right"]);
export const SPREADSHEET_VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
export const SPREADSHEET_BORDER_EDGES = ["top", "right", "bottom", "left"];
export const SPREADSHEET_BORDER_STYLE_CSS = {
  thin: "1px solid",
  medium: "2px solid",
  thick: "3px solid",
  dashed: "2px dashed",
  dotted: "2px dotted",
  double: "3px double"
};
export const SPREADSHEET_BORDER_STYLE_LABELS = {
  thin: "Trait fin",
  medium: "Trait moyen",
  thick: "Trait epais",
  dashed: "Tirets",
  dotted: "Pointilles",
  double: "Double trait"
};
export const SPREADSHEET_CONDITIONAL_FORMAT_TYPES = new Set([
  "greaterThan",
  "lessThan",
  "between",
  "equal",
  "textContains",
  "duplicate"
]);
export const SPREADSHEET_CONDITIONAL_FORMAT_TYPE_LABELS = {
  greaterThan: "Superieur a",
  lessThan: "Inferieur a",
  between: "Entre",
  equal: "Egal a",
  textContains: "Texte qui contient",
  duplicate: "Valeurs en double"
};
export const SPREADSHEET_CONDITIONAL_FORMAT_PRESETS = [
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
export const SPREADSHEET_TABLE_STYLES = ["blue", "green", "orange", "purple", "gray"];
export const SPREADSHEET_TABLE_TOTAL_FUNCTIONS = new Set(["sum", "average", "count", "min", "max", "none"]);
export const SPREADSHEET_TABLE_TOTAL_LABELS = {
  sum: "Somme",
  average: "Moyenne",
  count: "Nombre",
  min: "Min",
  max: "Max",
  none: "Aucun"
};
export const SPREADSHEET_TABLE_TOTAL_SUBTOTAL_CODES = {
  sum: 109,
  average: 101,
  count: 103,
  min: 105,
  max: 104
};
export const SPREADSHEET_BUILTIN_FORMULA_NAMES = new Set([
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
export const SPREADSHEET_FORMULA_NAME_ALIASES = {
  SI: "IF",
  SIERREUR: "IFERROR",
  ET: "AND",
  OU: "OR",
  NON: "NOT",
  VRAI: "TRUE",
  FAUX: "FALSE",
  AVG: "AVERAGE",
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
export const SPREADSHEET_FORMULA_CATEGORIES = [
  { id: "all", label: "Tout", ribbonLabel: "Toutes", icon: "function" },
  { id: "math", label: "Math et trigo", ribbonLabel: "Math", icon: "number" },
  { id: "statistical", label: "Statistiques", ribbonLabel: "Stat", icon: "chart" },
  { id: "logical", label: "Logique", ribbonLabel: "Logique", icon: "checkbox" },
  { id: "text", label: "Texte", ribbonLabel: "Texte", icon: "text" },
  { id: "date", label: "Date et heure", ribbonLabel: "Date", icon: "calendar" },
  { id: "lookup", label: "Recherche et reference", ribbonLabel: "Recherche", icon: "search" },
  { id: "conditional", label: "Conditionnelles", ribbonLabel: "Condition", icon: "filter" }
];
export const SPREADSHEET_FORMULA_DEFINITIONS = [
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

export const SPREADSHEET_FORMULA_HELP = {
  ABS: {
    example: "=ABS(B2)",
    arguments: [["nombre", "nombre dont il faut supprimer le signe."]]
  },
  AND: {
    example: "=AND(B2>0; C2=\"OK\")",
    arguments: [
      ["condition1", "premiere condition a verifier."],
      ["condition2", "conditions supplementaires optionnelles."]
    ]
  },
  AVERAGE: {
    example: "=AVERAGE(B2:B20)",
    arguments: [["nombre1", "valeurs ou plages a moyenner."]],
    notes: ["Alias acceptes dans Hydria: AVG et MOYENNE."]
  },
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
  CONCAT: {
    example: '=CONCAT(A2; " "; B2)',
    arguments: [["texte1", "textes, cellules ou plages a assembler."]],
    notes: ["L'export XLSX ajoute le prefixe Excel moderne necessaire pour garder la formule compatible."]
  },
  COUNT: {
    example: "=COUNT(B2:B20)",
    arguments: [["valeur1", "valeurs ou plages ou compter les nombres."]]
  },
  COUNTA: {
    example: "=COUNTA(A2:A20)",
    arguments: [["valeur1", "valeurs ou plages ou compter les cellules non vides."]]
  },
  COUNTBLANK: {
    example: "=COUNTBLANK(A2:A20)",
    arguments: [["plage", "plage ou compter les cellules vides."]]
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
    example: '=FILTER(A2:F13; F2:F13>10000; "none")',
    arguments: [
      ["tableau", "plage a retourner."],
      ["inclure", "test logique qui choisit les lignes ou colonnes."],
      ["si_vide", "valeur a afficher si aucun resultat n'est trouve."]
    ],
    notes: ["Fonction dynamique: le resultat peut deborder sur plusieurs cellules. Dans Excel, la zone de sortie doit etre libre."]
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
    example: "=INDEX(FILTER(A2:F13; F2:F13>10000); 1; 6)",
    arguments: [
      ["plage", "plage ou resultat dynamique ou chercher la valeur."],
      ["no_ligne", "position de la ligne dans la plage."],
      ["no_colonne", "position de la colonne dans la plage."]
    ],
    notes: ["INDEX peut lire le resultat de FILTER, SORT ou UNIQUE sans forcer le debordement dans Excel."]
  },
  LEFT: {
    example: "=LEFT(C2; 5)",
    arguments: [
      ["texte", "texte a lire."],
      ["nb_caracteres", "nombre de caracteres a extraire depuis la gauche."]
    ]
  },
  LEN: {
    example: "=LEN(C2)",
    arguments: [["texte", "texte dont il faut mesurer la longueur."]]
  },
  LOWER: {
    example: "=LOWER(C2)",
    arguments: [["texte", "texte a convertir en minuscules."]]
  },
  MATCH: {
    example: '=MATCH("Nord"; A2:A20; 0)',
    arguments: [
      ["valeur_cherchee", "valeur a trouver."],
      ["plage", "plage dans laquelle chercher."],
      ["type", "0 pour une correspondance exacte."]
    ]
  },
  MAX: {
    example: "=MAX(B2:B20)",
    arguments: [["nombre1", "valeurs ou plages a comparer."]]
  },
  MEDIAN: {
    example: "=MEDIAN(B2:B20)",
    arguments: [["nombre1", "valeurs ou plages dont calculer la mediane."]]
  },
  MID: {
    example: "=MID(C2; 2; 4)",
    arguments: [
      ["texte", "texte a lire."],
      ["debut", "position du premier caractere a extraire."],
      ["nb_caracteres", "nombre de caracteres a extraire."]
    ]
  },
  MIN: {
    example: "=MIN(B2:B20)",
    arguments: [["nombre1", "valeurs ou plages a comparer."]]
  },
  NOT: {
    example: "=NOT(C2=\"OK\")",
    arguments: [["condition", "condition dont inverser le resultat."]]
  },
  NOW: {
    example: "=NOW()",
    arguments: [],
    notes: ["Ne prend aucun argument et se recalcule comme dans Excel."]
  },
  OR: {
    example: "=OR(B2>100; C2=\"OK\")",
    arguments: [
      ["condition1", "premiere condition a verifier."],
      ["condition2", "conditions supplementaires optionnelles."]
    ]
  },
  PRODUCT: {
    example: "=PRODUCT(B2:B5)",
    arguments: [["nombre1", "valeurs ou plages a multiplier."]]
  },
  RIGHT: {
    example: "=RIGHT(C2; 4)",
    arguments: [
      ["texte", "texte a lire."],
      ["nb_caracteres", "nombre de caracteres a extraire depuis la droite."]
    ]
  },
  ROUND: {
    example: "=ROUND(B2; 2)",
    arguments: [
      ["nombre", "nombre a arrondir."],
      ["nb_decimales", "nombre de decimales a conserver."]
    ]
  },
  ROUNDDOWN: {
    example: "=ROUNDDOWN(B2; 2)",
    arguments: [
      ["nombre", "nombre a arrondir vers le bas."],
      ["nb_decimales", "nombre de decimales a conserver."]
    ]
  },
  ROUNDUP: {
    example: "=ROUNDUP(B2; 2)",
    arguments: [
      ["nombre", "nombre a arrondir vers le haut."],
      ["nb_decimales", "nombre de decimales a conserver."]
    ]
  },
  SORT: {
    example: "=SORT(A2:F13; 6; -1)",
    arguments: [
      ["tableau", "plage a trier."],
      ["index_tri", "numero de colonne ou ligne utilise pour le tri."],
      ["ordre_tri", "1 pour croissant, -1 pour decroissant."]
    ],
    notes: ["Fonction dynamique: le resultat peut deborder sur plusieurs cellules et reste lie aux donnees source dans Excel."]
  },
  SUBTOTAL: {
    example: "=SUBTOTAL(109; B2:B20)",
    arguments: [
      ["no_fonction", "code du calcul, par exemple 109 pour SOMME."],
      ["ref1", "premiere plage a calculer."],
      ["ref2", "plages supplementaires optionnelles."]
    ]
  },
  SUM: {
    example: "=SUM(B2:B20)",
    arguments: [["nombre1", "valeurs ou plages a additionner."]]
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
    example: '=TEXT(TODAY(); "aaaa-mm-jj")',
    arguments: [
      ["valeur", "valeur a convertir en texte."],
      ["format", "format souhaite, par exemple \"0,00\", \"yyyy-mm-dd\" ou \"aaaa-mm-jj\"."]
    ],
    notes: ["Hydria accepte les formats anglais et francais. L'export XLSX adapte les masques de date pour Excel en francais."]
  },
  TODAY: {
    example: "=TODAY()",
    arguments: [],
    notes: ["Ne prend aucun argument et renvoie la date du jour."]
  },
  TRIM: {
    example: '=TRIM("  clean me  ")',
    arguments: [["texte", "texte dont supprimer les espaces inutiles."]]
  },
  UNIQUE: {
    example: "=UNIQUE(B2:B13)",
    arguments: [["tableau", "plage dont extraire les valeurs uniques."]],
    notes: ["Fonction dynamique: le resultat peut deborder sur plusieurs cellules. Dans Excel, la zone de sortie doit etre libre."]
  },
  UPPER: {
    example: "=UPPER(C2)",
    arguments: [["texte", "texte a convertir en majuscules."]]
  },
  VALUE: {
    example: '=VALUE("42")',
    arguments: [["texte", "texte a convertir en nombre."]]
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

