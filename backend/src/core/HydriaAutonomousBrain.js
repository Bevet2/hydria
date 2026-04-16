import { AppError } from "../../utils/errors.js";
import logger from "../../utils/logger.js";
import { durationMs } from "../../utils/time.js";
import { synthesizeAnswers } from "./agenticSynthesizer.js";
import {
  createConversation,
  createExecutionLog,
  deriveConversationTitle,
  ensureConversationForUser,
  getLatestExecutionLog,
  getUserById,
  maybeUpdateConversationTitle,
  saveMessage
} from "../persistence/historyGateway.js";
import {
  storeUsefulMemory,
  summarizeConversationIfNeeded
} from "../memory/sqliteMemoryGateway.js";
import {
  buildAttachmentToolMessage,
  buildUserMessageContent,
  derivePromptFromAttachments,
  serializeAttachmentsForClient
} from "../attachments/attachmentGateway.js";
import agenticConfig from "../config/agenticConfig.js";
import { fallbackToLegacyChat } from "./legacyFallbackAdapter.js";
import { applyResponseQualityPass } from "./responseQualityPass.js";
import { extractLearningFromTask } from "../learning/learning.extractor.js";
import {
  detectTaskSubdomain,
  detectTaskType,
  summarizeLearningUsage
} from "../learning/learning.reuse.js";
import { detectProjectIntent, updateProjectAfterTask } from "../projects/project.lifecycle.js";
import { extractIntentProfile } from "./intentKernel.js";
import { planEnvironment, inferEnvironmentObjectKind } from "./environmentPlanner.js";
import { resolveProjectContinuity } from "./projectContinuity.js";
import { buildProjectGraph } from "../projects/projectGraph.js";
import { buildHydriaAutonomousDependencies } from "./hydria-autonomous/bootstrap.js";
import {
  buildBasePromptForExecution,
  clonePlan,
  dedupeAttachmentEvidence,
  dedupeLearningItems,
  findArtifactGeneratorToolResult,
  findGitAgentResult,
  findProjectBuilderToolResult,
  finalizeUserAnswer,
  resolveActiveWorkObjectEntry,
  shouldApplyPromptToActiveWorkObject
} from "./hydria-autonomous/helpers.js";
import { runActiveWorkObjectUpdate } from "./hydria-autonomous/activeWorkObjectUpdate.js";
import {
  finalizeAgenticFailure,
  finalizeAgenticSuccess
} from "./hydria-autonomous/finalization.js";

class HydriaAutonomousBrain {
  constructor() {
    Object.assign(this, buildHydriaAutonomousDependencies());
    this.learningMaintenancePromise = this.learningMigration.runMaintenance({
      maxChanges: 50
    }).catch((error) => {
      logger.warn("Hydria learning maintenance failed at startup", {
        error: error.message
      });
      return null;
    });
  }

  async ingestExecutionKnowledge({ userId, conversationId, execution, phase }) {
    if (!agenticConfig.enableKnowledgeIngestion || !execution) {
      return {
        phase,
        webInserted: 0,
        gitInserted: 0,
        errors: []
      };
    }

    const summary = {
      phase,
      webInserted: 0,
      gitInserted: 0,
      errors: []
    };

    try {
      if (execution.webResults?.length) {
        const result = await this.knowledgeStore.ingestWebResults({
          userId,
          conversationId,
          webResults: execution.webResults
        });
        summary.webInserted = result.inserted || 0;
      }
    } catch (error) {
      summary.errors.push(`web:${error.message}`);
      logger.warn("Hydria knowledge ingestion failed for web results", {
        error: error.message,
        userId,
        conversationId,
        phase
      });
    }

    try {
      const gitResult = findGitAgentResult(execution.toolResults);
      if (gitResult) {
        const result = await this.knowledgeStore.ingestGitHubResults({
          userId,
          conversationId,
          gitResult
        });
        summary.gitInserted = result.inserted || 0;
      }
    } catch (error) {
      summary.errors.push(`git:${error.message}`);
      logger.warn("Hydria knowledge ingestion failed for git results", {
        error: error.message,
        userId,
        conversationId,
        phase
      });
    }

    return summary;
  }

