import config from "../../config/hydria.config.js";
import { detectApiNeed } from "../apis/apiRouter.js";
import { getPrimaryModelTarget, getProviderModelChain } from "../registry/modelRegistry.js";
import { buildAttachmentRoutingHint } from "../attachments/attachmentService.js";
import { inferArtifactIntent } from "../artifacts/generationIntentService.js";
import { detectWebNeed } from "../web/webIntentService.js";
import { detectTooling } from "../tools/toolRouter.js";
import { resolveTaskPack } from "./taskPackService.js";

function allowMultipleCandidates() {
  return config.strategy.enableMultiAnswer && config.strategy.maxCandidates > 1;
}

function llmStep(kind, purpose, instruction = "", options = {}) {
  const primaryTarget = getPrimaryModelTarget(kind);

  return {
    type: "llm",
    provider: primaryTarget?.provider || "llm:auto",
    modelKind: kind,
    model: primaryTarget?.model || "",
    modelChain: getProviderModelChain(kind),
    purpose,
    instruction,
    ...options
  };
}

function attachmentAwareInstruction(baseInstruction, attachments = []) {
  if (!attachments.length) {
    return baseInstruction;
  }

  const routingHint = buildAttachmentRoutingHint(attachments);

  return [
    baseInstruction,
    "Use the attached file contents directly.",
    "Reference the attached filenames when helpful.",
    "If extraction looks partial, say so briefly but still answer from the extracted evidence.",
    routingHint
  ].join(" ");
}

function buildImplicitWebNeed(classification, prompt, { attachments = [], apiNeed = null, webNeed = null, toolNeed = null } = {}) {
  if (webNeed || attachments.length || apiNeed || toolNeed?.useTools) {
    return webNeed;
  }

  if (classification === "compare") {
    return {
      routeKey: "web/search",
      capability: "web_search",
      query: prompt,
      preferSummaries: true,
      implicit: true
    };
  }

  return webNeed;
}

function hasRequiredApiInputs(apiNeed = null) {
  if (!apiNeed) {
    return false;
  }

  switch (apiNeed.category) {
    case "weather":
    case "geocoding":
      return Boolean(apiNeed.location);
    case "finance":
      return Boolean(apiNeed.symbol);
    case "translation":
      return Boolean(apiNeed.text && apiNeed.targetLanguage);
    case "movies":
      return Boolean(apiNeed.query);
    case "sports":
      return Boolean(apiNeed.team);
    case "search":
      return Boolean(apiNeed.query);
    default:
      return true;
  }
}

