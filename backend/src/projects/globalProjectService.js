function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function inferProjectTopic(prompt = "") {
  const normalized = String(prompt || "")
    .replace(/[.?!]+$/g, "")
    .trim();
  let cleaned = normalized.replace(
    /^(cree|crée|fais|genere|génère|construis|build|make|create|transforme|turn)\s+/i,
    ""
  );
  const cleanupPatterns = [
    /^(un|une|the)\s+/i,
    /^(projet|project)\s+(global|complet|vivant)\s+(pour|sur|autour de)\s+/i,
    /^(workspace|espace de travail|environment|environnement)\s+(pour|sur|autour de)\s+/i,
    /^(application|app)\s+(de|pour)\s+/i,
    /^(une|un|the)\s+(application|app)\s+(de|pour)\s+/i
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of cleanupPatterns) {
      const next = cleaned.replace(pattern, "");
      if (next !== cleaned) {
        cleaned = next.trim();
        changed = true;
      }
    }
  }

  return cleaned || normalized || "ce projet";
}

function inferProjectSeed({
  prompt = "",
  dimensions = [],
  selectedCapabilities = []
} = {}) {
  const normalized = normalizeText(prompt);
  const topic = inferProjectTopic(prompt);
  const hasStudio = selectedCapabilities.some((capability) => capability.id === "studio");
  const hasMusic = selectedCapabilities.some((capability) => capability.id === "music");

  if (/\b(cuisine|recipe|recipes|recette|recettes|meal|meals|food|healthy|nutrition)\b/.test(normalized)) {
    return {
      theme: "food_product",
      headline: `Projet produit autour de ${topic}`,
      audience: "des personnes qui veulent manger mieux sans complexifier leur quotidien",
      problem:
        "la planification des repas, les courses et le suivi des habitudes restent disperses et peu motivants",
      promise:
        "unifier recettes, planning repas, liste de courses et pilotage produit dans un seul espace evolutif",
      workstreams: [
        "experience produit",
        "bibliotheque de recettes",
        "planning et courses",
        "pilotage metrics et retention"
      ],
      coreLoop: [
        "ouvrir des recettes utiles pour la semaine",
        "placer les repas dans un planning simple",
        "transformer automatiquement le plan en liste de courses"
      ],
      heroMoments: [
        "bibliotheque de recettes avec filtres utiles",
        "planning repas semaine par semaine",
        "liste de courses vivante",
        "pilotage retention et panier moyen"
      ],
      kpis: ["recettes sauvegardees", "plans crees", "courses generees", "retention hebdo"],
      recommendedObjects: ["app", "spreadsheet", "dashboard", "presentation"],
      nextSteps: [
        "Ajouter une surface app avec vues Recettes, Planning et Courses",
        "Ajouter un tableur pour le cout matiere et les stocks",
        "Ajouter un dashboard de retention et panier moyen"
      ],
      launchPlan: [
        "Valider le noyau recettes + planning avec un premier segment d'utilisateurs",
        "Mesurer quels plats sont planifies puis reellement cuisines",
        "Optimiser les courses et le gain de temps ressenti"
      ]
    };
  }

  if (/\b(music|musique|audio|artist|artiste|scene locale|local music|concert|event)\b/.test(normalized)) {
    return {
      theme: "local_music_product",
      headline: `Projet produit autour de ${topic}`,
      audience: "des artistes locaux, des lieux et des auditeurs qui veulent mieux se connecter",
      problem:
        "les artistes locaux manquent de visibilite, de narration claire et d'outils simples pour convertir l'interet en actions concretes",
      promise:
        "assembler app, storytelling, contenus promo, pilotage et dimension audio dans le meme projet vivant",
      workstreams: [
        "positionnement produit",
        "experience fan et artistes",
        "narration et direction visuelle",
        hasMusic ? "briefing audio et cues de marque" : "distribution et activation"
      ],
      coreLoop: [
        "decouvrir un artiste local via une histoire courte et convaincante",
        "ouvrir sa page, ses prochains evenements et ses contenus",
        "passer de l'interet a l'achat de billet ou au suivi de l'artiste"
      ],
      heroMoments: [
        "flux de decouverte locale par ville ou scene",
        "page artiste avec histoire, morceaux et evenement a venir",
        "fiche evenement avec venue, billetterie et preuve sociale",
        hasMusic ? "signature audio et cues de marque" : "surface de traction locale"
      ],
      kpis: ["artistes actifs", "evenements publies", "conversion billet", "lieux partenaires"],
      recommendedObjects: uniqueStrings([
        "app",
        "presentation",
        "workflow",
        hasStudio ? "design" : "",
        hasMusic ? "audio-brief" : "dashboard"
      ]),
      nextSteps: [
        "Definir la promesse utilisateur et la boucle de decouverte locale",
        "Produire un deck clair pour artistes, lieux et partenaires",
        hasMusic
          ? "Preparer un brief audio et un plan de cues pour la marque"
          : "Ajouter un dashboard de traction locale et evenements"
      ],
      launchPlan: [
        "Onboarder 5 a 10 artistes pilotes dans une premiere ville",
        "Structurer les pages artiste, evenement et billetterie",
        "Equiper les lieux partenaires avec un tableau de traction simple"
      ]
    };
  }

  if (/\b(investor|investisseurs?|fundraising|deck|pitch|business plan)\b/.test(normalized)) {
    return {
      theme: "investor_asset",
      headline: `Projet investisseur pour ${topic}`,
      audience: "des investisseurs ou partenaires qui doivent comprendre la valeur rapidement",
      problem:
        "le projet n'est pas encore raconte de facon assez claire, concrete et credible pour une revue externe",
      promise:
        "produire un ensemble coherent de documents, slides et surfaces de pilotage pour soutenir la discussion",
      workstreams: [
        "positionnement et these",
        "preuves business",
        "deck investisseur",
        "surfaces de pilotage"
      ],
      coreLoop: [
        "clarifier la these et le probleme adresse",
        "montrer traction, hypotheses et economie unitaire",
        "convertir la revue en prochaine etape de discussion ou diligence"
      ],
      heroMoments: [
        "executive summary tres lisible",
        "deck investisseurs court et convaincant",
        "surface KPI simple pour traction et hypotheses"
      ],
      kpis: ["croissance", "retention", "marge brute", "jalon suivant"],
      recommendedObjects: ["document", "presentation", "dashboard"],
      nextSteps: [
        "Structurer la these et le probleme",
        "Ajouter un deck investisseurs court",
        "Ajouter un dashboard simple avec traction et hypotheses"
      ],
      launchPlan: [
        "Rendre la these et la narration lisibles en 5 minutes",
        "Prouver les hypotheses avec chiffres et jalons credibles",
        "Preparer une boucle de follow-up apres premiere revue"
      ]
    };
  }

  if (/\b(workflow|automation|n8n|ops|operation|publier|pipeline)\b/.test(normalized)) {
    return {
      theme: "operations_system",
      headline: `Projet operations pour ${topic}`,
      audience: "une equipe qui doit executer un flux clair et repetable",
      problem:
        "les etapes, les dependances et les points de controle ne sont pas encore visibles dans un meme environnement",
      promise:
        "creer un systeme exploitable avec workflow, dashboard, documentation et surfaces de suivi",
      workstreams: [
        "modelisation du flux",
        "points de controle",
        "observabilite",
        "documentation operatoire"
      ],
      coreLoop: [
        "capturer le signal d'entree",
        "faire avancer le flux sans zone morte",
        "mesurer l'etat, les blocages et la sortie"
      ],
      heroMoments: [
        "workflow visuel clair",
        "dashboard d'operations",
        "documentation d'exceptions et relances"
      ],
      kpis: ["items en attente", "temps de cycle", "blocages critiques", "taux d'automatisation"],
      recommendedObjects: ["workflow", "dashboard", "document"],
      nextSteps: [
        "Ajouter le workflow principal",
        "Ajouter un dashboard de suivi des etapes et blocages",
        "Documenter les regles et exceptions"
      ],
      launchPlan: [
        "Cartographier un seul flux critique de bout en bout",
        "Rendre visible le point de blocage principal",
        "Automatiser ensuite les transitions les plus repetitives"
      ]
    };
  }

  return {
    theme:
      /\b(task|roadmap|kanban|timeline|resource|project manager|collaboration)\b/.test(normalized)
        ? "project_ops"
        : /\b(sql|database|dataset|spreadsheet|dashboard|analytics|etl|pipeline|data)\b/.test(normalized)
          ? "data_system"
          : /\b(workflow|automation|agent|orchestration|scheduled|event driven)\b/.test(normalized)
            ? "automation_system"
            : /\b(design|wireframe|ui|ux|figma|layout|visual)\b/.test(normalized)
              ? "design_system"
              : /\b(document|wiki|knowledge|notes|notion|prompt|brief|spec|plan)\b/.test(normalized)
                ? "knowledge_system"
                : "generic_project",
    headline: `Projet global pour ${topic}`,
    audience: "des utilisateurs ou parties prenantes qui ont besoin d'un espace clair et evolutif",
    problem:
      "les decisions, contenus et surfaces utiles ne sont pas encore regroupes dans un seul projet vivant",
    promise:
      "assembler dans Hydria les objets, surfaces et prochaines actions necessaires pour faire avancer le projet",
    workstreams: uniqueStrings([
      /\b(task|roadmap|kanban|timeline|resource|project manager|collaboration)\b/.test(normalized)
        ? "organisation projet"
        : "",
      /\b(sql|database|dataset|spreadsheet|dashboard|analytics|etl|pipeline|data)\b/.test(normalized)
        ? "donnees et pilotage"
        : "",
      /\b(workflow|automation|agent|orchestration|scheduled|event driven)\b/.test(normalized)
        ? "automation et orchestration"
        : "",
      /\b(design|wireframe|ui|ux|figma|layout|visual)\b/.test(normalized)
        ? "design et experience"
        : "",
      /\b(document|wiki|knowledge|notes|notion|prompt|brief|spec|plan)\b/.test(normalized)
        ? "connaissance et structuration"
        : "",
      dimensions.includes("structure") || dimensions.includes("logic") ? "structure produit" : "",
      dimensions.includes("text") || dimensions.includes("narrative") ? "contenu et narration" : "",
      dimensions.includes("visual") ? "direction visuelle" : "",
      dimensions.includes("audio") ? "dimension audio" : "",
      dimensions.includes("data") ? "donnees et pilotage" : ""
    ]).filter(Boolean),
    coreLoop: [
      "clarifier l'intention et la premiere valeur utile",
      "ouvrir la meilleure surface de travail pour avancer",
      "faire evoluer le meme projet sans repartir de zero"
    ],
    heroMoments: uniqueStrings([
      dimensions.includes("logic") ? "surface applicative ou logique" : "",
      dimensions.includes("text") || dimensions.includes("narrative") ? "narration et documentation" : "",
      dimensions.includes("visual") ? "representation visuelle" : "",
      dimensions.includes("audio") ? "brief audio ou cues" : "",
      dimensions.includes("data") ? "pilotage et donnees" : ""
    ]),
    kpis: uniqueStrings([
      dimensions.includes("logic") ? "activation" : "",
      dimensions.includes("text") ? "clarte" : "",
      dimensions.includes("visual") ? "comprehension visuelle" : "",
      dimensions.includes("data") ? "qualite des signaux" : ""
    ]),
    recommendedObjects: uniqueStrings([
      /\b(task|roadmap|kanban|timeline|resource|project manager|collaboration)\b/.test(normalized)
        ? "workflow"
        : "",
      /\b(sql|database|dataset|spreadsheet|dashboard|analytics|etl|pipeline|data)\b/.test(normalized)
        ? "dashboard"
        : "",
      /\b(workflow|automation|agent|orchestration|scheduled|event driven)\b/.test(normalized)
        ? "workflow"
        : "",
      /\b(design|wireframe|ui|ux|figma|layout|visual)\b/.test(normalized)
        ? "design"
        : "",
      /\b(document|wiki|knowledge|notes|notion|prompt|brief|spec|plan)\b/.test(normalized)
        ? "document"
        : "",
      dimensions.includes("logic") || dimensions.includes("structure") ? "app" : "",
      dimensions.includes("data") ? "dashboard" : "",
      dimensions.includes("text") || dimensions.includes("narrative") ? "document" : "",
      dimensions.includes("visual") ? "design" : "",
      dimensions.includes("audio") ? "audio-brief" : ""
    ]),
    nextSteps: [
      "Clarifier le coeur du projet et son public",
      "Ajouter la prochaine surface la plus utile",
      "Faire evoluer le meme projet plutot que repartir de zero"
    ],
    launchPlan: [
      "Installer la premiere surface utile le plus vite possible",
      "Relier ensuite les autres objets au meme projet",
      "Faire iterer Hydria sur l'existant au lieu de recreer"
    ]
  };
}

