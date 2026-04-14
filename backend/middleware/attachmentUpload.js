import multer from "multer";
import config from "../config/hydria.config.js";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    files: config.attachments.maxFiles,
    fileSize: config.attachments.maxFileSizeBytes
  }
});

export const chatAttachmentUpload = upload.array(
  "attachments",
  config.attachments.maxFiles
);

