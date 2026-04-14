function asJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildPackageJson({ name, auth = false }) {
  return asJson({
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "node --watch src/server.js",
      start: "node src/server.js"
    },
    dependencies: auth
      ? {
          bcryptjs: "^2.4.3",
          cors: "^2.8.5",
          dotenv: "^16.4.5",
          express: "^4.19.2",
          helmet: "^7.1.0",
          jsonwebtoken: "^9.0.2",
          morgan: "^1.10.0"
        }
      : {
          cors: "^2.8.5",
          dotenv: "^16.4.5",
          express: "^4.19.2",
          helmet: "^7.1.0",
          morgan: "^1.10.0"
        }
  });
}

function buildReadme({ name, description, nextCommands = [], references = [] }) {
  return [
    `# ${name}`,
    "",
    description,
    "",
    references.length ? "## Reference repositories" : "",
    ...references.map((reference) =>
      `- \`${reference.fullName}\`${reference.description ? ` — ${reference.description}` : ""}`
    ),
    references.length ? "" : "",
    "## Next commands",
    ...nextCommands.map((command) => `- \`${command}\``)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEnvExample(auth = false) {
  return [
    "PORT=3000",
    auth ? "JWT_SECRET=change-me" : "",
    auth ? "JWT_EXPIRES_IN=1h" : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function authAppJs() {
  return [
    "import express from \"express\";",
    "import cors from \"cors\";",
    "import helmet from \"helmet\";",
    "import morgan from \"morgan\";",
    "import { authRouter } from \"./routes/auth.routes.js\";",
    "",
    "export function createApp() {",
    "  const app = express();",
    "  app.use(helmet());",
    "  app.use(cors());",
    "  app.use(express.json());",
    "  app.use(morgan(\"dev\"));",
    "",
    "  app.get(\"/health\", (_req, res) => {",
    "    res.json({ status: \"ok\" });",
    "  });",
    "",
    "  app.use(\"/api/auth\", authRouter);",
    "",
    "  app.use((error, _req, res, _next) => {",
    "    const statusCode = error.statusCode || 500;",
    "    res.status(statusCode).json({",
    "      success: false,",
    "      error: error.message || \"Unexpected error\"",
    "    });",
    "  });",
    "",
    "  return app;",
    "}",
    ""
  ].join("\n");
}

function authServerJs() {
  return [
    "import dotenv from \"dotenv\";",
    "import { createApp } from \"./app.js\";",
    "",
    "dotenv.config();",
    "",
    "const port = Number(process.env.PORT || 3000);",
    "const app = createApp();",
    "",
    "app.listen(port, () => {",
    "  console.log(`Auth API listening on http://localhost:${port}`);",
    "});",
    ""
  ].join("\n");
}

function authRoutesJs() {
  return [
    "import { Router } from \"express\";",
    "import { signupController, loginController, meController } from \"../controllers/auth.controller.js\";",
    "import { requireAuth } from \"../middlewares/auth.middleware.js\";",
    "",
    "export const authRouter = Router();",
    "",
    "authRouter.post(\"/signup\", signupController);",
    "authRouter.post(\"/login\", loginController);",
    "authRouter.get(\"/me\", requireAuth, meController);",
    ""
  ].join("\n");
}

function authControllerJs() {
  return [
    "import { createUser, loginUser, readUserFromToken } from \"../services/auth.service.js\";",
    "import { parseAuthPayload } from \"../validators/auth.schemas.js\";",
    "",
    "export async function signupController(req, res, next) {",
    "  try {",
    "    const payload = parseAuthPayload(req.body);",
    "    const result = await createUser(payload);",
    "    res.status(201).json({ success: true, ...result });",
    "  } catch (error) {",
    "    next(error);",
    "  }",
    "}",
    "",
    "export async function loginController(req, res, next) {",
    "  try {",
    "    const payload = parseAuthPayload(req.body);",
    "    const result = await loginUser(payload);",
    "    res.json({ success: true, ...result });",
    "  } catch (error) {",
    "    next(error);",
    "  }",
    "}",
    "",
    "export async function meController(req, res, next) {",
    "  try {",
    "    const user = await readUserFromToken(req.auth?.userId);",
    "    res.json({ success: true, user });",
    "  } catch (error) {",
    "    next(error);",
    "  }",
    "}",
    ""
  ].join("\n");
}

function authServiceJs() {
  return [
    "import bcrypt from \"bcryptjs\";",
    "import jwt from \"jsonwebtoken\";",
    "import { userRepository } from \"../repositories/user.repository.js\";",
    "",
    "function createError(message, statusCode) {",
    "  const error = new Error(message);",
    "  error.statusCode = statusCode;",
    "  return error;",
    "}",
    "",
    "function signToken(user) {",
    "  const secret = process.env.JWT_SECRET || \"change-me\";",
    "  const expiresIn = process.env.JWT_EXPIRES_IN || \"1h\";",
    "  return jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn });",
    "}",
    "",
    "export async function createUser({ email, password }) {",
    "  const existing = userRepository.findByEmail(email);",
    "  if (existing) {",
    "    throw createError(\"User already exists\", 409);",
    "  }",
    "",
    "  const passwordHash = await bcrypt.hash(password, 10);",
    "  const user = userRepository.create({ email, passwordHash });",
    "  return {",
    "    token: signToken(user),",
    "    user: { id: user.id, email: user.email }",
    "  };",
    "}",
    "",
    "export async function loginUser({ email, password }) {",
    "  const user = userRepository.findByEmail(email);",
    "  if (!user) {",
    "    throw createError(\"Invalid credentials\", 401);",
    "  }",
    "",
    "  const matches = await bcrypt.compare(password, user.passwordHash);",
    "  if (!matches) {",
    "    throw createError(\"Invalid credentials\", 401);",
    "  }",
    "",
    "  return {",
    "    token: signToken(user),",
    "    user: { id: user.id, email: user.email }",
    "  };",
    "}",
    "",
    "export async function readUserFromToken(userId) {",
    "  const user = userRepository.findById(userId);",
    "  if (!user) {",
    "    throw createError(\"User not found\", 404);",
    "  }",
    "",
    "  return { id: user.id, email: user.email };",
    "}",
    ""
  ].join("\n");
}

function authMiddlewareJs() {
  return [
    "import jwt from \"jsonwebtoken\";",
    "",
    "export function requireAuth(req, _res, next) {",
    "  try {",
    "    const authorization = req.headers.authorization || \"\";",
    "    const [, token] = authorization.split(\" \");",
    "    if (!token) {",
    "      const error = new Error(\"Missing bearer token\");",
    "      error.statusCode = 401;",
    "      throw error;",
    "    }",
    "",
    "    const secret = process.env.JWT_SECRET || \"change-me\";",
    "    req.auth = jwt.verify(token, secret);",
    "    next();",
    "  } catch (error) {",
    "    error.statusCode = error.statusCode || 401;",
    "    next(error);",
    "  }",
    "}",
    ""
  ].join("\n");
}

function authValidatorJs() {
  return [
    "function createValidationError(message) {",
    "  const error = new Error(message);",
    "  error.statusCode = 400;",
    "  return error;",
    "}",
    "",
    "export function parseAuthPayload(input = {}) {",
    "  const email = String(input.email || \"\").trim().toLowerCase();",
    "  const password = String(input.password || \"\");",
    "",
    "  if (!email.includes(\"@\")) {",
    "    throw createValidationError(\"A valid email is required\");",
    "  }",
    "",
    "  if (password.length < 8) {",
    "    throw createValidationError(\"Password must be at least 8 characters long\");",
    "  }",
    "",
    "  return { email, password };",
    "}",
    ""
  ].join("\n");
}

function authRepositoryJs() {
  return [
    "import { randomUUID } from \"node:crypto\";",
    "",
    "const users = [];",
    "",
    "export const userRepository = {",
    "  findByEmail(email) {",
    "    return users.find((user) => user.email === email) || null;",
    "  },",
    "  findById(id) {",
    "    return users.find((user) => user.id === id) || null;",
    "  },",
    "  create({ email, passwordHash }) {",
    "    const user = { id: randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };",
    "    users.push(user);",
    "    return user;",
    "  }",
    "};",
    ""
  ].join("\n");
}

function genericAppJs() {
  return [
    "import express from \"express\";",
    "import cors from \"cors\";",
    "import helmet from \"helmet\";",
    "import morgan from \"morgan\";",
    "import { apiRouter } from \"./routes/index.routes.js\";",
    "",
    "export function createApp() {",
    "  const app = express();",
    "  app.use(helmet());",
    "  app.use(cors());",
    "  app.use(express.json());",
    "  app.use(morgan(\"dev\"));",
    "  app.get(\"/health\", (_req, res) => res.json({ status: \"ok\" }));",
    "  app.use(\"/api\", apiRouter);",
    "  return app;",
    "}",
    ""
  ].join("\n");
}

function genericServerJs() {
  return [
    "import dotenv from \"dotenv\";",
    "import { createApp } from \"./app.js\";",
    "",
    "dotenv.config();",
    "",
    "const port = Number(process.env.PORT || 3000);",
    "createApp().listen(port, () => {",
    "  console.log(`Structured API listening on http://localhost:${port}`);",
    "});",
    ""
  ].join("\n");
}

function genericRoutesJs() {
  return [
    "import { Router } from \"express\";",
    "import { listModulesController } from \"../controllers/modules.controller.js\";",
    "",
    "export const apiRouter = Router();",
    "",
    "apiRouter.get(\"/modules\", listModulesController);",
    ""
  ].join("\n");
}

function genericControllerJs() {
  return [
    "import { listModules } from \"../services/modules.service.js\";",
    "",
    "export function listModulesController(_req, res) {",
    "  res.json({ success: true, items: listModules() });",
    "}",
    ""
  ].join("\n");
}

function genericServiceJs() {
  return [
    "export function listModules() {",
    "  return [",
    "    { id: \"health\", label: \"Health\" },",
    "    { id: \"core\", label: \"Core API\" },",
    "    { id: \"modules\", label: \"Feature modules\" }",
    "  ];",
    "}",
    ""
  ].join("\n");
}

function normalizePrompt(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleCaseWords(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanDomainPhrase(value = "") {
  return String(value || "")
    .replace(/[?!.,:;]+$/g, "")
    .replace(/\b(ready to launch|ready to run|pret a lancer|prete a lancer|pret a demarrer|prete a demarrer)\b/gi, "")
    .replace(/\b(with|avec|that|qui)\b.*$/i, "")
    .replace(/^(?:une?|des|le|la|les)\s+/i, "")
    .replace(/^(?:gestion|suivi|pilotage|organisation|outil|application|app|plateforme|platform|workspace)\s+(?:de|d'|pour)\s+/i, "")
    .replace(/^(?:for|pour)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAppDomainPhrase(prompt = "", fallback = "Hydria App") {
  const rawPrompt = String(prompt || "").trim();
  const patterns = [
    /(?:app|application)\s+(?:de|d'|for|pour)\s+(.+)$/i,
    /(?:create|build|generate|make|code|develop|craft|cree|creer|fais|construis|genere|ecris|developpe)\s+(?:moi\s+)?(?:une?\s+)?(?:app|application)\s+(?:de|d'|for|pour)\s+(.+)$/i,
    /(?:app|application)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = rawPrompt.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanDomainPhrase(match[1]);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return String(fallback || "Hydria App")
    .replace(/[-_]+/g, " ")
    .trim();
}

function inferAppArchetype(normalizedPrompt = "") {
  if (/\b(note|notes|journal|memo|wiki|knowledge|document|doc|writing|editor)\b/.test(normalizedPrompt)) {
    return "editor";
  }
  if (/\b(association|community|communaute|entraide|member|members|volunteer|benevole|help|aid)\b/.test(normalizedPrompt)) {
    return "community";
  }
  if (/\b(task|tasks|todo|kanban|planning|planner|roadmap|booking|reservation|calendar|schedule|trip|travel|itinerary)\b/.test(normalizedPrompt)) {
    return "planner";
  }
  if (/\b(shop|store|market|marketplace|ecommerce|commerce|delivery|catalog|menu|inventory|recipe|recipes|food|cuisine)\b/.test(normalizedPrompt)) {
    return "catalog";
  }
  if (/\b(music|artist|artists|event|events|media|community|social|creator|video|audio)\b/.test(normalizedPrompt)) {
    return "discovery";
  }
  if (/\b(dashboard|analytics|budget|finance|crm|sales|ops|operations|metrics|reporting)\b/.test(normalizedPrompt)) {
    return "operations";
  }
  if (/\b(workflow|automation|pipeline|agent|orchestration|process)\b/.test(normalizedPrompt)) {
    return "workflow";
  }
  return "workspace";
}

function inferEntityNoun(normalizedPrompt = "", domainPhrase = "") {
  if (/\b(note|notes|memo|journal)\b/.test(normalizedPrompt)) return "note";
  if (/\b(task|tasks|todo)\b/.test(normalizedPrompt)) return "task";
  if (/\b(booking|reservation|schedule|calendar)\b/.test(normalizedPrompt)) return "booking";
  if (/\b(recipe|recipes|meal|menu)\b/.test(normalizedPrompt)) return "recipe";
  if (/\b(artist|artists|event|events)\b/.test(normalizedPrompt)) return "artist";
  if (/\b(order|orders|delivery)\b/.test(normalizedPrompt)) return "order";
  if (/\b(budget|finance|expense|expenses|income|cash)\b/.test(normalizedPrompt)) return "transaction";
  if (/\b(association|entraide|community|member|members|volunteer|benevole)\b/.test(normalizedPrompt)) return "request";
  if (/\b(metric|metrics|kpi|analytics)\b/.test(normalizedPrompt)) return "metric";
  if (/\b(contact|crm|lead|leads)\b/.test(normalizedPrompt)) return "lead";
  if (/\b(workflow|automation|pipeline)\b/.test(normalizedPrompt)) return "step";
  if (/\b(document|docs|wiki|knowledge)\b/.test(normalizedPrompt)) return "document";

  const cleaned = cleanDomainPhrase(domainPhrase);
  const first = cleaned.split(/\s+/).find(Boolean) || "item";
  return first.toLowerCase();
}

function pluralizeLabel(value = "item") {
  const normalized = String(value || "item").trim().toLowerCase();
  if (normalized.endsWith("y") && !/[aeiou]y$/.test(normalized)) {
    return `${normalized.slice(0, -1)}ies`;
  }
  if (normalized.endsWith("s")) {
    return normalized;
  }
  return `${normalized}s`;
}

function buildGenericCards(domainTitle = "Hydria App", itemNoun = "item", prefix = "Core") {
  const itemPlural = pluralizeLabel(itemNoun);
  return [
    {
      title: `${titleCaseWords(itemNoun)} inbox`,
      meta: `${prefix} - Capture`,
      text: `Start with visible ${itemPlural} so the app feels useful immediately for ${domainTitle.toLowerCase()}.`
    },
    {
      title: `Recent ${itemPlural}`,
      meta: `${prefix} - Review`,
      text: `Keep the most relevant ${itemPlural} easy to reopen, refine and connect to the rest of the product.`
    },
    {
      title: `Next action`,
      meta: `${prefix} - Action`,
      text: `Turn ${domainTitle.toLowerCase()} into something operable with one clear next move on screen.`
    }
  ];
}

function buildGenericTable(domainTitle = "Hydria App", itemNoun = "item", archetype = "workspace") {
  const itemLabel = titleCaseWords(itemNoun);
  const rowsByArchetype = {
    editor: [
      ["Inbox", `Quick ${itemNoun} capture`, "12", "Review pinned content"],
      ["Library", `Organized ${pluralizeLabel(itemNoun)}`, "28", "Merge duplicates"],
      ["Archive", "Older material", "46", "Tag and clean"]
    ],
    planner: [
      ["Today", `${domainTitle} priorities`, "3", "Ship the first useful step"],
      ["This week", "Planned work", "6", "Keep the sequence realistic"],
      ["Later", "Backlog", "11", "Trim low-value items"]
    ],
    catalog: [
      ["Featured", `Best ${pluralizeLabel(itemNoun)}`, "8", "Refresh the top picks"],
      ["Library", "Main collection", "24", "Tighten categorization"],
      ["Operations", "Supporting tasks", "5", "Resolve supply or availability"]
    ],
    discovery: [
      ["Discover", `Top ${pluralizeLabel(itemNoun)}`, "9", "Improve the first impression"],
      ["Profiles", "Story and context", "14", "Add credibility signals"],
      ["Activation", "Next conversion move", "4", "Clarify the CTA"]
    ],
    operations: [
      ["North star", `${itemLabel} impact`, "1", "Track the main signal"],
      ["Drivers", "Key metrics", "6", "Focus on top movers"],
      ["Actions", "Current priorities", "5", "Turn insight into action"]
    ],
    workflow: [
      ["Trigger", `Start ${domainTitle.toLowerCase()}`, "1", "Define the clean entry point"],
      ["Core steps", "Main automation flow", "4", "Keep the flow readable"],
      ["Outputs", "Final handoff", "2", "Clarify the expected result"]
    ],
    community: [
      ["Requests", `Active ${pluralizeLabel(itemNoun)}`, "8", "Prioritize the urgent ones"],
      ["Members", "People who can help", "14", "Match supply and demand"],
      ["Coordination", "Upcoming handoffs", "5", "Keep the next response clear"]
    ],
    workspace: [
      ["Overview", `${domainTitle} scope`, "1", "Clarify the primary value"],
      ["Workspace", `Active ${pluralizeLabel(itemNoun)}`, "7", "Keep the main flow visible"],
      ["Actions", "Immediate moves", "3", "Ship the next useful interaction"]
    ]
  };

  return {
    headers: ["Area", "Focus", "Items", "Next move"],
    rows: rowsByArchetype[archetype] || rowsByArchetype.workspace
  };
}

function buildArchetypePages({ archetype = "workspace", domainTitle = "Hydria App", itemNoun = "item" } = {}) {
  const itemPlural = pluralizeLabel(itemNoun);

  if (archetype === "editor") {
    return [
      {
        id: "capture",
        label: "Capture",
        title: `Quick ${titleCaseWords(itemNoun)} capture`,
        intro: `Start with a fast way to capture ${itemPlural} instead of a blank shell.`,
        checklist: [
          `Capture a new ${itemNoun} in one step`,
          `Pin an important ${itemNoun} for later`,
          `Turn one ${itemNoun} into a follow-up action`
        ]
      },
      {
        id: "library",
        label: "Library",
        title: `Recent ${titleCaseWords(itemPlural)}`,
        intro: `Keep the most relevant ${itemPlural} visible and easy to revisit.`,
        cards: buildGenericCards(domainTitle, itemNoun, "Editor")
      },
      {
        id: "organize",
        label: "Organize",
        title: `${titleCaseWords(itemPlural)} and tags`,
        intro: `Switching view should expose a different organization surface for ${domainTitle.toLowerCase()}.`,
        table: buildGenericTable(domainTitle, itemNoun, "editor")
      }
    ];
  }

  if (archetype === "planner") {
    return [
      {
        id: "today",
        label: "Today",
        title: `${domainTitle} today`,
        intro: `Open with the current priorities so ${domainTitle.toLowerCase()} feels actionable immediately.`,
        checklist: [
          "Complete the most useful task first",
          "Keep the current plan readable",
          "Make the next handoff explicit"
        ]
      },
      {
        id: "board",
        label: "Board",
        title: `${titleCaseWords(itemPlural)} board`,
        intro: `Use a board-like view to keep the active ${itemPlural} visible at a glance.`,
        cards: buildGenericCards(domainTitle, itemNoun, "Planner")
      },
      {
        id: "timeline",
        label: "Timeline",
        title: `${domainTitle} timeline`,
        intro: "Switching view should reveal the execution sequence, not the same content again.",
        table: buildGenericTable(domainTitle, itemNoun, "planner")
      }
    ];
  }

  if (archetype === "catalog") {
    return [
      {
        id: "discover",
        label: "Discover",
        title: `${domainTitle} catalog`,
        intro: `Start with concrete ${itemPlural} instead of an empty generic shell.`,
        cards: buildGenericCards(domainTitle, itemNoun, "Catalog")
      },
      {
        id: "plan",
        label: "Plan",
        title: `${domainTitle} workspace`,
        intro: "A second view should show how the app helps the user decide or organize.",
        table: buildGenericTable(domainTitle, itemNoun, "catalog")
      },
      {
        id: "actions",
        label: "Actions",
        title: `${domainTitle} next actions`,
        intro: "Keep the app operational inside Hydria with a visible action list.",
        checklist: [
          `Add one stronger ${itemNoun}`,
          "Tighten the primary call to action",
          "Improve the supporting workflow"
        ]
      }
    ];
  }

  if (archetype === "discovery") {
    return [
      {
        id: "discover",
        label: "Discover",
        title: `${domainTitle} highlights`,
        intro: `Make discovery specific and alive from the first screen of ${domainTitle.toLowerCase()}.`,
        cards: buildGenericCards(domainTitle, itemNoun, "Discovery")
      },
      {
        id: "profiles",
        label: "Profiles",
        title: `${titleCaseWords(itemPlural)} story`,
        intro: "A second surface should add context, narrative and proof, not repeat the homepage.",
        cards: [
          {
            title: "Story angle",
            meta: "Narrative - Context",
            text: `Explain why this ${itemNoun} matters inside ${domainTitle.toLowerCase()}.`
          },
          {
            title: "Signal",
            meta: "Trust - Credibility",
            text: `Show one proof point that makes the ${itemNoun} feel real and worth following.`
          },
          {
            title: "Next move",
            meta: "Conversion - Action",
            text: "Guide the user toward the next action without friction."
          }
        ]
      },
      {
        id: "activation",
        label: "Activation",
        title: `${domainTitle} activation`,
        intro: "Make the conversion or engagement path explicit in its own view.",
        table: buildGenericTable(domainTitle, itemNoun, "discovery")
      }
    ];
  }

  if (archetype === "operations") {
    return [
      {
        id: "overview",
        label: "Overview",
        title: `${domainTitle} overview`,
        intro: "Open with the main signal and the biggest thing that needs attention.",
        cards: buildGenericCards(domainTitle, itemNoun, "Ops")
      },
      {
        id: "metrics",
        label: "Metrics",
        title: `${domainTitle} metrics`,
        intro: "Give numbers and operating signals a dedicated surface.",
        table: buildGenericTable(domainTitle, itemNoun, "operations")
      },
      {
        id: "actions",
        label: "Actions",
        title: `${domainTitle} action list`,
        intro: "Turn insight into visible actions directly in the app.",
        checklist: [
          "Refine the north-star metric",
          "Keep the main table trustworthy",
          "Clarify one action for this week"
        ]
      }
    ];
  }

  if (archetype === "workflow") {
    return [
      {
        id: "trigger",
        label: "Trigger",
        title: `${domainTitle} trigger`,
        intro: "Start with the entry point that makes the system move.",
        checklist: [
          "Define what starts the workflow",
          "Confirm the expected input",
          "Keep the trigger understandable"
        ]
      },
      {
        id: "steps",
        label: "Steps",
        title: `${domainTitle} steps`,
        intro: "A second view should expose the main sequence and its responsibilities.",
        cards: buildGenericCards(domainTitle, itemNoun, "Workflow")
      },
      {
        id: "outputs",
        label: "Outputs",
        title: `${domainTitle} outputs`,
        intro: "Show the handoff, the result and the next automation move clearly.",
        table: buildGenericTable(domainTitle, itemNoun, "workflow")
      }
    ];
  }

  if (archetype === "community") {
    return [
      {
        id: "requests",
        label: "Requests",
        title: `${domainTitle} requests`,
        intro: `Make the main ${itemPlural} visible first so ${domainTitle.toLowerCase()} feels useful immediately.`,
        cards: buildGenericCards(domainTitle, itemNoun, "Community")
      },
      {
        id: "members",
        label: "Members",
        title: `${domainTitle} members`,
        intro: "A second view should show who can act, help or respond next.",
        table: buildGenericTable(domainTitle, itemNoun, "community")
      },
      {
        id: "coordination",
        label: "Coordination",
        title: `${domainTitle} coordination`,
        intro: "Keep coordination actions visible so the app remains operable inside Hydria.",
        checklist: [
          "Prioritize the next request to resolve",
          "Assign one member or volunteer",
          "Confirm the next follow-up"
        ]
      }
    ];
  }

  return [
    {
      id: "overview",
      label: "Overview",
      title: `${domainTitle} overview`,
      intro: `Clarify the primary value of ${domainTitle.toLowerCase()} on the first screen.`,
      cards: buildGenericCards(domainTitle, itemNoun, "Core")
    },
    {
      id: "workspace",
      label: "Workspace",
      title: `${domainTitle} workspace`,
      intro: "A second view should show the working surface, not the same summary again.",
      table: buildGenericTable(domainTitle, itemNoun, "workspace")
    },
    {
      id: "actions",
      label: "Actions",
      title: `${domainTitle} next actions`,
      intro: "Keep one concrete interaction loop visible directly inside the app.",
      checklist: [
        "Refine the primary value",
        "Improve one interaction",
        "Add one stronger piece of domain content"
      ]
    }
  ];
}

function inferProductCapabilities(normalizedPrompt = "", archetype = "workspace") {
  const money = /\b(budget|finance|depense|depenses|expense|expenses|income|savings|cash|wallet|bank|salary|transaction)\b/.test(
    normalizedPrompt
  );
  const metrics =
    money ||
    /\b(dashboard|analytics|metric|metrics|kpi|reporting|tracking|track|monitor)\b/.test(
      normalizedPrompt
    );
  const categories =
    money ||
    /\b(categor|tag|organize|organise|folder|group|classif)\b/.test(normalizedPrompt);
  const planning =
    money ||
    /\b(month|monthly|week|weekly|calendar|plan|planning|forecast|timeline)\b/.test(
      normalizedPrompt
    );
  const capture =
    money ||
    archetype === "editor" ||
    /\b(add|create|capture|record|log|write|save|manage|gestion|suivi)\b/.test(
      normalizedPrompt
    );

  return {
    money,
    metrics,
    categories,
    planning,
    capture
  };
}

function buildCapabilityScenario({
  domainTitle = "Hydria App",
  itemNoun = "item",
  normalizedPrompt = "",
  archetype = "workspace",
  gitResearch = null
} = {}) {
  const capabilities = inferProductCapabilities(normalizedPrompt, archetype);
  const normalizedGit = normalizeGitResearch(gitResearch);
  const itemPlural = pluralizeLabel(itemNoun);
  const titleLower = domainTitle.toLowerCase();
  const entryLabel = capabilities.money ? "transaction" : itemNoun;
  const entryPlural = capabilities.money ? "transactions" : itemPlural;
  const entryTitle = titleCaseWords(entryLabel);
  const pages = [];

  if (capabilities.metrics) {
    pages.push({
      id: "dashboard",
      label: "Dashboard",
      title: `${domainTitle} dashboard`,
      intro: capabilities.money
        ? `See what remains, what is spent, and which category needs attention in ${titleLower}.`
        : `Open with the main signals and current state of ${titleLower}.`,
      stats: capabilities.money
        ? [
            { label: "To spend", value: "EUR 1,240", note: "left this month", tone: "positive" },
            { label: "Spent", value: "EUR 1,560", note: "current outflow", tone: "neutral" },
            { label: "Savings", value: "EUR 420", note: "protected already", tone: "positive" },
            { label: "Alerts", value: "2", note: "categories over 80%", tone: "warning" }
          ]
        : [
            { label: "Active", value: "24", note: `${entryPlural} in progress`, tone: "positive" },
            { label: "Recent", value: "8", note: `updated this week`, tone: "neutral" },
            { label: "Backlog", value: "11", note: `waiting to be reviewed`, tone: "warning" },
            { label: "Focus", value: "3", note: "priority moves right now", tone: "neutral" }
          ],
      budgetBuckets: capabilities.categories
        ? capabilities.money
          ? [
              { label: "Housing", spent: 820, limit: 900, tone: "neutral" },
              { label: "Food", spent: 310, limit: 420, tone: "positive" },
              { label: "Transport", spent: 140, limit: 180, tone: "warning" },
              { label: "Fun", spent: 190, limit: 160, tone: "danger" }
            ]
          : [
              { label: "Core", spent: 64, limit: 100, tone: "positive" },
              { label: "Review", spent: 81, limit: 100, tone: "warning" },
              { label: "Automation", spent: 42, limit: 100, tone: "neutral" }
            ]
        : [],
      cards: capabilities.money
        ? [
            {
              meta: "Insight",
              title: "Subscriptions deserve review",
              text: "Recurring expenses are the fastest lever to recover margin without changing the whole month."
            },
            {
              meta: "Focus",
              title: "Discretionary spend is drifting",
              text: "Food is stable, but leisure and impulse purchases are driving most of the overspend."
            },
            {
              meta: "Next move",
              title: "Rebalance before next week",
              text: "Move headroom from low-usage categories and keep one hard limit for flexible spending."
            }
          ]
        : buildGenericCards(domainTitle, itemNoun, "Signal")
    });
  }

  if (capabilities.capture) {
    pages.push({
      id: capabilities.money ? "transactions" : "workspace",
      label: capabilities.money ? "Transactions" : "Workspace",
      title: capabilities.money ? `${domainTitle} transactions` : `${domainTitle} workspace`,
      intro: capabilities.money
        ? `Capture ${entryPlural} quickly, keep recent movements visible and spot anomalies immediately.`
        : `Keep the main ${entryPlural} visible and editable without losing the flow.`,
      quickEntry: {
        title: capabilities.money ? "Quick transaction" : `Quick ${entryLabel}`,
        fields: capabilities.money
          ? [
              { key: "label", label: "Label", placeholder: "Groceries" },
              { key: "amount", label: "Amount", placeholder: "42" },
              { key: "category", label: "Category", placeholder: "Food" }
            ]
          : [
              { key: "label", label: "Label", placeholder: `New ${entryLabel}` },
              { key: "amount", label: "Priority", placeholder: "High" },
              { key: "category", label: "Group", placeholder: "Core" }
            ],
        submitLabel: capabilities.money ? "Add transaction" : `Add ${entryLabel}`
      },
      transactions: capabilities.money
        ? [
            { label: "Groceries", category: "Food", amount: "- EUR 42", when: "Today" },
            { label: "Salary", category: "Income", amount: "+ EUR 2,450", when: "1 Apr" },
            { label: "Gym", category: "Health", amount: "- EUR 29", when: "2 Apr" },
            { label: "Coffee with team", category: "Fun", amount: "- EUR 18", when: "3 Apr" }
          ]
        : [
            { label: `First ${entryTitle}`, category: "Core", amount: "Active", when: "Today" },
            { label: `Reviewed ${entryLabel}`, category: "Review", amount: "Updated", when: "Yesterday" },
            { label: `Scheduled ${entryLabel}`, category: "Next", amount: "Planned", when: "This week" }
          ],
      table: {
        headers: capabilities.money
          ? ["Date", "Label", "Category", "Amount"]
          : ["When", "Label", "Group", "Status"],
        rows: capabilities.money
          ? [
              ["09 Apr", "Groceries", "Food", "- EUR 42"],
              ["08 Apr", "Fuel", "Transport", "- EUR 58"],
              ["06 Apr", "Rent", "Housing", "- EUR 820"],
              ["05 Apr", "Salary", "Income", "+ EUR 2,450"]
            ]
          : [
              ["Today", `New ${entryLabel}`, "Core", "Active"],
              ["Today", `Review ${entryLabel}`, "Review", "Pending"],
              ["This week", `Plan ${entryLabel}`, "Next", "Scheduled"]
            ]
      }
    });
  }

  if (capabilities.categories) {
    pages.push({
      id: "categories",
      label: "Categories",
      title: `${domainTitle} categories`,
      intro: capabilities.money
        ? "Group spending by category, see remaining room and rebalance before the month gets away from you."
        : `Organize ${entryPlural} into groups so the app stays usable as it grows.`,
      budgetBuckets: capabilities.money
        ? [
            { label: "Housing", spent: 820, limit: 900, tone: "neutral" },
            { label: "Food", spent: 310, limit: 420, tone: "positive" },
            { label: "Transport", spent: 140, limit: 180, tone: "warning" },
            { label: "Health", spent: 95, limit: 150, tone: "positive" },
            { label: "Fun", spent: 190, limit: 160, tone: "danger" }
          ]
        : [
            { label: "Core", spent: 72, limit: 100, tone: "positive" },
            { label: "Review", spent: 54, limit: 100, tone: "neutral" },
            { label: "Backlog", spent: 34, limit: 100, tone: "warning" }
          ],
      tags: capabilities.money
        ? ["Housing", "Food", "Transport", "Health", "Savings", "Fun", "Bills"]
        : ["Core", "Review", "Backlog", "Team", "Priority", "Ideas"],
      checklist: capabilities.money
        ? [
            "Increase the emergency buffer rule",
            "Cap discretionary spend earlier in the cycle",
            "Review subscriptions before next month"
          ]
        : [
            `Merge duplicate ${entryPlural}`,
            `Promote one ${entryLabel} to the focus group`,
            "Reduce clutter before the next review"
          ]
    });
  }

  if (capabilities.planning) {
    pages.push({
      id: "plan",
      label: capabilities.money ? "Month" : "Plan",
      title: capabilities.money ? `${domainTitle} monthly plan` : `${domainTitle} execution plan`,
      intro: capabilities.money
        ? "Keep the month readable with one plan, one target and one simple review ritual."
        : `Keep ${titleLower} readable over time with one plan and one clear review loop.`,
      stats: capabilities.money
        ? [
            { label: "Income", value: "EUR 2,450", note: "expected this month", tone: "positive" },
            { label: "Fixed costs", value: "EUR 1,165", note: "rent, bills, gym", tone: "neutral" },
            { label: "Flexible budget", value: "EUR 735", note: "food, transport, fun", tone: "warning" }
          ]
        : [
            { label: "This week", value: "3", note: "must-finish moves", tone: "positive" },
            { label: "Next review", value: "Friday", note: "close the current loop", tone: "neutral" },
            { label: "Blocked", value: "1", note: "needs decision", tone: "warning" }
          ],
      table: {
        headers: capabilities.money
          ? ["Week", "Focus", "Guardrail", "Review"]
          : ["Phase", "Focus", "Guardrail", "Review"],
        rows: capabilities.money
          ? [
              ["Week 1", "Pay fixed costs", "Do not touch savings", "Check recurring payments"],
              ["Week 2", "Groceries and transport", "Stay under planned envelope", "Adjust category caps"],
              ["Week 3", "Leisure control", "Hold discretionary spend", "Remove low-value purchases"],
              ["Week 4", "Close the month", "Keep a cash buffer", "Prepare next month"]
            ]
          : [
              ["Start", `Clarify the main ${entryLabel}`, "Do not expand scope too early", "Check the first value loop"],
              ["Middle", `Organize active ${entryPlural}`, "Keep the surface simple", "Review the top friction"],
              ["Review", "Tighten the next action", "Remove dead weight", "Prepare the next iteration"]
            ]
      }
    });
  }

  if (pages.length < 3) {
    const fallbackPages = buildArchetypePages({ archetype, domainTitle, itemNoun });
    for (const page of fallbackPages) {
      if (!pages.some((existing) => existing.id === page.id)) {
        pages.push(page);
      }
    }
  }

  const gitResearchPage = buildGitResearchPage({
    domainTitle,
    itemPlural: entryPlural,
    gitResearch
  });

  return {
    title: domainTitle,
    eyebrow: capabilities.money ? "Personal finance app" : "App prototype",
    subtitle: capabilities.money
      ? `Pilot ${titleLower} with a real dashboard, capture flow, category limits and planning loop inside Hydria.`
      : `A live multi-view app for ${titleLower}, generated from your prompt and ready to be refined inside Hydria.`,
    accentTitle: capabilities.money
      ? `This ${titleLower} app should help the user understand, decide and adjust in real time.`
      : "The output should feel like a real app with several useful views, not like a blank demo shell.",
    references: normalizedGit,
    pages: gitResearchPage ? [...pages, gitResearchPage] : pages
  };
}

function normalizeGitResearch(gitResearch = null) {
  const humanizePatternLabel = (pattern = {}) => {
    const raw =
      pattern.label ||
      pattern.name ||
      pattern.patternName ||
      pattern.pattern_name ||
      pattern.category ||
      "";
    return String(raw || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const repositories = (gitResearch?.normalized?.repositories || []).slice(0, 4).map((repo) => ({
    fullName: repo.fullName || "",
    description: repo.description || "",
    language: repo.language || "",
    stars: Number(repo.stars || 0)
  }));
  const patterns = (gitResearch?.normalized?.patterns || []).slice(0, 6).map((pattern) => ({
    label: humanizePatternLabel(pattern),
    note:
      pattern.summary ||
      pattern.description ||
      pattern.reusable_for ||
      pattern.example ||
      ""
  }));

  return {
    repositories: repositories.filter((repo) => repo.fullName),
    patterns: patterns.filter((pattern) => pattern.label)
  };
}

function buildGitResearchPage({ domainTitle = "Hydria App", itemPlural = "items", gitResearch = null } = {}) {
  const normalized = normalizeGitResearch(gitResearch);
  if (!normalized.repositories.length && !normalized.patterns.length) {
    return null;
  }

  return {
    id: "patterns",
    label: "Patterns",
    title: `${domainTitle} reference patterns`,
    intro: `Hydria used real repositories and implementation patterns to avoid generating a blank ${domainTitle.toLowerCase()} shell.`,
    cards: [
      ...normalized.repositories.map((repo) => ({
        meta: repo.language || "Repository",
        title: repo.fullName,
        text: repo.description || `Reference repository with ${repo.stars} stars.`
      })),
      ...normalized.patterns.slice(0, Math.max(0, 4 - normalized.repositories.length)).map((pattern) => ({
        meta: "Pattern",
        title: pattern.label,
        text: pattern.note || `A reusable pattern Hydria can adapt for ${itemPlural}.`
      }))
    ],
    checklist: normalized.patterns
      .slice(0, 3)
      .map((pattern) => `Adapt ${pattern.label} to the ${domainTitle.toLowerCase()} flow`)
  };
}

function inferStaticAppScenario({ projectName = "Hydria App", prompt = "", gitResearch = null } = {}) {
  const normalized = normalizePrompt(prompt);
  const displayName = String(projectName || "Hydria App").replace(/[-_]+/g, " ").trim();
  const domainPhrase = extractAppDomainPhrase(prompt, displayName || "Hydria App");
  const domainTitle = titleCaseWords(domainPhrase || displayName || "Hydria App");
  const archetype = inferAppArchetype(normalized);
  const itemNoun = inferEntityNoun(normalized, domainPhrase);
  const capabilityScenario = buildCapabilityScenario({
    domainTitle: domainTitle || displayName || "Hydria App",
    itemNoun,
    normalizedPrompt: normalized,
    archetype,
    gitResearch
  });
  if (capabilityScenario) {
    return capabilityScenario;
  }
  const itemPlural = pluralizeLabel(itemNoun);
  const eyebrowByArchetype = {
    editor: "Editor app",
    planner: "Planning app",
    catalog: "Catalog app",
    discovery: "Discovery app",
    operations: "Operations app",
    workflow: "Workflow app",
    community: "Community app",
    workspace: "App prototype"
  };
  const subtitleByArchetype = {
    editor: `Capture ${itemPlural} fast, reopen them easily and keep ${domainTitle.toLowerCase()} organized in one living workspace.`,
    planner: `Plan ${domainTitle.toLowerCase()} with a clear board, a timeline and next actions you can keep refining inside Hydria.`,
    catalog: `Browse ${itemPlural}, organize decisions and keep the next action visible in one usable product shell.`,
    discovery: `Surface the best ${itemPlural}, add context and guide the user toward a concrete next action.`,
    operations: `Track the main signals of ${domainTitle.toLowerCase()} and keep the operating loop visible inside the app.`,
    workflow: `Make ${domainTitle.toLowerCase()} readable as a trigger, a sequence and a visible output loop.`,
    community: `Coordinate ${itemPlural}, members and next actions in one living workspace for ${domainTitle.toLowerCase()}.`,
    workspace: `A live multi-view app for ${domainTitle.toLowerCase()}, generated from your prompt and ready to be refined inside Hydria.`
  };
  const accentByArchetype = {
    editor: `This ${domainTitle.toLowerCase()} app should help the user capture, review and organize without friction.`,
    planner: `This ${domainTitle.toLowerCase()} app should make planning and follow-through obvious at a glance.`,
    catalog: `This ${domainTitle.toLowerCase()} app should feel useful immediately, not like an empty showcase.`,
    discovery: `This ${domainTitle.toLowerCase()} app should reveal what matters and why the user should care.`,
    operations: `This ${domainTitle.toLowerCase()} app should feel operable, not decorative.`,
    workflow: `This ${domainTitle.toLowerCase()} app should make the process understandable and actionable.`,
    community: `This ${domainTitle.toLowerCase()} app should connect needs, people and coordination without confusion.`,
    workspace: "The output should feel like a real app with several useful views, not like a blank demo shell."
  };
  const basePages = buildArchetypePages({
    archetype,
    domainTitle: domainTitle || displayName || "Hydria App",
    itemNoun
  });
  const gitResearchPage = buildGitResearchPage({
    domainTitle: domainTitle || displayName || "Hydria App",
    itemPlural,
    gitResearch
  });

  return {
    title: domainTitle || displayName || "Hydria App",
    eyebrow: eyebrowByArchetype[archetype] || "App prototype",
    subtitle: subtitleByArchetype[archetype] || subtitleByArchetype.workspace,
    accentTitle: accentByArchetype[archetype] || accentByArchetype.workspace,
    references: normalizeGitResearch(gitResearch),
    pages: gitResearchPage ? [...basePages, gitResearchPage] : basePages
  };
}

function staticAppConfig({ name, prompt = "", gitResearch = null, generatedAppScenario = null }) {
  const scenario =
    generatedAppScenario && typeof generatedAppScenario === "object"
      ? generatedAppScenario
      : inferStaticAppScenario({
          projectName: name,
          prompt,
          gitResearch
        });

  return JSON.stringify(
    {
      ...scenario,
      prompt,
      version: "2.0"
    },
    null,
    2
  );
}

function staticAppHtml({ name, prompt = "" }) {
  return [
    "<!DOCTYPE html>",
    "<html lang=\"fr\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    `    <title>${name}</title>`,
    "    <link rel=\"stylesheet\" href=\"./styles.css\" />",
    "  </head>",
    "  <body>",
    "    <main class=\"app-shell\">",
    "      <header class=\"hero\" id=\"app-hero\"></header>",
    "      <section class=\"panel accent hero-panel\" id=\"app-accent\"></section>",
    "      <nav class=\"app-nav\" id=\"app-nav\" aria-label=\"Application pages\"></nav>",
    "      <section class=\"page-stack\" id=\"page-stack\"></section>",
    "    </main>",
    "    <script type=\"module\" src=\"./app.js\"></script>",
    "  </body>",
    "</html>",
    ""
  ].join("\n");
}

function staticAppCss() {
  return [
    ":root {",
    "  color-scheme: light;",
    "  --bg: #f4efe6;",
    "  --panel: #fffdf8;",
    "  --ink: #182126;",
    "  --muted: #6d777d;",
    "  --accent: #e28f38;",
    "  --accent-soft: #fff0df;",
    "  --line: rgba(24, 33, 38, 0.12);",
    "}",
    "* { box-sizing: border-box; }",
    "body {",
    "  margin: 0;",
    "  min-height: 100vh;",
    "  font-family: 'Space Grotesk', 'Segoe UI', sans-serif;",
    "  color: var(--ink);",
    "  background: radial-gradient(circle at top left, rgba(226,143,56,0.18), transparent 35%), var(--bg);",
    "}",
    ".app-shell { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }",
    ".hero { margin-bottom: 18px; }",
    ".eyebrow { text-transform: uppercase; letter-spacing: .12em; color: var(--muted); font-size: .76rem; }",
    ".subtitle { max-width: 780px; color: var(--muted); line-height: 1.6; }",
    ".panel { background: var(--panel); border: 1px solid var(--line); border-radius: 22px; padding: 18px; box-shadow: 0 20px 50px rgba(24,33,38,0.08); }",
    ".accent { background: linear-gradient(180deg, var(--accent-soft), #fffdf8); }",
    ".hero-panel { margin-bottom: 16px; }",
    ".app-nav { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }",
    ".nav-pill { padding: .72rem 1rem; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,.65); color: var(--ink); }",
    ".nav-pill.active { background: var(--accent); color: white; border-color: var(--accent); }",
    ".page-stack { display: grid; gap: 16px; }",
    ".app-page { display: none; gap: 16px; }",
    ".app-page.active { display: grid; }",
    ".page-header p { color: var(--muted); max-width: 720px; }",
    ".stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }",
    ".stat-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 16px; }",
    ".stat-card strong { display: block; font-size: 1.4rem; margin-top: 8px; }",
    ".stat-card[data-tone='positive'] { border-color: rgba(55, 161, 105, 0.24); background: rgba(232, 251, 241, 0.78); }",
    ".stat-card[data-tone='warning'] { border-color: rgba(226, 143, 56, 0.28); background: rgba(255, 244, 230, 0.86); }",
    ".stat-card[data-tone='danger'] { border-color: rgba(198, 76, 76, 0.22); background: rgba(255, 239, 239, 0.85); }",
    ".card-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }",
    ".content-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 16px; }",
    ".content-card h3 { margin: 8px 0 10px; }",
    ".card-meta { color: var(--muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; }",
    ".budget-grid { display: grid; gap: 12px; }",
    ".budget-row { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 14px 16px; }",
    ".budget-row-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; }",
    ".budget-row-meta { color: var(--muted); font-size: .84rem; }",
    ".budget-bar { position: relative; height: 10px; border-radius: 999px; background: rgba(24,33,38,0.08); overflow: hidden; }",
    ".budget-bar > span { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: linear-gradient(90deg, #e28f38, #f2b15d); }",
    ".budget-row[data-tone='positive'] .budget-bar > span { background: linear-gradient(90deg, #2d9b6f, #53c58c); }",
    ".budget-row[data-tone='danger'] .budget-bar > span { background: linear-gradient(90deg, #d05858, #f07c7c); }",
    ".transaction-feed { display: grid; gap: 12px; }",
    ".transaction-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 14px 16px; }",
    ".transaction-item strong { display: block; }",
    ".transaction-meta { color: var(--muted); font-size: .84rem; }",
    ".transaction-amount { font-weight: 700; }",
    ".transaction-amount.income { color: #2d9b6f; }",
    ".transaction-amount.expense { color: #be5d3f; }",
    ".tag-cloud { display: flex; flex-wrap: wrap; gap: 10px; }",
    ".tag-chip { display: inline-flex; align-items: center; padding: .6rem .9rem; border-radius: 999px; background: rgba(255,255,255,.74); border: 1px solid var(--line); font-size: .86rem; }",
    ".table-wrap { overflow: auto; }",
    ".planner-table { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: 18px; overflow: hidden; }",
    ".planner-table th, .planner-table td { padding: .9rem 1rem; border-bottom: 1px solid var(--line); text-align: left; }",
    ".planner-table th { color: var(--muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; }",
    ".interactive-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 16px; }",
    ".interactive-panel h3 { margin: 0 0 12px; }",
    ".inline-row { display: flex; gap: 10px; margin-top: 10px; }",
    "input { width: 100%; padding: .85rem .95rem; border-radius: 14px; border: 1px solid var(--line); }",
    "button { padding: .85rem 1.1rem; border-radius: 999px; border: 0; background: var(--accent); color: white; font-weight: 700; cursor: pointer; }",
    ".checklist { margin: 14px 0 0; padding-left: 1.2rem; }",
    ".checklist li { margin-bottom: .55rem; }",
    ".tiny { color: var(--muted); font-size: .84rem; line-height: 1.5; }",
    "@media (max-width: 860px) { .stats-grid { grid-template-columns: 1fr 1fr; } .card-grid { grid-template-columns: 1fr; } .inline-row { flex-direction: column; } }",
    "@media (max-width: 620px) { .stats-grid { grid-template-columns: 1fr; } .transaction-item { grid-template-columns: 1fr; } }",
    ""
  ].join("\n");
}

function staticAppJs() {
  const fallbackScenario = inferStaticAppScenario({
    projectName: "Hydria App"
  });

  return [
    `const fallbackScenario = ${JSON.stringify(fallbackScenario, null, 2)};`,
    "const hero = document.getElementById('app-hero');",
    "const accent = document.getElementById('app-accent');",
    "const nav = document.getElementById('app-nav');",
    "const pageStack = document.getElementById('page-stack');",
    "let scenario = fallbackScenario;",
    "",
    "function escapeHtml(value = '') {",
    "  return String(value || '')",
    "    .replace(/&/g, '&amp;')",
    "    .replace(/</g, '&lt;')",
    "    .replace(/>/g, '&gt;')",
    "    .replace(/\\\"/g, '&quot;')",
    "    .replace(/'/g, '&#39;');",
    "}",
    "",
    "function renderPageContent(page = {}) {",
    "  const parts = [",
    "    `<section class=\"app-page\" data-view=\"${escapeHtml(page.id || '')}\">`,",
    "    '  <div class=\"page-header\">',",
    "    `    <h2>${escapeHtml(page.title || '')}</h2>`,",
    "    `    <p>${escapeHtml(page.intro || '')}</p>`,",
    "    '  </div>'",
    "  ];",
    "  if (Array.isArray(page.stats) && page.stats.length) {",
    "    parts.push('<div class=\"stats-grid\">');",
    "    page.stats.forEach((stat) => {",
    "      parts.push([",
    "        `<article class=\"stat-card\" data-tone=\"${escapeHtml(stat.tone || 'neutral')}\">`,",
    "        `  <span class=\"card-meta\">${escapeHtml(stat.label || '')}</span>`,",
    "        `  <strong>${escapeHtml(stat.value || '')}</strong>`,",
    "        `  <p class=\"tiny\">${escapeHtml(stat.note || '')}</p>`,",
    "        '</article>'",
    "      ].join(''));",
    "    });",
    "    parts.push('</div>');",
    "  }",
    "  if (Array.isArray(page.budgetBuckets) && page.budgetBuckets.length) {",
    "    parts.push('<section class=\"budget-grid\">');",
    "    page.budgetBuckets.forEach((bucket) => {",
    "      const spent = Number(bucket.spent || 0);",
    "      const limit = Number(bucket.limit || 0);",
    "      const ratio = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;",
    "      const left = limit - spent;",
    "      parts.push([",
    "        `<article class=\"budget-row\" data-tone=\"${escapeHtml(bucket.tone || 'neutral')}\">`,",
    "        '  <div class=\"budget-row-header\">',",
    "        `    <strong>${escapeHtml(bucket.label || '')}</strong>`,",
    "        `    <span class=\"budget-row-meta\">${escapeHtml(`€${spent} / €${limit}`)}</span>`,",
    "        '  </div>',",
    "        `  <div class=\"budget-bar\"><span style=\"width:${ratio}%\"></span></div>`,",
    "        `  <p class=\"tiny\">${left >= 0 ? `${escapeHtml(`€${left}`)} left` : `${escapeHtml(`€${Math.abs(left)}`)} over budget`}</p>`,",
    "        '</article>'",
    "      ].join(''));",
    "    });",
    "    parts.push('</section>');",
    "  }",
    "  if (Array.isArray(page.cards) && page.cards.length) {",
    "    parts.push('<div class=\"card-grid\">');",
    "    page.cards.forEach((card) => {",
    "      parts.push([",
    "        '<article class=\"content-card\">',",
    "        `  <span class=\"card-meta\">${escapeHtml(card.meta || '')}</span>`,",
    "        `  <h3>${escapeHtml(card.title || '')}</h3>`,",
    "        `  <p>${escapeHtml(card.text || '')}</p>`,",
    "        '</article>'",
    "      ].join(''));",
    "    });",
    "    parts.push('</div>');",
    "  }",
    "  if (Array.isArray(page.transactions) && page.transactions.length) {",
    "    parts.push(`<section class=\"transaction-feed\" data-transaction-feed=\"${escapeHtml(page.id || '')}\">`);",
    "    page.transactions.forEach((transaction) => {",
    "      const amount = String(transaction.amount || '');",
    "      const tone = amount.trim().startsWith('+') ? 'income' : 'expense';",
    "      parts.push([",
    "        '<article class=\"transaction-item\">',",
    "        '  <div>',",
    "        `    <strong>${escapeHtml(transaction.label || '')}</strong>`,",
    "        `    <div class=\"transaction-meta\">${escapeHtml(transaction.category || '')} • ${escapeHtml(transaction.when || '')}</div>`,",
    "        '  </div>',",
    "        `  <div class=\"transaction-amount ${tone}\">${escapeHtml(amount)}</div>`,",
    "        '</article>'",
    "      ].join(''));",
    "    });",
    "    parts.push('</section>');",
    "  }",
    "  if (page.table?.headers?.length) {",
    "    parts.push('<div class=\"table-wrap\"><table class=\"planner-table\"><thead><tr>');",
    "    parts.push(page.table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join(''));",
    "    parts.push('</tr></thead><tbody>');",
    "    (page.table.rows || []).forEach((row) => {",
    "      parts.push('<tr>');",
    "      parts.push((row || []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join(''));",
    "      parts.push('</tr>');",
    "    });",
    "    parts.push('</tbody></table></div>');",
    "  }",
    "  if (Array.isArray(page.tags) && page.tags.length) {",
    "    parts.push('<div class=\"tag-cloud\">');",
    "    page.tags.forEach((tag) => {",
    "      parts.push(`<span class=\"tag-chip\">${escapeHtml(tag)}</span>`);",
    "    });",
    "    parts.push('</div>');",
    "  }",
    "  if (page.quickEntry?.fields?.length) {",
    "    parts.push([",
    "      `<section class=\"interactive-panel\" data-entry-form=\"${escapeHtml(page.id || '')}\">`,",
    "      `  <h3>${escapeHtml(page.quickEntry.title || 'Quick entry')}</h3>`,",
    "      '  <div class=\"inline-row\">',",
    "      ...page.quickEntry.fields.map((field) => `    <input data-entry-field=\"${escapeHtml(page.id || '')}:${escapeHtml(field.key || '')}\" type=\"text\" placeholder=\"${escapeHtml(field.placeholder || field.label || '')}\" aria-label=\"${escapeHtml(field.label || field.key || '')}\" />`),",
    "      `    <button data-entry-submit=\"${escapeHtml(page.id || '')}\" type=\"button\">${escapeHtml(page.quickEntry.submitLabel || 'Add')}</button>`,",
    "      '  </div>',",
    "      '</section>'",
    "    ].join('\\n'));",
    "  }",
    "  if (Array.isArray(page.checklist) && page.checklist.length) {",
    "    parts.push([",
    "      '<div class=\"interactive-panel\">',",
    "      '  <div class=\"inline-row\">',",
    "      `    <input data-list-input=\"${escapeHtml(page.id || '')}\" type=\"text\" placeholder=\"Add a new item\" />`,",
    "      `    <button data-list-add=\"${escapeHtml(page.id || '')}\" type=\"button\">Add</button>`,",
    "      '  </div>',",
    "      `  <ul data-list-target=\"${escapeHtml(page.id || '')}\" class=\"checklist\">`,",
    "      ...(page.checklist || []).map((item) => `    <li>${escapeHtml(item)}</li>`),",
    "      '  </ul>',",
    "      '</div>'",
    "    ].join('\\n'));",
    "  }",
    "  parts.push('</section>');",
    "  return parts.join('\\n');",
    "}",
    "",
    "function renderScenario() {",
    "  if (hero) {",
    "    hero.innerHTML = [",
    "      `<p class=\"eyebrow\">${escapeHtml(scenario.eyebrow || 'App')}</p>`,",
    "      `<h1>${escapeHtml(scenario.title || 'Hydria App')}</h1>`,",
    "      `<p class=\"subtitle\">${escapeHtml(scenario.subtitle || '')}</p>`",
    "    ].join('');",
    "  }",
    "  if (accent) {",
    "    accent.innerHTML = [",
    "      `<strong>${escapeHtml(scenario.accentTitle || 'Use this app directly inside Hydria.')}</strong>`,",
    "      '<p>Move between views, adjust the content and keep shaping the app instead of staring at a blank shell.</p>'",
    "    ].join('');",
    "  }",
    "  if (nav) {",
    "    nav.innerHTML = (scenario.pages || []).map((page, index) =>",
    "      `<button class=\"nav-pill${index === 0 ? ' active' : ''}\" type=\"button\" data-view-target=\"${escapeHtml(page.id || '')}\">${escapeHtml(page.label || page.title || `View ${index + 1}`)}</button>`",
    "    ).join('');",
    "  }",
    "  if (pageStack) {",
    "    pageStack.innerHTML = (scenario.pages || []).map((page) => renderPageContent(page)).join('\\n');",
    "  }",
    "}",
    "",
    "function activateView(viewId) {",
    "  const pages = Array.from(document.querySelectorAll('.app-page'));",
    "  const navButtons = Array.from(document.querySelectorAll('[data-view-target]'));",
    "  const nextView = viewId || pages[0]?.dataset.view || '';",
    "  navButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === nextView));",
    "  pages.forEach((page) => page.classList.toggle('active', page.dataset.view === nextView));",
    "  if (nextView && location.hash.slice(1) !== nextView) {",
    "    history.replaceState(null, '', `#${nextView}`);",
    "  }",
    "}",
    "",
    "document.addEventListener('click', (event) => {",
    "  const navButton = event.target.closest('[data-view-target]');",
    "  if (navButton) {",
    "    activateView(navButton.dataset.viewTarget);",
    "    return;",
    "  }",
    "  const addButton = event.target.closest('[data-list-add]');",
    "  if (addButton) {",
    "    const pageId = addButton.dataset.listAdd || '';",
    "    const input = document.querySelector(`[data-list-input=\"${pageId}\"]`);",
    "    const list = document.querySelector(`[data-list-target=\"${pageId}\"]`);",
    "    const value = String(input?.value || '').trim();",
    "    if (!value || !list) return;",
    "    const item = document.createElement('li');",
    "    item.textContent = value;",
    "    list.appendChild(item);",
    "    input.value = '';",
    "    return;",
    "  }",
    "  const entryButton = event.target.closest('[data-entry-submit]');",
    "  if (entryButton) {",
    "    const pageId = entryButton.dataset.entrySubmit || '';",
    "    const feed = document.querySelector(`[data-transaction-feed=\"${pageId}\"]`);",
    "    const labelInput = document.querySelector(`[data-entry-field=\"${pageId}:label\"]`);",
    "    const amountInput = document.querySelector(`[data-entry-field=\"${pageId}:amount\"]`);",
    "    const categoryInput = document.querySelector(`[data-entry-field=\"${pageId}:category\"]`);",
    "    const label = String(labelInput?.value || '').trim();",
    "    const amount = String(amountInput?.value || '').trim();",
    "    const category = String(categoryInput?.value || '').trim() || 'Unsorted';",
    "    if (!feed || !label || !amount) return;",
    "    const amountText = amount.startsWith('+') || amount.startsWith('-') ? amount : `- €${amount}`;",
    "    const tone = amountText.trim().startsWith('+') ? 'income' : 'expense';",
    "    const item = document.createElement('article');",
    "    item.className = 'transaction-item';",
    "    item.innerHTML = [",
    "      '<div>',",
    "      `  <strong>${escapeHtml(label)}</strong>`,",
    "      `  <div class=\"transaction-meta\">${escapeHtml(category)} • Just now</div>`,",
    "      '</div>',",
    "      `  <div class=\"transaction-amount ${tone}\">${escapeHtml(amountText)}</div>`",
    "    ].join('');",
    "    feed.prepend(item);",
    "    if (labelInput) labelInput.value = '';",
    "    if (amountInput) amountInput.value = '';",
    "    if (categoryInput) categoryInput.value = '';",
    "  }",
    "});",
    "",
    "document.addEventListener('keydown', (event) => {",
    "  const input = event.target.closest('[data-list-input]');",
    "  if (!input || event.key !== 'Enter') {",
    "    return;",
    "  }",
    "  event.preventDefault();",
    "  const pageId = input.dataset.listInput || '';",
    "  document.querySelector(`[data-list-add=\"${pageId}\"]`)?.click();",
    "});",
    "",
    "window.addEventListener('hashchange', () => activateView(location.hash.slice(1)));",
    "",
    "async function boot() {",
    "  try {",
    "    const response = await fetch('./app.config.json', { cache: 'no-store' });",
    "    if (response.ok) {",
    "      scenario = await response.json();",
    "    }",
    "  } catch (_error) {",
    "    scenario = fallbackScenario;",
    "  }",
    "  renderScenario();",
    "  const firstButton = document.querySelector('[data-view-target]');",
    "  activateView(location.hash.slice(1) || firstButton?.dataset.viewTarget || '');",
    "}",
    "",
    "boot();",
    ""
  ].join("\n");
}

export function buildScaffoldTemplate(
  templateId = "express_structured_api",
  projectName = "hydria-project",
  options = {}
) {
  const displayName = String(options.displayName || projectName || "hydria-project");
  const prompt = String(options.prompt || "");
  const gitResearch = options.gitResearch || null;
  const normalizedGitResearch = normalizeGitResearch(gitResearch);

  if (templateId === "node_express_jwt_auth") {
    const nextCommands = ["npm install", "npm run dev"];
    return {
      templateId,
      description: "Node.js + Express + JWT auth scaffold with signup/login routes and layered structure.",
      directories: [
        "src",
        "src/routes",
        "src/controllers",
        "src/services",
        "src/middlewares",
        "src/validators",
        "src/repositories",
        "tests/auth"
      ],
      files: [
        { path: "package.json", content: buildPackageJson({ name: projectName, auth: true }) },
        { path: ".env.example", content: buildEnvExample(true) },
        { path: "README.md", content: buildReadme({ name: projectName, description: "Express/JWT authentication API scaffold generated by Hydria.", nextCommands }) },
        { path: "src/app.js", content: authAppJs() },
        { path: "src/server.js", content: authServerJs() },
        { path: "src/routes/auth.routes.js", content: authRoutesJs() },
        { path: "src/controllers/auth.controller.js", content: authControllerJs() },
        { path: "src/services/auth.service.js", content: authServiceJs() },
        { path: "src/middlewares/auth.middleware.js", content: authMiddlewareJs() },
        { path: "src/validators/auth.schemas.js", content: authValidatorJs() },
        { path: "src/repositories/user.repository.js", content: authRepositoryJs() }
      ],
      mainStructure: [
        "src/routes/auth.routes.js",
        "src/controllers/auth.controller.js",
        "src/services/auth.service.js",
        "src/middlewares/auth.middleware.js",
        "src/validators/auth.schemas.js",
        "src/repositories/user.repository.js"
      ],
      nextCommands
    };
  }

  if (templateId === "global_multidimensional_project") {
    return {
      templateId,
      description: "Global multidimensional project scaffold generated by Hydria.",
      directories: [
        "experience",
        "content",
        "logic",
        "data",
        "studio",
        "audio"
      ],
      files: [
        {
          path: "README.md",
          content: buildReadme({
            name: projectName,
            description:
              "Global project workspace generated by Hydria for iterative creation, editing and delivery.",
            nextCommands: []
          })
        }
      ],
      mainStructure: [
        "README.md"
      ],
      nextCommands: []
    };
  }

  if (templateId === "static_html_app") {
    return {
      templateId,
      description: "Static HTML/CSS/JS app scaffold generated by Hydria for direct live preview in the workspace.",
      directories: [],
      files: [
        { path: "index.html", content: staticAppHtml({ name: displayName, prompt }) },
        { path: "styles.css", content: staticAppCss() },
        { path: "app.js", content: staticAppJs() },
        {
          path: "app.config.json",
          content: staticAppConfig({
            name: displayName,
            prompt,
            gitResearch,
            generatedAppScenario: options.generatedAppScenario || null
          })
        },
        {
          path: "README.md",
          content: buildReadme({
            name: displayName,
            description: "Live app scaffold generated by Hydria with domain-aware content and multiple usable views.",
            references: normalizedGitResearch.repositories,
            nextCommands: ["Open the Live surface directly in Hydria"]
          })
        }
      ],
      mainStructure: [
        "index.html",
        "styles.css",
        "app.js",
        "app.config.json"
      ],
      nextCommands: []
    };
  }

  const nextCommands = ["npm install", "npm run dev"];
  return {
    templateId: "express_structured_api",
    description: "Structured Express API scaffold with route/controller/service split.",
    directories: [
      "src",
      "src/routes",
      "src/controllers",
      "src/services"
    ],
    files: [
      { path: "package.json", content: buildPackageJson({ name: projectName, auth: false }) },
      { path: ".env.example", content: buildEnvExample(false) },
      { path: "README.md", content: buildReadme({ name: projectName, description: "Structured Express API scaffold generated by Hydria.", nextCommands }) },
      { path: "src/app.js", content: genericAppJs() },
      { path: "src/server.js", content: genericServerJs() },
      { path: "src/routes/index.routes.js", content: genericRoutesJs() },
      { path: "src/controllers/modules.controller.js", content: genericControllerJs() },
      { path: "src/services/modules.service.js", content: genericServiceJs() }
    ],
    mainStructure: [
      "src/routes/index.routes.js",
      "src/controllers/modules.controller.js",
      "src/services/modules.service.js"
    ],
    nextCommands
  };
}

export default {
  buildScaffoldTemplate
};
