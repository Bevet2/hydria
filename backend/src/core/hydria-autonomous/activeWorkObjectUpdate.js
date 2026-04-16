import { createExecutionLog, saveMessage } from "../../persistence/historyGateway.js";
import { durationMs } from "../../../utils/time.js";

export async function runActiveWorkObjectUpdate({
  brain,
  userId,
  conversation,
  prompt,
  startedAt,
  runtimeSession,
  activeWorkObject,
  activeWorkObjectEntry,
  intentProfile,
  environmentPlan,
  continuity
}) {
  const improved = await brain.workObjectService.improveObject({
    workObjectId: activeWorkObject.id,
    prompt,
    entryPath: activeWorkObjectEntry
  });

  const improvedWorkObject = improved.workObject;
  const classification =
    improvedWorkObject.objectKind === "project" || improvedWorkObject.objectKind === "code"
      ? "coding"
      : "artifact_generation";
  const activeProject = improvedWorkObject.projectId
    ? await brain.projectStore.updateProject(improvedWorkObject.projectId, (project) => ({
        activeWorkObjectId: improvedWorkObject.id,
        ...(improvedWorkObject.objectKind === "project" ? { status: "updated" } : {}),
        tasksHistory: [
          {
            prompt,
            updatedAt: new Date().toISOString(),
            mode: "active_work_object_update"
          },
          ...((project?.tasksHistory || []).slice(0, 24))
        ]
      }))
    : null;

  const finalAnswer = improved.finalAnswer;
  saveMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: finalAnswer,
    classification,
    routeUsed: "active_work_object_update"
  });

  createExecutionLog({
    conversationId: conversation.id,
    classification,
    executionPlan: {
      originalPrompt: prompt,
      resolvedPrompt: prompt,
      basePrompt: prompt,
      objective: {
        goal: prompt,
        classification,
        taskPack: "active_work_object_update",
        outcome: "update the selected work object"
      },
      agentic: {
        continuity,
        intentProfile,
        environmentPlan,
        workObject: {
          id: improvedWorkObject.id,
          title: improvedWorkObject.title,
          type: improvedWorkObject.type,
          objectKind: improvedWorkObject.objectKind,
          primaryFile: improvedWorkObject.primaryFile
        },
        project: activeProject
          ? {
              id: activeProject.id,
              name: activeProject.name,
              type: activeProject.type,
              status: activeProject.status,
              workspacePath: activeProject.workspacePath
            }
          : null,
        qualityPass: {
          mode: "active_work_object_update",
          debugTraceSummary: "Applied the prompt directly to the active work object."
        }
      }
    },
    durationMs: durationMs(startedAt),
    status: "success"
  });

  brain.sessionManager.updateState(runtimeSession.id, {
    phase: "evaluated",
    classification,
    activeProjectId: activeProject?.id || null
  });
  brain.sessionManager.completeSession(runtimeSession.id, {
    status: "completed",
    finalClassification: classification,
    criticScore: 78
  });

  return {
    handled: true,
    activeProject,
    activeWorkObject: improvedWorkObject,
    response: {
      success: true,
      conversationId: conversation.id,
      classification,
      strategy: "active_work_object_update",
      routing: {
        resolvedPrompt: prompt,
        usedHistory: false,
        reason: "active_work_object_update"
      },
      executionIntent: {
        readyToAct: true,
        confidence: 0.9,
        action: "update_active_work_object",
        reason: "active_object_selected"
      },
      strategySimulation: null,
      intentProfile,
      environmentPlan,
      environmentSimulation: null,
      projectTrajectory: null,
      businessSimulation: null,
      productPlanSimulation: null,
      impactSimulation: null,
      usageScenarioSimulation: null,
      projectContinuity: continuity,
      responseMode: "active_work_object_update",
      qualityPass: {
        mode: "active_work_object_update",
        debugTraceSummary: "Applied the prompt directly to the active work object."
      },
      eval: {
        status: "success",
        score: 78,
        issues: []
      },
      finalAnswer,
      modelsUsed: [],
      apisUsed: [],
      toolsUsed: ["active_work_object_update"],
      workObjects: brain.workObjectService.list({
        userId,
        conversationId: conversation.id
      }),
      activeWorkObject: improvedWorkObject,
      project: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            type: activeProject.type,
            status: activeProject.status,
            workspacePath: activeProject.workspacePath,
            dimensions: activeProject.dimensions || [],
            internalCapabilities: activeProject.internalCapabilities || [],
            globalProject: activeProject.globalProject || null
          }
        : null,
      meta: {
        usedJudge: false,
        durationMs: durationMs(startedAt),
        criticScore: 78
      }
    }
  };
}