function detectDimensions(prompt = "", classification = "", activeWorkObject = null) {
  const normalized = normalizeText(prompt);
  const dimensions = [];

  if (["coding", "compare"].includes(classification) || /\b(api|backend|frontend|app|dashboard|auth|jwt|node|express|react)\b/.test(normalized)) {
    dimensions.push("structure", "logic");
  }

  if (/\b(data|dataset|json|csv|analytics|metrics|database|db)\b/.test(normalized)) {
    dimensions.push("data");
  }

  if (/\b(story|storytelling|narrative|narratif|pitch|worldbuilding|script|chapter|scene|comic|brand|histoire)\b/.test(normalized)) {
    dimensions.push("narrative", "text");
  }

  if (/\b(visual|visuel|design|screen|ui|ux|storyboard|presentation|slides|deck|image)\b/.test(normalized)) {
    dimensions.push("visual");
  }

  if (/\b(audio|music|musique|track|sound|voice|podcast|beat|dj|lyrics)\b/.test(normalized)) {
    dimensions.push("audio");
  }

  if (!dimensions.length && activeWorkObject?.objectKind === "project") {
    dimensions.push("structure");
  }

  if (!dimensions.length) {
    dimensions.push("text");
  }

  return uniqueStrings(dimensions);
}

function scoreCapabilityMatch(capability = {}, { prompt = "", dimensions = [] } = {}) {
  const normalized = normalizeText(prompt);
  let score = 0;

  if (capability.id === "studio") {
    if (dimensions.some((dimension) => ["visual", "narrative"].includes(dimension))) {
      score += 3;
    }
  } else if (capability.id === "music") {
    if (dimensions.includes("audio")) {
      score += 3;
    }
  }

  if (capability.id === "studio") {
    if (/\b(story|storytelling|narrative|narratif|pitch|visual|visuel|storyboard|presentation|brand|comic)\b/.test(normalized)) {
      score += 4;
    }
  }

  if (capability.id === "music") {
    if (/\b(audio|music|musique|track|sound|voice|podcast|beat|lyrics|dj)\b/.test(normalized)) {
      score += 4;
    }
  }

  return score;
}

