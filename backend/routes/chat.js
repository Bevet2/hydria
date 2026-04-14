import { Router } from "express";
import multer from "multer";
import { chatAttachmentUpload } from "../middleware/attachmentUpload.js";
import {
  assertChatPayload,
  extractAttachments
} from "../services/attachments/attachmentService.js";
import HydriaBrain from "../src/core/HydriaAutonomousBrain.js";
import { AppError } from "../utils/errors.js";

const router = Router();

router.post("/", (req, res, next) => {
  chatAttachmentUpload(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError) {
          throw new AppError(uploadError.message, 400);
        }

        throw uploadError;
      }

      const prompt = req.body?.prompt || "";
      const attachments = await extractAttachments(req.files || []);
      assertChatPayload(prompt, attachments);

      const result = await HydriaBrain.processChat({
        userId: req.body?.userId,
        conversationId: req.body?.conversationId,
        workObjectId: req.body?.workObjectId,
        workObjectPath: req.body?.workObjectPath,
        prompt,
        attachments
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });
});

export default router;
