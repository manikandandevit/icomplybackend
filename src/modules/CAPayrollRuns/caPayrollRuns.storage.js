import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";

const MIME_TO_EXT = {
  "application/pdf": "pdf",
};

export const s3PublicUrl = (key) => {
  const endpoint = String(config.s3.endpoint || "")
    .replace(/\/+$/, "")
    .replace(/\/s3$/i, "");
  const bucket = config.s3.bucket;

  if (!endpoint || !bucket || !key) {
    return null;
  }

  return `${endpoint}/object/public/${bucket}/${key}`;
};

export const challanStorage = {
  async upload(file) {
    if (!config.s3.bucket || !config.s3.accessKeyId) {
      throw new AppError("Storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new AppError("Only PDF files are allowed", 400, "INVALID_FILE_TYPE");
    }
    
    if (file.size > 2 * 1024 * 1024) {
      throw new AppError("File size must be below 2MB", 400, "FILE_TOO_LARGE");
    }

    const key = `challans/${randomUUID()}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000",
      }),
    );

    return {
      key,
      url: s3PublicUrl(key),
    };
  }
};
