import { createExecutionLog, saveMessage } from "../../persistence/historyGateway.js";
import { durationMs } from "../../../utils/time.js";
import {
  executeWorkspaceToolCalls,
  synthesizeWorkspaceToolCallsFromPrompt
} from "../../../services/hydria/workspaceToolDispatcher.js";

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
  const current = brain.workObjectService.readContent({
    workObjectId: activeWorkObject.id,
    entryPath: activeWorkObjectEntry
  });
  const workspaceToolCalls = synthesizeWorkspaceToolCallsFromPrompt({
    prompt,
    activeWorkObject: {
      ...activeWorkObject,
      primaryFile: current.entryPath,
      workspaceFamilyId: activeWorkObject?.metadata?.workspaceFamilyId || activeWorkObject?.workspaceFamilyId || ""
    },
    activeWorkObjectContent: current.content
  });

  if (workspaceToolCalls.length) {
    const workspaceExecution = await executeWorkspaceToolCalls({
      calls: workspaceToolCalls,
      userId,
      prompt,
      confirmed: false,
      activeWorkObject: {
        ...activeWorkObject,
        primaryFile: current.entryPath
      },
      workObjectService: brain.workObjectService
    });
    const workspaceResult =
      workspaceExecution.results.find((result) => result.status === "completed") ||
      workspaceExecution.results[0] ||
      null;
    const updatedWorkObject = workspaceResult?.workObject || current.workObject || activeWorkObject;
    const classification = "artifact_generation";
    const completed = workspaceExecution.executed > 0;
    const activeProject = updatedWorkObject.projectId
      ? await brain.projectStore.updateProject(updatedWorkObject.projectId, (project) => ({
          activeWorkObjectId: updatedWorkObject.id,
          tasksHistory: [
            {
              prompt,
              updatedAt: new Date().toISOString(),
              mode: "workspace_tool_call"
            },
            ...((project?.tasksHistory || []).slice(0, 24))
          ]
        }))
      : null;
    const finalAnswer =
      workspaceResult?.finalAnswer ||
      [
        "Je n'ai pas pu appliquer l'operation workspace demandee.",
        ...(workspaceResult?.issues || [])
      ]
        .filter(Boolean)
        .join(" ");

    saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: finalAnswer,
      classification,
      routeUsed: "workspace_tool_call"
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
          taskPack: "workspace_tool_call",
          outcome: "update the selected workspace object"
        },
        agentic: {
          continuity,
          intentProfile,
          environmentPlan,
          workObject: {
            id: updatedWorkObject.id,
            title: updatedWorkObject.title,
            type: updatedWorkObject.type,
            objectKind: updatedWorkObject.objectKind,
            primaryFile: updatedWorkObject.primaryFile
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
          workspaceToolCalls,
          workspaceExecution,
          qualityPass: {
            mode: "workspace_tool_call",
            debugTraceSummary: completed
              ? "Applied the prompt through workspace tools on the active object."
              : "Workspace tool call produced no applied operation."
          }
        }
      },
      durationMs: durationMs(startedAt),
      status: completed ? "success" : "partial_success"
    });

    brain.sessionManager.updateState(runtimeSession.id, {
      phase: "evaluated",
      classification,
      activeProjectId: activeProject?.id || null
    });
    brain.sessionManager.completeSession(runtimeSession.id, {
      status: completed ? "completed" : "partial_success",
      finalClassification: classification,
      criticScore: completed ? 82 : 45
    });

    return {
      handled: true,
      activeProject,
      activeWorkObject: updatedWorkObject,
      response: {
        success: true,
        conversationId: conversation.id,
        classification,
        strategy: "workspace_tool_call",
        routing: {
          resolvedPrompt: prompt,
          usedHistory: false,
          reason: "workspace_tool_call"
        },
        executionIntent: {
          readyToAct: true,
          confidence: 0.95,
          action: "update_active_workspace_object",
          reason: "active_sheet_formula_request"
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
        responseMode: "workspace_tool_call",
        qualityPass: {
          mode: "workspace_tool_call",
          debugTraceSummary: completed
            ? "Applied the prompt through workspace tools on the active object."
            : "Workspace tool call produced no applied operation."
        },
        eval: {
          status: completed ? "success" : "partial_success",
          score: completed ? 82 : 45,
          issues: workspaceExecution.results.flatMap((result) => result.issues || [])
        },
        finalAnswer,
        modelsUsed: [],
        apisUsed: [],
        toolsUsed: [
          "workspace_tool_call",
          ...new Set(workspaceToolCalls.map((call) => call.payload?.toolName).filter(Boolean))
        ],
        workspaceToolCalls,
        workspaceToolResults: workspaceExecution.results,
        execution: {
          executed: workspaceExecution.executed,
          results: workspaceExecution.results,
          workspaceToolResults: workspaceExecution.results
        },
        workObjects: brain.workObjectService.list({
          userId,
          conversationId: conversation.id
        }),
        activeWorkObject: updatedWorkObject,
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
          criticScore: completed ? 82 : 45
        }
      }
    };
  }

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
