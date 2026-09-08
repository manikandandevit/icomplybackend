import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "./s3.client.js";
import { AppError } from "../errors/AppError.js";
import { s3PublicUrl } from "../../modules/Companies/companies.storage.js";

const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const ATTACHMENT_MIME_TYPES = Object.keys(MIME_TO_EXT);
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_KEY_PATTERN = /^leave-attachments\/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|webp)$/i;

export const isPdfMime = (mime) => String(mime || "").toLowerCase() === "application/pdf";

export const leaveAttachmentsStorage = {
  async upload(file) {
    if (!config.s3.bucket || !config.s3.accessKeyId) {
      throw new AppError("Attachment storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
    }
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new AppError("Use PDF, PNG, JPG or WebP", 400, "INVALID_ATTACHMENT_TYPE");
    }
    const key = `leave-attachments/${randomUUID()}.${ext}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return {
      key,
      url: s3PublicUrl(key),
      name: String(file.originalname || `attachment.${ext}`).slice(0, 180),
      mime: file.mimetype,
    };
  },
};

export const sanitizeAttachment = (body = {}) => {
  const key = String(body.attachmentKey || "").trim();
  if (!key) {
    return { attachmentKey: "", attachmentUrl: "", attachmentName: "", attachmentMime: "" };
  }
  if (!ATTACHMENT_KEY_PATTERN.test(key)) {
    return { attachmentKey: "", attachmentUrl: "", attachmentName: "", attachmentMime: "" };
  }
  return {
    attachmentKey: key,
    attachmentUrl: s3PublicUrl(key) || String(body.attachmentUrl || "").trim(),
    attachmentName: String(body.attachmentName || "Attachment").slice(0, 180),
    attachmentMime: String(body.attachmentMime || "").trim(),
  };
};
