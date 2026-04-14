import { Router } from "express";
import { getGeneratedArtifactById } from "../services/artifacts/generationStorageService.js";
import { AppError } from "../utils/errors.js";

const router = Router();

router.get("/:artifactId/download", async (req, res, next) => {
  try {
    const artifact = await getGeneratedArtifactById(req.params.artifactId);

    if (!artifact) {
      throw new AppError("Generated artifact not found", 404);
    }

    res.setHeader("Content-Type", artifact.mimeType || "application/octet-stream");
    res.download(artifact.absolutePath, artifact.filename);
  } catch (error) {
    next(error);
  }
});

export default router;
