import { Router } from "express";
import agenticConfig from "../src/config/agenticConfig.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import ProjectStore from "../src/projects/project.store.js";
import ProjectWorkspaceService from "../src/projects/projectWorkspaceService.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { AppError } from "../utils/errors.js";

const router = Router();
const projectStore = new ProjectStore({
  filePath: agenticConfig.files.projectStore
});
const workObjectService = new WorkObjectService({
  filePath: agenticConfig.files.workObjectStore,
  rootDir: agenticConfig.files.workObjectRoot,
  brainProvider: new HydriaBrainProvider(),
  projectStore
});
const workspaceService = new ProjectWorkspaceService({
  projectStore,
  workObjectService
});

router.get("/", (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const conversationId = req.query.conversationId ? Number(req.query.conversationId) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  res.json({
    success: true,
    projects: workspaceService.listProjects({
      userId,
      conversationId,
      limit
    })
  });
});

function handleWorkspaceRequest(req, res, next) {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const workspace = workspaceService.getWorkspace(req.params.projectId, {
      userId
    });

    if (!workspace) {
      throw new AppError("Project not found", 404);
    }

    res.json({
      success: true,
      workspace
    });
  } catch (error) {
    next(error);
  }
}

router.get("/:projectId", handleWorkspaceRequest);
router.get("/:projectId/workspace", handleWorkspaceRequest);

export default router;
