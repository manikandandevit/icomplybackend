import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const LOGO_MIME_TYPES = Object.keys(MIME_TO_EXT);
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_KEY_PATTERN = /^companies\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|svg)$/i;

export const companiesStorage = {
  async upload(file) {
    if (!config.s3.bucket || !config.s3.accessKeyId) {
      throw new AppError("Logo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new AppError("Use PNG, JPG, SVG or WebP", 400, "INVALID_LOGO_TYPE");
    }

    const key = `companies/${randomUUID()}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return { key };
  },

  async get(key) {
    if (!config.s3.bucket || !config.s3.accessKeyId) {
      throw new AppError("Logo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
    }

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
      })
    );

    return {
      body: response.Body,
      contentType: response.ContentType || "image/png",
    };
  },
};
