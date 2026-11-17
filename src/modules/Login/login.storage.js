import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES, s3PublicUrl } from "../Companies/companies.storage.js";

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const SUPER_ADMIN_LOGO_MIME_TYPES = LOGO_MIME_TYPES;
export const SUPER_ADMIN_LOGO_MAX_BYTES = LOGO_MAX_BYTES;

/** Uploads the super admin logo to S3 and returns its public URL. */
export const uploadSuperAdminLogo = async (file, superAdminId) => {
  if (!config.s3.bucket) {
    throw new AppError("Logo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
  }
  const ext = MIME_TO_EXT[file?.mimetype];
  if (!file?.buffer || !ext) {
    throw new AppError("Use PNG, JPG, SVG or WebP", 400, "INVALID_LOGO_TYPE");
  }

  const key = `super-admin/${superAdminId}-${randomUUID()}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return { key, url: s3PublicUrl(key) };
};

const SUPER_ADMIN_LOGO_KEY_PATTERN = /(super-admin\/[A-Za-z0-9-]+\.(?:png|jpg|webp|svg))(?:\?.*)?$/i;

/** S3 key of a logo uploaded through Settings, read from the stored URL. */
export const superAdminLogoKey = (imageUrl) => {
  const match = SUPER_ADMIN_LOGO_KEY_PATTERN.exec(String(imageUrl || ""));
  return match ? match[1] : null;
};

/**
 * The bucket is private, so browsers load the logo through the API.
 * Returns the API path for an uploaded logo, or the stored URL unchanged.
 */
export const superAdminImageUrl = (id, imageUrl) => {
  const key = superAdminLogoKey(imageUrl);
  if (!key) {
    return imageUrl || null;
  }
  const version = key.slice(key.lastIndexOf("-") + 1, key.lastIndexOf("."));
  return `/login/super-admin/${id}/logo?v=${version}`;
};

export const getSuperAdminLogo = async (imageUrl) => {
  const key = superAdminLogoKey(imageUrl);
  if (!key || !config.s3.bucket) {
    throw new AppError("Logo not found", 404, "LOGO_NOT_FOUND");
  }
  const response = await s3Client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
  return { body: response.Body, contentType: response.ContentType || "image/png" };
};