function buildCapabilityReason(capability = {}, score = 0, dimensions = []) {
  if (capability.id === "studio") {
    return score >= 4
      ? `Le projet demande une couche narrative/visuelle coherente (${dimensions.join(", ")}).`
      : "Le projet peut beneficier d'une structure storytelling et visuelle.";
  }

  if (capability.id === "music") {
    return score >= 4
      ? `Le projet demande une couche audio exploitable (${dimensions.join(", ")}).`
      : "Le projet peut beneficier d'une preparation audio structuree.";
  }

  return "Capacite utile pour enrichir le projet.";
}

function buildProjectSummary({ prompt = "", dimensions = [], selectedCapabilities = [] } = {}) {
  const seed = inferProjectSeed({ prompt, dimensions, selectedCapabilities });
  const focus = uniqueStrings([
    ...(dimensions.includes("logic") || dimensions.includes("structure") ? ["structure produit"] : []),
    ...(dimensions.includes("data") ? ["donnees"] : []),
    ...(dimensions.includes("visual") ? ["direction visuelle"] : []),
    ...(dimensions.includes("narrative") || dimensions.includes("text") ? ["contenu et narration"] : []),
    ...(dimensions.includes("audio") ? ["dimension audio"] : [])
  ]);
  const focusLabel = focus.length ? focus.join(", ") : "base de travail";
  return `${seed.headline}, avec focus ${focusLabel}.`;
}