export function buildExecutionPlan(
  classification,
  prompt,
  { attachments = [], taskPack = null } = {}
) {
  const apiNeed = detectApiNeed(prompt);
  const toolNeed = detectTooling(prompt, classification, attachments);
  const webNeed = buildImplicitWebNeed(classification, prompt, {
    attachments,
    apiNeed,
    webNeed: detectWebNeed(prompt, apiNeed),
    toolNeed
  });
  const activeTaskPack =
    taskPack ||
    resolveTaskPack({
      classification,
      prompt,
      attachments,
      apiNeed,
      webNeed,
      toolNeed
    });
  const effectiveApiNeed =
    webNeed && apiNeed?.category === "search"
      ? null
      : hasRequiredApiInputs(apiNeed)
        ? apiNeed
        : apiNeed || null;
  const multiAllowed = allowMultipleCandidates();
  const steps = [];
  const hasAttachments = attachments.length > 0;
  const artifactIntent =
    classification === "artifact_generation"
      ? inferArtifactIntent(prompt, attachments)
      : null;

  const addWebStep = (purpose = "web_lookup") => {
    if (!webNeed) {
      return;
    }

    steps.push({
      type: "web",
      provider: "web:auto",
      capability: webNeed.capability,
      routeKey: webNeed.routeKey,
      purpose
    });
  };

  const addToolStep = (toolId, capability, purpose) => {
    if (!toolNeed?.useTools) {
      return;
    }

    steps.push({
      type: "tool",
      provider: "local-tools",
      toolId,
      capability,
      purpose
    });
  };

  switch (classification) {
    case "artifact_generation":
      steps.push(
        llmStep(
          "agent",
          "generation_spec",
          attachmentAwareInstruction(
            "Design the document generation spec. Focus on title, sections, audience, and a clean output structure.",
            attachments
          ),
          {
            modelChain: getProviderModelChain("agent")
          }
        )
      );
      steps.push(
        llmStep(
          "general",
          "generation_draft",
          attachmentAwareInstruction(
            "Draft the requested document in Markdown with clean structure and directly usable content.",
            attachments
          )
        )
      );
      if (multiAllowed) {
        steps.push(
          llmStep(
            "agent",
            "generation_review",
            attachmentAwareInstruction(
            "Review and improve the generated document for clarity, coherence, and grounding.",
            attachments
          ),
          {
              modelChain: getProviderModelChain("agent")
            }
          )
        );
      }
      steps.push({
        type: "artifact",
        provider: "local",
        purpose: "render_document",
        artifactType: "document",
        format: artifactIntent?.format || "pdf"
      });
      break;
    case "coding":
      if (toolNeed?.workspaceInspect) {
        addToolStep("workspace_inspector", "workspace_inspect", "workspace_context");
      }
      if (toolNeed?.diagnostics) {
        addToolStep("diagnostics_runner", "run_diagnostics", "diagnostics_check");
      }
      if (toolNeed?.preview) {
        addToolStep("preview_inspector", "inspect_preview", "preview_check");
      }
      steps.push(
        llmStep(
          "code",
          "coding_solution",
          attachmentAwareInstruction(
            "Return a practical coding answer with concrete fixes or code. If code files are attached, explain the code, highlight only issues that are directly visible in the file, and avoid speculative security claims unless the code explicitly supports them.",
            attachments
          )
        )
      );
      if (multiAllowed && (hasAttachments || activeTaskPack.plannerHints.allowSecondaryReview)) {
        steps.push(
          llmStep(
            "reasoning",
            "coding_review_secondary",
            attachmentAwareInstruction(
              "Provide a secondary engineering review focused on directly observable bugs, edge cases, and maintainability. Do not infer runtime or security vulnerabilities that are not evidenced by the code.",
              attachments
            )
          )
        );
      }
      break;
    case "complex_reasoning":
      if (toolNeed?.workspaceInspect) {
        addToolStep("workspace_inspector", "workspace_inspect", "workspace_context");
      }
      if (toolNeed?.preview) {
        addToolStep("preview_inspector", "inspect_preview", "preview_context");
      }
      steps.push(
        llmStep(
          "reasoning",
          "primary_reasoning",
          attachmentAwareInstruction(
            "Provide a structured and rigorous answer. Use short sections, prioritize the main recommendation, and ground claims in the available evidence.",
            attachments
          ),
          multiAllowed
            ? {
                modelChain: getProviderModelChain("reasoning")
              }
            : {}
        )
      );
      if (multiAllowed) {
        steps.push(
          llmStep(
            "general",
            "secondary_angle",
            attachmentAwareInstruction(
              "Provide a concise alternate angle or tradeoff-oriented answer.",
              attachments
            )
          )
        );
      }
      break;
    case "compare":
      addWebStep("web_compare_context");
      steps.push(
        llmStep(
          "reasoning",
          "comparison_primary",
          attachmentAwareInstruction(
            "Compare options clearly with strengths, weaknesses, and recommendation. Use a clear side-by-side structure.",
            attachments
          ),
          multiAllowed
            ? {
                modelChain: getProviderModelChain("reasoning")
              }
            : {}
        )
      );
      if (multiAllowed) {
        steps.push(
          llmStep(
            "general",
            "comparison_secondary",
            attachmentAwareInstruction(
              "Produce a shorter alternative comparison focused on practical differences.",
              attachments
            )
          )
        );
      }
      break;
    case "summarize":
      addWebStep("web_summary_context");
      steps.push(
        llmStep(
          "general",
          "summarization",
          attachmentAwareInstruction(
            "Summarize the material faithfully and concisely. Preserve the core facts and structure.",
            attachments
          )
        )
      );
      if (
        (multiAllowed && hasAttachments && prompt.length > 40) ||
        (activeTaskPack.id === "document_intelligence" && hasAttachments)
      ) {
        steps.push(
          llmStep(
            "reasoning",
            "summarization_secondary",
            attachmentAwareInstruction(
            "Add a second concise summary focused on implications, strengths, weaknesses, or actionable takeaways.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("reasoning")
            }
          )
        );
      }
      break;
    case "brainstorm":
      steps.push(
        llmStep(
          "general",
          "brainstorm_primary",
          attachmentAwareInstruction(
            "Generate practical and non-generic ideas.",
            attachments
          )
        )
      );
      if (multiAllowed && prompt.length > 220) {
        steps.push(
          llmStep(
            "reasoning",
            "brainstorm_secondary",
            attachmentAwareInstruction(
            "Add a second wave of ideas with prioritization and constraints.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("reasoning")
            }
          )
        );
      }
      break;
    case "data_lookup":
      if (webNeed) {
        addWebStep("web_lookup");
      }
      if (effectiveApiNeed && hasRequiredApiInputs(effectiveApiNeed)) {
        steps.push({
          type: "api",
          provider: "catalog:auto",
          capability: effectiveApiNeed.capability,
          routeKey: effectiveApiNeed.routeKey
        });
      }
      if (config.llm.enabled && (webNeed || hasRequiredApiInputs(effectiveApiNeed))) {
        steps.push(
          llmStep(
            "general",
            webNeed ? "web_explanation" : "api_explanation",
            attachmentAwareInstruction(
              webNeed
                ? "Explain the web result clearly, cite the source URLs when useful, and keep factual fidelity."
                : "Explain the API result clearly and keep factual fidelity.",
              attachments
            )
          )
        );
      }
      break;
    case "hybrid_task":
      if (webNeed) {
        addWebStep("web_research");
      }
      if (effectiveApiNeed && hasRequiredApiInputs(effectiveApiNeed)) {
        steps.push({
          type: "api",
          provider: "catalog:auto",
          capability: effectiveApiNeed.capability,
          routeKey: effectiveApiNeed.routeKey
        });
      }
      if (webNeed || hasRequiredApiInputs(effectiveApiNeed)) {
        steps.push(
          llmStep(
            "reasoning",
            "hybrid_analysis",
            attachmentAwareInstruction(
            "Use the API data as evidence and provide a short analysis.",
              attachments
            ),
            multiAllowed
              ? {
                  modelChain: getProviderModelChain("reasoning")
                }
              : {}
          )
        );
        if (multiAllowed && config.strategy.maxCandidates > 1) {
          steps.push(
            llmStep(
              "general",
              "hybrid_alternate",
              attachmentAwareInstruction(
                "Give a concise alternate synthesis grounded in the same data.",
                attachments
              )
            )
          );
        }
      }
      break;
    case "simple_chat":
    default:
      if (webNeed || activeTaskPack.plannerHints.preferWeb) {
        addWebStep("web_lookup");
      }
      steps.push(
        llmStep(
          hasAttachments || activeTaskPack.plannerHints.preferReasoning
            ? "general"
            : "fast",
          "direct_response",
          attachmentAwareInstruction(
            "Answer directly and stay concise unless the user asks for depth.",
            attachments
          )
        )
      );
      break;
  }

  return {
    strategy: config.strategy.name,
    classification,
    taskPack: activeTaskPack,
    artifactIntent,
    apiNeed: effectiveApiNeed,
    webNeed,
    toolNeed,
    steps
  };
}
