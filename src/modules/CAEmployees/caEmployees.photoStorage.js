import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { s3PublicUrl } from "../Companies/companies.storage.js";
import { AppError } from "../../core/errors/AppError.js";

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Checks an uploaded profile photo.
 * Returns { data, mime, version }.
 */
export const preparePhoto = (file) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (!file?.buffer || !PHOTO_TYPES.includes(mime)) {
    throw new AppError("Use a PNG, JPG or WebP image", 400, "INVALID_PHOTO_TYPE");
  }
  if (!file.size || file.size > PHOTO_MAX_BYTES) {
    throw new AppError("Photo must be below 2 MB", 400, "PHOTO_TOO_LARGE");
  }
  return { data: file.buffer, mime: mime === "image/jpg" ? "image/jpeg" : mime, version: randomUUID().slice(0, 8) };
};

/**
 * Uploads employee profile photo to S3 and returns S3 URL + metadata.
 */
export const uploadEmployeePhotoToS3 = async (file, employeeId) => {
  if (!config.s3.bucket) {
    return null;
  }
  const mime = String(file?.mimetype || "").toLowerCase();
  const ext = MIME_TO_EXT[mime] || "jpg";
  const version = randomUUID().slice(0, 8);
  const key = `employee-photos/${employeeId}-${version}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: mime === "image/jpg" ? "image/jpeg" : mime,
    })
  );

  const url = s3PublicUrl(key) || `https://${config.s3.bucket}.s3.${config.s3.region || "ap-south-1"}.amazonaws.com/${key}`;
  return { key, url, version, mime };
};

/** API path of an employee photo (changes when the photo changes); null if none. */
export const employeePhotoUrl = (employeeId, version, photoUrl) =>
  photoUrl || (version ? `/ca-employees/${employeeId}/photo?v=${version}` : null);
