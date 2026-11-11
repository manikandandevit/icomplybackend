import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_KEY_PATTERN = /^employee-photos\/[0-9a-f-]{36}\.(png|jpg|webp)$/i;

const assertStorage = () => {
  if (!config.s3.bucket || !config.s3.accessKeyId) {
    throw new AppError("Photo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
  }
};

/** Employee profile photos in S3: employee-photos/<uuid>.<ext>. */
export const employeePhotoStorage = {
  async upload(file) {
    assertStorage();
    const ext = MIME_TO_EXT[String(file?.mimetype || "").toLowerCase()];
    if (!ext) throw new AppError("Use a PNG, JPG or WebP image", 400, "INVALID_PHOTO_TYPE");
    if (!file.size || file.size > PHOTO_MAX_BYTES) {
      throw new AppError("Photo must be below 2 MB", 400, "PHOTO_TOO_LARGE");
    }

    const key = `employee-photos/${randomUUID()}.${ext}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return key;
  },

  async get(key) {
    assertStorage();
    const response = await s3Client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    return { body: response.Body, contentType: response.ContentType || "image/jpeg" };
  },
};

/** API path of an employee photo (changes when the photo changes). */
export const employeePhotoUrl = (employeeId, key) => {
  const match = String(key || "").match(/([0-9a-f-]{36})\./i);
  return key && match ? `/ca-employees/${employeeId}/photo?v=${match[1].slice(0, 8)}` : null;
};