  async processChat({
    userId,
    conversationId,
    prompt,
    attachments = [],
    workObjectId = null,
    workObjectPath = ""
  }) {
    if (!agenticConfig.enabled) {
      return fallbackToLegacyChat({
        userId,
        conversationId,
        prompt,
        attachments
      });
    }

    const startedAt = Date.now();

    if (!userId) {
      throw new AppError("userId is required", 400);
    }

    const effectivePrompt =
      String(prompt || "").trim() || derivePromptFromAttachments(attachments);

    if (!effectivePrompt) {
      throw new AppError("prompt is required", 400);
    }

    const user = getUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    let activeWorkObject = workObjectId ? this.workObjectService.get(String(workObjectId)) : null;
    if (activeWorkObject && Number(activeWorkObject.userId) && Number(activeWorkObject.userId) !== Number(userId)) {
      throw new AppError("Work object does not belong to this user", 403);
    }

    if (this.learningMaintenancePromise) {
      await this.learningMaintenancePromise;
      this.learningMaintenancePromise = null;
    }

    let conversation = conversationId
      ? ensureConversationForUser(conversationId, userId)
      : createConversation({
          userId,
          title: deriveConversationTitle(effectivePrompt)
        });

    const runtimeSession = this.sessionManager.startSession({
      userId,
      conversationId: conversation.id,
      prompt: effectivePrompt
    });

    try {
      saveMessage({
        conversationId: conversation.id,
        role: "user",
        content: buildUserMessageContent(effectivePrompt, attachments),
        routeUsed: "agentic_entry"
      });
      conversation =
        maybeUpdateConversationTitle(conversation.id, effectivePrompt) || conversation;

      const latestExecution = getLatestExecutionLog(conversation.id);
      const continuity = resolveProjectContinuity({
        prompt: effectivePrompt,
        userId,
        conversationId: conversation.id,
        activeWorkObject,
        latestExecution,
        workObjectService: this.workObjectService,
        projectStore: this.projectStore
      });
      if (!activeWorkObject && continuity.activeWorkObject) {
        activeWorkObject = continuity.activeWorkObject;
      }
      const earlyIntentProfile = extractIntentProfile({
        prompt: effectivePrompt,
        attachments,
        activeWorkObject
      });
      const earlyEnvironmentPlan = planEnvironment({
        intentProfile: earlyIntentProfile,
        classification: "pending",
        projectContext:
          activeWorkObject?.projectId || continuity.activeProject?.id
            ? {
                isProjectTask: true,
                linkedProjectId: activeWorkObject?.projectId || continuity.activeProject?.id || "",
                linkedWorkObjectId: activeWorkObject?.id || "",
                nameHint: activeWorkObject?.title || continuity.activeProject?.name || ""
              }
            : null,
        activeWorkObject
      });
      const preparation = await this.memoryAgent.prepare({
        userId,
        conversationId: conversation.id,
        prompt: effectivePrompt,
        attachments
      });
      this.sessionManager.updateState(runtimeSession.id, {
        phase: "prepared",
        memoryRecall: preparation.memorySummary,
        attachmentCount: attachments.length,
        activeWorkObjectId: activeWorkObject?.id || null
      });

      const activeWorkObjectEntry = resolveActiveWorkObjectEntry(activeWorkObject, workObjectPath);
      if (
        shouldApplyPromptToActiveWorkObject({
          prompt: effectivePrompt,
          activeWorkObject,
          attachments,
          intentProfile: earlyIntentProfile
        }) &&
        activeWorkObjectEntry
      ) {
        const activeWorkObjectUpdate = await runActiveWorkObjectUpdate({
          brain: this,
          userId,
          conversation,
          prompt: effectivePrompt,
          startedAt,
          runtimeSession,
          activeWorkObject,
          activeWorkObjectEntry,
          intentProfile: earlyIntentProfile,
          environmentPlan: earlyEnvironmentPlan,
          continuity
        });
        return activeWorkObjectUpdate.response;
      }

      const planning = await this.orchestratorAgent.execute({
        prompt: effectivePrompt,
        attachments,
        latestExecution,
        activeWorkObject,
        projectContinuity: continuity,
        internalCapabilityProfiles: this.internalCapabilityProfiles
      });

      const routingPrompt = planning.resolvedPrompt || effectivePrompt;
      const basePrompt = buildBasePromptForExecution(
        latestExecution,
        planning.routing,
        effectivePrompt,
        routingPrompt
      );
      const executedPlan = clonePlan(planning.plan);
      const projectContext = planning.projectContext || detectProjectIntent({
        prompt: routingPrompt,
        classification: planning.classification
      });
      const projectType =
        planning.domainProfile?.id === "github_research" ? "external" : "internal";
      const shouldKeepConversationInsideProject =
        planning.executionIntent?.readyToAct &&
        ["project_scaffold", "environment_create", "environment_update", "environment_transform"].includes(
          planning.executionIntent?.action || ""
        );
      const shouldTrackProject =
        Boolean(planning.strategyDecision?.enableProjectBuilder) ||
        Boolean(continuity.activeProject?.id) ||
        shouldKeepConversationInsideProject ||
        Boolean(planning.environmentPlan?.continueCurrentProject) ||
        Boolean(planning.workspaceRouting?.targetProjectId) ||
        ["extend_current_project", "create_new_project"].includes(
          planning.environmentPlan?.projectOperation || ""
        );
      let activeProject = null;
      if (shouldTrackProject) {
        const forceNewProject = planning.environmentPlan?.projectOperation === "create_new_project";
        activeProject = forceNewProject
          ? null
          : continuity.activeProject ||
            (projectContext.linkedProjectId &&
              this.projectStore.getProject(projectContext.linkedProjectId)) ||
            null;

        if (!activeProject) {
          const projectName =
            projectContext.nameHint && projectContext.nameHint !== "project"
              ? projectContext.nameHint
              : deriveConversationTitle(routingPrompt).replace(/\s+/g, "-").toLowerCase();
          activeProject = await this.projectStore.ensureProject({
            name: projectName,
            type: projectType,
            workspacePath: this.projectBuilder.createProjectWorkspace({
              projectName,
              projectId: conversation.id
            }),
            metadata: {
              conversationId: conversation.id,
              userId,
              intentProfile: planning.intentProfile || null,
              environmentPlan: planning.environmentPlan || null,
              workspaceRouting: planning.workspaceRouting || null,
              environmentSimulation: planning.environmentSimulation || null,
              projectTrajectory: planning.projectTrajectory || null,
              businessSimulation: planning.businessSimulation || null,
              productPlanSimulation: planning.productPlanSimulation || null,
              impactSimulation: planning.impactSimulation || null,
              usageScenarioSimulation: planning.usageScenarioSimulation || null,
              projectContinuity: continuity || null
            }
          });
        }

        if (planning.globalProjectContext && activeProject?.id) {
          activeProject =
            (await this.projectStore.updateProject(
              activeProject.id,
              this.globalProjectService.buildProjectPatch(activeProject, planning.globalProjectContext, {
                conversationId: conversation.id,
                internalCapabilities: planning.globalProjectContext.internalCapabilityIds
              })
            )) || activeProject;
        }

        if (activeProject?.id) {
          activeProject =
            (await this.projectStore.updateProject(activeProject.id, (project) => ({
              metadata: {
                ...(project.metadata || {}),
                intentProfile: planning.intentProfile || null,
                environmentPlan: planning.environmentPlan || null,
                workspaceRouting: planning.workspaceRouting || null,
                environmentSimulation: planning.environmentSimulation || null,
                projectTrajectory: planning.projectTrajectory || null,
                businessSimulation: planning.businessSimulation || null,
                productPlanSimulation: planning.productPlanSimulation || null,
                impactSimulation: planning.impactSimulation || null,
                usageScenarioSimulation: planning.usageScenarioSimulation || null,
                projectContinuity: continuity || null
              }
            }))) || activeProject;
        }
      }

      const prefersProjectShellContext =
        activeProject?.id &&
        activeWorkObject &&
        activeWorkObject.objectKind !== "project" &&
        ["environment_create", "environment_transform", "project_scaffold"].includes(
          planning.executionIntent?.action || ""
        ) &&
        /\b(ce projet|dans ce projet|pour ce projet|this project|in this project|for this project|cette app|cette application|this app|this application)\b/i.test(
          routingPrompt
        );

      let activeWorkObjectForExecution = activeWorkObject;
      let activeWorkObjectContentForExecution = this.workObjectService.getPrimaryContent(
        activeWorkObject,
        workObjectPath || activeWorkObject?.primaryFile || ""
      );

      if (prefersProjectShellContext) {
        const projectShell = this.workObjectService
          .listForProject({
            projectId: activeProject.id,
            userId,
            limit: 50
          })
          .find((item) => item.objectKind === "project");

        if (projectShell) {
          activeWorkObjectForExecution = projectShell;
          activeWorkObjectContentForExecution = this.workObjectService.getPrimaryContent(
            projectShell,
            projectShell.primaryFile || ""
          );
        }
      }

      if (activeWorkObjectForExecution?.objectKind === "project") {
        const appConfigPath =
          activeWorkObjectForExecution.files?.find((file) =>
            /(^|\/)app\.config\.json$/i.test(String(file?.path || ""))
          )?.path || "";

        if (appConfigPath) {
          const appConfigContent = this.workObjectService.getPrimaryContent(
            activeWorkObjectForExecution,
            appConfigPath
          );

          if (appConfigContent) {
            activeWorkObjectContentForExecution = appConfigContent;
          }
        }
      }

      const execution = await this.executorAgent.execute({
        userId,
        conversationId: conversation.id,
        prompt: routingPrompt,
        attachments,
        classification: planning.classification,
        plan: executedPlan,
        taskPack: planning.taskPack,
        domainProfile: planning.domainProfile,
        routing: planning.routing,
        memoryRecall: preparation.memoryRecall,
        sessionId: runtimeSession.id,
        reusedLearnings: planning.reusedLearnings || [],
        learningGuidance: planning.learningGuidance || "",
        projectType,
        strategyDecision: planning.strategyDecision || null,
        executionIntent: planning.executionIntent || null,
        project: activeProject,
        globalProjectContext: planning.globalProjectContext || null,
        activeWorkObject: activeWorkObjectForExecution,
        activeWorkObjectContext: activeWorkObjectForExecution
          ? this.workObjectService.buildContext({
              ...activeWorkObjectForExecution,
              selectedPath: workObjectPath || activeWorkObjectForExecution.primaryFile || ""
            })
          : "",
        activeWorkObjectContent: activeWorkObjectContentForExecution
      });
      const initialExecutionKnowledge = await this.ingestExecutionKnowledge({
        userId,
        conversationId: conversation.id,
        execution,
        phase: "first_pass"
      });
      this.sessionManager.updateState(runtimeSession.id, {
        phase: "executed",
        classification: planning.classification,
        objective: executedPlan.objective,
        toolCount: execution.toolsUsed.length,
        modelCount: execution.modelsUsed.length,
        knowledgeIngestion: initialExecutionKnowledge
      });

      const uniqueAttachmentEvidenceUsed = dedupeAttachmentEvidence(
        execution.attachmentEvidenceUsed
      );

      const synthesis = applyResponseQualityPass(
        execution.finalAnswerOverride
          ? {
            finalAnswer: execution.finalAnswerOverride,
            sources: execution.candidates
              .filter((candidate) => candidate.type === "llm")
              .map((candidate) => ({
                type: candidate.type,
                provider: candidate.provider,
                model: candidate.model,
                capability: null
              })),
            selectedCandidates: execution.candidates,
            judge: {
              usedJudge: false,
              mode: execution.finalAnswerMode || "agentic_artifact",
              score: 0,
              confidence: "n/a",
              decision: execution.finalAnswerMode || "artifact_generation",
              issues: [],
              candidateEvaluations: []
            }
          }
          : synthesizeAnswers(execution.candidates, {
            classification: planning.classification,
            taskPack: planning.taskPack,
            prompt: routingPrompt,
            plan: executedPlan,
            domainProfile: planning.domainProfile,
            attachments,
            attachmentEvidenceUsed: uniqueAttachmentEvidenceUsed,
            preferencesUsed: execution.preferencesUsed,
            memoryUsed: execution.memoryUsed,
            artifacts: execution.artifacts,
            apiResults: execution.apiResults,
            webResults: execution.webResults,
            toolResults: execution.toolResults,
            routingResolution: planning.routing,
            followUpActions: execution.followUpActions
          }),
        {
          classification: planning.classification,
          prompt: routingPrompt,
          domainProfile: planning.domainProfile,
          apiResults: execution.apiResults,
          webResults: execution.webResults,
          toolResults: execution.toolResults,
          attachments,
          taskPack: planning.taskPack,
          routingResolution: planning.routing,
          reusedLearnings: planning.reusedLearnings || [],
          strategyDecision: planning.strategyDecision || null
        }
      );

      const finalAnswer = synthesis.finalAnswer;
      const critique = await this.criticAgent.execute({
        prompt: routingPrompt,
        classification: planning.classification,
        domainProfile: planning.domainProfile,
        plan: {
          ...executedPlan,
          steps: execution.executionSteps
        },
        finalAnswer,
        execution
      });

      let activeExecution = execution;
      let activeSynthesis = synthesis;
      let activeCritique = critique;
      let activePlan = {
        ...executedPlan,
        steps: execution.executionSteps
      };

      const improvement = await this.evolutionLoop.maybeImprove({
        userId,
        conversationId: conversation.id,
        prompt: routingPrompt,
        attachments,
        classification: planning.classification,
        taskPack: planning.taskPack,
        routing: planning.routing,
        memoryRecall: preparation.memoryRecall,
        plan: activePlan,
        domainProfile: planning.domainProfile,
        firstPass: execution,
        firstSynthesis: synthesis,
        firstCritique: critique,
        sessionId: runtimeSession.id,
        reusedLearnings: planning.reusedLearnings || [],
        learningGuidance: planning.learningGuidance || "",
        projectType,
        strategyDecision: planning.strategyDecision || null
      });

      if (improvement?.comparison?.winner === "second") {
        activeExecution = improvement.retryExecution;
        activeSynthesis = improvement.retrySynthesis;
        activeCritique = improvement.retryCritique;
        activePlan = {
          ...improvement.improvedPlan,
          steps: improvement.retryExecution.executionSteps
        };
      }

      const finalExecution = {
        ...activeExecution,
        improvementDelta:
          improvement?.comparison?.winner === "second"
            ? Number(improvement.comparison?.delta || 0)
            : 0,
        reusedLearnings: planning.reusedLearnings || []
      };
      const finalSynthesis = activeSynthesis;
      const finalPlan = activePlan;
      const finalCritique = await this.criticAgent.execute({
        prompt: routingPrompt,
        classification: planning.classification,
        domainProfile: planning.domainProfile,
        plan: {
          ...finalPlan,
          steps: finalExecution.executionSteps
        },
        finalAnswer: finalSynthesis.finalAnswer,
        execution: finalExecution
      });
      const learningTaskContext = {
        prompt: routingPrompt,
        classification: planning.classification,
        domain: planning.domainProfile?.id || planning.classification,
        subdomain:
          planning.taskSubdomain ||
          finalPlan.taskSubdomain ||
          detectTaskSubdomain({
            prompt: routingPrompt,
            classification: planning.classification,
            domain: planning.domainProfile?.id || planning.classification
          }),
        taskType:
          planning.taskType ||
          finalPlan.taskType ||
          detectTaskType({
            prompt: routingPrompt,
            classification: planning.classification,
            domain: planning.domainProfile?.id || planning.classification
          })
      };
      const learningCandidates = dedupeLearningItems([
        ...(finalExecution.learningCandidates || []),
        ...(finalExecution.toolResults || []).flatMap((result) => result.learningCandidates || []),
        ...(improvement?.learningCandidates || []),
        ...extractLearningFromTask(
          {
            plan: finalPlan,
            executionSteps: finalExecution.executionSteps,
            artifacts: finalExecution.artifacts,
            critique: finalCritique
          },
          {
            kind: "execution",
            ...learningTaskContext,
            conversationId: conversation.id,
            project: "hydria",
            projectType: planning.domainProfile?.id === "github_research" ? "external" : "internal"
          }
        )
      ]);
      const storedLearnings =
        agenticConfig.learning.enabled && learningCandidates.length
          ? await this.learningStore.addLearningItems(learningCandidates)
          : [];
      if (storedLearnings.length) {
        await this.patternLibrary.ingestLearnings(storedLearnings);
      }
      if (agenticConfig.learning.enabled && (planning.reusedLearnings || []).length) {
        await this.learningStore.updateUsageBatch(planning.reusedLearnings, {
          success: (finalCritique?.score || 0) >= agenticConfig.minCriticScoreForSuccess,
          taskContext: learningTaskContext
        });
      }
      let finalAnswerAfterEvolution = finalizeUserAnswer(
        finalSynthesis,
        planning.reusedLearnings || [],
        planning.classification
      );
      const finalAttachmentEvidence = dedupeAttachmentEvidence(
        finalExecution.attachmentEvidenceUsed
      );
      const finalExecutionKnowledge = await this.ingestExecutionKnowledge({
        userId,
        conversationId: conversation.id,
        execution: finalExecution,
        phase: "final_pass"
      });
      const projectBuilderToolResult = findProjectBuilderToolResult(finalExecution.toolResults);
      const projectBuilderReport =
        projectBuilderToolResult?.raw ||
        (activeProject && planning.strategyDecision?.enableProjectBuilder
          ? await this.projectBuilder.run({
              project: activeProject,
              critique: finalCritique
            })
          : null);
      const deliveryReport =
        projectBuilderToolResult?.normalized?.delivery ||
        projectBuilderReport?.delivery ||
        null;
      const fallbackDeliveryReport =
        !deliveryReport && projectBuilderReport?.workspacePath
          ? {
              status: projectBuilderReport?.action === "project_delivery" ? "scaffolded" : "draft",
              workspacePath: projectBuilderReport.workspacePath,
              install: { status: "skipped" },
              run: { status: "skipped" },
              validation: { status: "skipped", issues: [] },
              correctionsApplied: [],
              export:
                projectBuilderReport?.exportArtifactId && projectBuilderReport?.exportDownloadUrl
                  ? {
                      artifactId: projectBuilderReport.exportArtifactId,
                      downloadUrl: projectBuilderReport.exportDownloadUrl,
                      filename: projectBuilderReport.exportFilename || ""
                    }
                  : null,
              mainFiles:
                projectBuilderReport?.mainFiles ||
                projectBuilderReport?.createdFiles ||
                [],
              nextCommand:
                projectBuilderReport?.nextCommand ||
                projectBuilderReport?.nextCommands?.[0] ||
                "",
              deliveryManifestPath:
                projectBuilderReport?.deliveryManifestPath ||
                projectBuilderReport?.manifestPath ||
                ""
            }
          : null;
      const effectiveDeliveryReport = deliveryReport || fallbackDeliveryReport;
      if (activeProject) {
        activeProject = await this.projectStore.updateProject(
          activeProject.id,
          updateProjectAfterTask(activeProject, {
            task: routingPrompt,
            criticScore: finalCritique.score || 0,
            buildStatus: projectBuilderReport?.build?.status || "skipped",
            testStatus: projectBuilderReport?.test?.status || "skipped",
            learnings: storedLearnings,
            delivery: effectiveDeliveryReport
          })
        );
      }
      const workObjectsCreated = [];
      const sourceWorkObjectBeforeDelivery =
        activeWorkObject && activeWorkObject.objectKind !== "project"
          ? activeWorkObject
          : null;
      if (effectiveDeliveryReport && activeProject) {
        const projectWorkObject = await this.workObjectService.registerProjectDelivery({
          userId,
          conversationId: conversation.id,
          project: activeProject,
          delivery: effectiveDeliveryReport,
          prompt: routingPrompt,
          sourceWorkObjectId: sourceWorkObjectBeforeDelivery?.id || "",
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null
        });
        if (projectWorkObject) {
          activeWorkObject = projectWorkObject;
          workObjectsCreated.push(projectWorkObject);
        }
      }
      const artifactGeneratorToolResult = findArtifactGeneratorToolResult(finalExecution.toolResults);
      const artifactSourceDocument =
        artifactGeneratorToolResult?.artifactResult?.sourceDocument ||
        artifactGeneratorToolResult?.normalized?.sourceDocument ||
        null;
      const generatedArtifactForObject =
        (artifactGeneratorToolResult?.artifacts || []).find(
          (artifact) => artifact.type === "generated_file"
        ) || null;

      if (generatedArtifactForObject) {
        const projectShellWorkObject = activeProject?.id
          ? this.workObjectService
              .listForProject({
                projectId: activeProject.id,
                userId,
                limit: 50
              })
              .find((item) => item.objectKind === "project") || null
          : null;
        const artifactExecutionSource =
          activeWorkObjectForExecution ||
          activeWorkObject ||
          projectShellWorkObject ||
          null;
        const explicitSiblingDerivation =
          planning.workspaceRouting?.createSiblingObject &&
          artifactExecutionSource &&
          artifactExecutionSource.objectKind !== "project";
        const shouldReuseActiveWorkObject =
          planning.executionIntent?.action === "environment_update" &&
          artifactExecutionSource &&
          !explicitSiblingDerivation &&
          [
            "document",
            "presentation",
            "dataset",
            "dashboard",
            "workflow",
            "design",
            "benchmark",
            "campaign",
            "image",
            "audio",
            "video"
          ].includes(
            artifactExecutionSource.objectKind
          );
        const sourceWorkObjectForArtifact = shouldReuseActiveWorkObject
          ? null
          : planning.executionIntent?.action === "environment_transform" ||
              explicitSiblingDerivation
            ? artifactExecutionSource
            : projectShellWorkObject ||
              artifactExecutionSource ||
              null;
        const artifactWorkObject = await this.workObjectService.registerGeneratedArtifact({
          userId,
          conversationId: conversation.id,
          prompt: routingPrompt,
          artifact: generatedArtifactForObject,
          sourceDocument: artifactSourceDocument,
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null,
          existingWorkObjectId: shouldReuseActiveWorkObject ? artifactExecutionSource.id : "",
          sourceWorkObjectId: sourceWorkObjectForArtifact?.id || "",
          projectId:
            activeProject?.id ||
            artifactExecutionSource?.projectId ||
            continuity.activeProject?.id ||
            ""
        });
        if (artifactWorkObject) {
          activeWorkObject = artifactWorkObject;
          workObjectsCreated.push(artifactWorkObject);
        }
      }

      if (!activeProject && projectBuilderReport?.workspacePath) {
        const recoveredProject = this.projectStore
          .listProjects({ userId, conversationId: conversation.id, limit: 20 })
          .find(
            (projectItem) =>
              projectItem.workspacePath === projectBuilderReport.workspacePath ||
              projectItem.name === projectBuilderReport.projectName
          );
        if (recoveredProject) {
          activeProject = recoveredProject;
        }
      }

      if (!activeWorkObject && activeProject?.id) {
        const recoveredProjectObject =
          this.workObjectService
            .listForProject({
              projectId: activeProject.id,
              userId,
              limit: 20
            })
            .find((item) => item.objectKind === "project") || null;
        if (recoveredProjectObject) {
          activeWorkObject = recoveredProjectObject;
        }
      }

      if (!activeWorkObject && effectiveDeliveryReport && activeProject?.id) {
        const recoveredProjectWorkObject = await this.workObjectService.registerProjectDelivery({
          userId,
          conversationId: conversation.id,
          project: activeProject,
          delivery: effectiveDeliveryReport,
          prompt: routingPrompt,
          sourceWorkObjectId: sourceWorkObjectBeforeDelivery?.id || "",
          intentProfile: planning.intentProfile || null,
          environmentPlan: planning.environmentPlan || null,
          environmentSimulation: planning.environmentSimulation || null,
          businessSimulation: planning.businessSimulation || null,
          productPlanSimulation: planning.productPlanSimulation || null,
          impactSimulation: planning.impactSimulation || null,
          usageScenarioSimulation: planning.usageScenarioSimulation || null
        });
        if (recoveredProjectWorkObject) {
          activeWorkObject = recoveredProjectWorkObject;
          workObjectsCreated.push(recoveredProjectWorkObject);
        }
      }

      if (planning.executionIntent?.readyToAct && !activeWorkObject) {
        logger.warn("Hydria execution request produced no visible work object", {
          conversationId: conversation.id,
          userId,
          prompt: routingPrompt,
          classification: planning.classification,
          projectId: activeProject?.id || null,
          strategy: planning.strategyDecision?.chosenStrategy || null
        });
      }

      this.evolutionOptimizer.recordOutcome({
        domain: planning.domainProfile?.id || planning.classification,
        classification: planning.classification,
        strategyId:
          planning.strategyDecision?.chosenStrategy ||
          executedPlan.strategy ||
          planning.classification,
        activeAgents:
          planning.orchestration?.activeAgents ||
          planning.strategyDecision?.selectedAgents ||
          [],
        score: finalCritique.score || 0,
        delta: Number(finalExecution.improvementDelta || 0)
      });
      this.sessionManager.updateState(runtimeSession.id, {
        phase: "evaluated",
        criticScore: finalCritique.score || 0,
        evolutionWinner: improvement?.comparison?.winner || "first",
        evolutionStrategy: improvement?.strategy?.id || null,
        finalKnowledgeIngestion: finalExecutionKnowledge,
        learningStored: storedLearnings.length,
        learningUsed: (planning.reusedLearnings || []).length,
        activeProjectId: activeProject?.id || null
      });

      if (activeProject?.id) {
        const latestProject = this.projectStore.getProject(activeProject.id) || activeProject;
        const projectWorkObjects = this.workObjectService.listForProject({
          projectId: latestProject.id,
          userId,
          limit: 100
        });
        const projectGraph = buildProjectGraph({
          project: {
            ...latestProject,
            activeWorkObjectId: activeWorkObject?.id || latestProject.activeWorkObjectId || ""
          },
          workObjects: projectWorkObjects
        });
        activeProject =
          (await this.projectStore.updateProject(latestProject.id, {
            activeWorkObjectId: activeWorkObject?.id || latestProject.activeWorkObjectId || "",
            workspaceFamilies: projectGraph.workspaceFamilies,
            graph: projectGraph,
            metadata: {
              ...(latestProject.metadata || {}),
              workspaceRouting: planning.workspaceRouting || null
            }
          })) || latestProject;
      }

      return finalizeAgenticSuccess({
        brain: this,
        userId,
        conversation,
        startedAt,
        runtimeSession,
        effectivePrompt,
        routingPrompt,
        basePrompt,
        attachments,
        preparation,
        planning,
        continuity,
        activeWorkObject,
        activeProject,
        finalExecution,
        finalSynthesis,
        finalCritique,
        finalAnswerAfterEvolution,
        finalPlan,
        finalAttachmentEvidence,
        initialExecutionKnowledge,
        finalExecutionKnowledge,
        improvement,
        storedLearnings,
        projectBuilderReport,
        effectiveDeliveryReport
      });
    } catch (error) {
      await finalizeAgenticFailure({
        brain: this,
        runtimeSession,
        conversation,
        effectivePrompt,
        startedAt,
        userId,
        error
      });

      if (agenticConfig.useLegacyFallback) {
        logger.warn("Falling back to legacy HydriaBrain after agentic failure", {
          conversationId: conversation.id
        });
        return fallbackToLegacyChat({
          userId,
          conversationId: conversation.id,
          prompt: effectivePrompt,
          attachments,
          skipUserMessagePersist: true
        });
      }

      throw error;
    } finally {
      try {
        await this.runtimeAdapter.closeBrowserSession(runtimeSession.id);
      } catch (closeError) {
        logger.warn("Hydria runtime session cleanup failed", {
          sessionId: runtimeSession.id,
          error: closeError.message
        });
      }
    }
  }
}

const hydriaAutonomousBrain = new HydriaAutonomousBrain();

export default hydriaAutonomousBrain;
