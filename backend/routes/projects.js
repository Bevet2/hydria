import { Router } from "express";
import agenticConfig from "../src/config/agenticConfig.js";
import HydriaBrainProvider from "../src/core/HydriaBrainProvider.js";
import ProjectStore from "../src/projects/project.store.js";
import ProjectWorkspaceService from "../src/projects/projectWorkspaceService.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import { AppError } from "../utils/errors.js";
import { db } from "../db/sqlite.js";
import { IdentitySessionStore } from "../services/identity/identitySessionStore.js";
import { requireVerifiedIdentity } from "./identity.js";

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
const requireAccount = requireVerifiedIdentity(new IdentitySessionStore(db));

// Authenticated alternatives for the future multi-account UI. Older endpoints
// remain private-pilot only until every write and asset route is migrated.
router.get("/mine", requireAccount, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    projects: workspaceService.listProjects({ userId: req.hydriaIdentity.id })
  });
});

function handleVerifiedWorkspace(req, res, next) {
  try {
    const workspace = workspaceService.getWorkspace(req.params.projectId, {
      userId: req.hydriaIdentity.id,
      redactSharedProjectMetadata: true
    });
    if (!workspace) throw new AppError("Project not found", 404);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, workspace });
  } catch (error) {
    next(error);
  }
}

router.get("/mine/:projectId", requireAccount, handleVerifiedWorkspace);
router.get("/mine/:projectId/workspace", requireAccount, handleVerifiedWorkspace);

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
