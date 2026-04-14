import config from "../../config/hydria.config.js";
import { resolveApiIntent } from "./apiIntentResolver.js";
import { getPrimaryModelTarget, getProviderModelChain } from "./modelChainResolver.js";
import { buildAttachmentRoutingHint } from "../attachments/attachmentGateway.js";
import { resolveArtifactIntent } from "./artifactIntentResolver.js";
import { resolveWebIntent } from "./webIntentResolver.js";
import { resolveToolIntent } from "./toolIntentResolver.js";
import { resolveTaskPack } from "./taskPackResolver.js";
import { resolveRequestedShape } from "./creationShape.js";

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

export function buildAgenticExecutionPlan(
  classification,
  prompt,
  { attachments = [], taskPack = null } = {}
) {
  const requestedShape = resolveRequestedShape(prompt);
  const apiNeed = resolveApiIntent(prompt);
  const toolNeed = resolveToolIntent(prompt, classification, attachments);
  const webNeed = buildImplicitWebNeed(classification, prompt, {
    attachments,
    apiNeed,
    webNeed: resolveWebIntent(prompt, apiNeed),
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
      ? resolveArtifactIntent(prompt, attachments)
      : null;
  const artifactShape = requestedShape.shape || artifactIntent?.kind || "document";

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
      if (toolNeed?.workspaceInspect) {
        addToolStep("workspace_inspector", "workspace_inspect", "workspace_context");
      }
      if (webNeed) {
        addWebStep("artifact_research_context");
      }
      if (effectiveApiNeed && hasRequiredApiInputs(effectiveApiNeed)) {
        steps.push({
          type: "api",
          provider: "catalog:auto",
          capability: effectiveApiNeed.capability,
          routeKey: effectiveApiNeed.routeKey,
          purpose: "artifact_data_context"
        });
      }

      if (["dashboard", "workflow", "design", "benchmark", "campaign", "audio", "video"].includes(artifactShape)) {
        const structuredNoun =
          artifactShape === "dashboard"
            ? "dashboard surface"
            : artifactShape === "workflow"
              ? "workflow environment"
              : artifactShape === "design"
                ? "design wireframe"
                : artifactShape === "benchmark"
                  ? "benchmark workspace"
                  : artifactShape === "campaign"
                    ? "campaign workspace"
                    : artifactShape === "audio"
                      ? "audio production brief"
                      : "video production brief";
        const structuredInstruction =
          artifactShape === "dashboard"
            ? "Design a concrete analytics surface with KPIs, widgets, filters, charts, a table, and one clear operating use case."
            : artifactShape === "workflow"
              ? "Design a node-based automation workflow with triggers, ordered steps, links, outputs, and a concrete operator use case."
              : artifactShape === "design"
                ? "Design a wireframe environment with frames, layout hierarchy, palette, blocks, and a concrete user flow."
                : artifactShape === "benchmark"
                  ? "Design a structured competitive benchmark with criteria, competitors, scorecards, openings, and recommendations."
                  : artifactShape === "campaign"
                    ? "Design a launch or growth campaign with audience, promise, channels, assets, sequence and KPIs."
                    : artifactShape === "audio"
                      ? "Design an audio production brief with voice, pacing, cues, segments and deliverables."
                      : "Design a video production brief with scenes, storyboard, voiceover, on-screen copy and deliverables.";
        steps.push(
          llmStep(
            "reasoning",
            `${artifactShape}_spec`,
            attachmentAwareInstruction(
              `${structuredInstruction} Produce a grounded spec before drafting the ${structuredNoun}.`,
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_reasoning")
            }
          )
        );
        steps.push(
          llmStep(
            "code",
            `${artifactShape}_draft`,
            attachmentAwareInstruction(
              `Draft the requested ${structuredNoun} as structured JSON that is directly usable by Hydria. Avoid generic placeholders and keep the content domain-specific.`,
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_code")
            }
          )
        );
        if (multiAllowed) {
          steps.push(
            llmStep(
              "agent",
              `${artifactShape}_review`,
              attachmentAwareInstruction(
                `Review the ${structuredNoun} for usability, coherence, concrete content, and direct manipulability inside Hydria.`,
                attachments
              ),
              {
                modelChain: getProviderModelChain("premium_agent")
              }
            )
          );
        }
        steps.push({
          type: "artifact",
          provider: "local",
          purpose: "render_document",
          artifactType: artifactShape,
          format: artifactIntent?.format || "json"
        });
        break;
      }

      if (artifactShape === "image") {
        steps.push(
          llmStep(
            "reasoning",
            "image_spec",
            attachmentAwareInstruction(
              "Design the image brief first. Focus on composition, message, hierarchy, tone, and what must be visible immediately.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_reasoning")
            }
          )
        );
        steps.push(
          llmStep(
            "general",
            "image_draft",
            attachmentAwareInstruction(
              "Draft a visual brief in Markdown that can be rendered into a concrete visual asset. Avoid vague or generic style language.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("creative")
            }
          )
        );
        if (multiAllowed) {
          steps.push(
            llmStep(
              "agent",
              "image_review",
              attachmentAwareInstruction(
                "Review the visual brief for clarity, hierarchy, brand fit, and how well it can translate into a direct visual asset.",
                attachments
              ),
              {
                modelChain: getProviderModelChain("premium_agent")
              }
            )
          );
        }
        steps.push({
          type: "artifact",
          provider: "local",
          purpose: "render_document",
          artifactType: "image",
          format: artifactIntent?.format || "image"
        });
        break;
      }

      if (["spreadsheet", "dataset"].includes(artifactShape)) {
        steps.push(
          llmStep(
            "reasoning",
            "spreadsheet_spec",
            attachmentAwareInstruction(
              "Design the spreadsheet schema first. Be explicit about columns, row semantics, totals, and the most useful first view for the user.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_reasoning")
            }
          )
        );
        steps.push(
          llmStep(
            "general",
            "spreadsheet_draft",
            attachmentAwareInstruction(
              "Draft a concrete spreadsheet-ready result with real rows, headers, and useful structure. Do not answer with prose when a table is requested.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_general")
            }
          )
        );
        if (multiAllowed) {
          steps.push(
            llmStep(
              "agent",
              "spreadsheet_review",
              attachmentAwareInstruction(
                "Review the table for missing columns, ordering, usability, and immediate manipulatability inside Hydria.",
                attachments
              ),
              {
                modelChain: getProviderModelChain("premium_agent")
              }
            )
          );
        }
        steps.push({
          type: "artifact",
          provider: "local",
          purpose: "render_document",
          artifactType: "spreadsheet",
          format: artifactIntent?.format || "xlsx"
        });
        break;
      }

      if (artifactShape === "presentation") {
        steps.push(
          llmStep(
            "reasoning",
            "presentation_spec",
            attachmentAwareInstruction(
              "Design the slide story first. Focus on slide order, audience, narrative flow, and what each slide should make obvious immediately.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_reasoning")
            }
          )
        );
        steps.push(
          llmStep(
            "general",
            "presentation_draft",
            attachmentAwareInstruction(
              "Draft a real slide deck in Markdown slide structure. Use multiple slides with concrete titles and strong content, not a generic memo.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("creative")
            }
          )
        );
        if (multiAllowed) {
          steps.push(
            llmStep(
              "agent",
              "presentation_review",
              attachmentAwareInstruction(
                "Review the deck for clarity, persuasive flow, redundancy, and stakeholder readiness.",
                attachments
              ),
              {
                modelChain: getProviderModelChain("premium_agent")
              }
            )
          );
        }
        steps.push({
          type: "artifact",
          provider: "local",
          purpose: "render_document",
          artifactType: "presentation",
          format: artifactIntent?.format || "pptx"
        });
        break;
      }

      steps.push(
        llmStep(
          "reasoning",
          "generation_spec",
          attachmentAwareInstruction(
            "Design the requested artifact spec. Focus on title, sections, audience, structure, and what should be directly usable by the user.",
            attachments
          ),
          {
            modelChain: getProviderModelChain("premium_reasoning")
          }
        )
      );
      steps.push(
        llmStep(
          "general",
          "generation_draft",
          attachmentAwareInstruction(
            "Draft the requested document in clean, directly usable form with real structure and non-generic content.",
            attachments
          ),
          {
            modelChain: getProviderModelChain("premium_general")
          }
        )
      );
      if (multiAllowed) {
        steps.push(
          llmStep(
            "agent",
            "generation_review",
            attachmentAwareInstruction(
              "Review and improve the artifact for clarity, coherence, concrete usefulness, and direct usability inside Hydria.",
              attachments
            ),
            {
              modelChain: getProviderModelChain("premium_agent")
            }
          )
        );
      }
      steps.push({
        type: "artifact",
        provider: "local",
        purpose: "render_document",
        artifactType: artifactShape === "unknown" ? "document" : artifactShape,
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
              "Provide a secondary engineering review focused on directly observable bugs, edge cases, maintainability, and UI/debug risks when relevant.",
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
      steps.push(
        llmStep(
          "general",
          "direct_response",
          attachmentAwareInstruction(
            "Answer directly and naturally. Keep it concise unless the request clearly requires more depth.",
            attachments
          )
        )
      );
      break;
  }

  return {
    strategy: "free-first",
    taskPack: activeTaskPack,
    apiNeed: effectiveApiNeed,
    webNeed,
    toolNeed,
    steps
  };
}

export default {
  buildAgenticExecutionPlan
};