function buildEditableSurfaces(dimensions = [], selectedCapabilities = []) {
  const surfaces = [];

  if (dimensions.includes("text") || dimensions.includes("narrative")) {
    surfaces.push("brief", "plan", "story");
  }
  if (dimensions.includes("structure") || dimensions.includes("logic")) {
    surfaces.push("modules", "architecture", "logic");
  }
  if (dimensions.includes("data")) {
    surfaces.push("data-model");
  }
  if (dimensions.includes("visual") || selectedCapabilities.some((capability) => capability.id === "studio")) {
    surfaces.push("storyboard", "visual-direction");
  }
  if (dimensions.includes("audio") || selectedCapabilities.some((capability) => capability.id === "music")) {
    surfaces.push("audio-brief", "track-plan");
  }

  return uniqueStrings(surfaces);
}

export class GlobalProjectService {
  buildContext({
    prompt = "",
    classification = "",
    projectContext = null,
    activeWorkObject = null,
    project = null,
    internalCapabilityProfiles = []
  } = {}) {
    const dimensions = uniqueStrings([
      ...(project?.dimensions || []),
      ...detectDimensions(prompt, classification, activeWorkObject)
    ]);

    const scoredCapabilities = (internalCapabilityProfiles || [])
      .map((capability) => ({
        ...capability,
        matchScore: scoreCapabilityMatch(capability, {
          prompt,
          dimensions
        })
      }))
      .filter((capability) => capability.available && capability.matchScore > 0)
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, 2)
      .map((capability) => ({
        id: capability.id,
        label: capability.label,
        sourcePath: capability.sourcePath,
        strengths: capability.strengths || [],
        stages: capability.stages || [],
        summary: capability.summary,
        matchScore: capability.matchScore,
        reason: buildCapabilityReason(capability, capability.matchScore, dimensions)
      }));

    const selectedCapabilityIds = scoredCapabilities.map((capability) => capability.id);
    const editableSurfaces = buildEditableSurfaces(dimensions, scoredCapabilities);
    const seed = inferProjectSeed({
      prompt,
      dimensions,
      selectedCapabilities: scoredCapabilities
    });
    const projectMode =
      projectContext?.isProjectTask || project?.workspacePath
        ? "global_project"
        : "work_object";

    return {
      projectMode,
      dimensions,
      selectedCapabilities: scoredCapabilities,
      internalCapabilityIds: selectedCapabilityIds,
      editableSurfaces,
      seed,
      summary: buildProjectSummary({
        prompt,
        dimensions,
        selectedCapabilities: scoredCapabilities
      }),
      nextHydriaAction:
        seed.nextSteps?.[0] ||
        (scoredCapabilities.some((capability) => capability.id === "music")
          ? "Continue avec Hydria pour enrichir la direction audio ou le plan de pistes."
          : scoredCapabilities.some((capability) => capability.id === "studio")
            ? "Continue avec Hydria pour enrichir le storytelling ou la direction visuelle."
            : "Continue avec Hydria pour affiner la structure et la logique du projet.")
    };
  }

  buildProjectPatch(project = {}, context = {}, metadata = {}) {
    return {
      dimensions: uniqueStrings([
        ...(project.dimensions || []),
        ...(context.dimensions || [])
      ]),
      internalCapabilities: uniqueStrings([
        ...(project.internalCapabilities || []),
        ...(context.internalCapabilityIds || [])
      ]),
      globalProject: {
        ...(project.globalProject || {}),
        projectMode: context.projectMode || "global_project",
        summary: context.summary || project.globalProject?.summary || "",
        seed: context.seed || project.globalProject?.seed || null,
        dimensions: context.dimensions || project.globalProject?.dimensions || [],
        editableSurfaces:
          context.editableSurfaces || project.globalProject?.editableSurfaces || [],
        selectedCapabilities:
          context.selectedCapabilities || project.globalProject?.selectedCapabilities || [],
        lastEvaluatedAt: new Date().toISOString()
      },
      metadata: {
        ...(project.metadata || {}),
        ...metadata
      }
    };
  }
}

export default GlobalProjectService;
