import { randomUUID } from "crypto";
import { AppError } from "../../core/errors/AppError.js";

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Checks an uploaded profile photo (stored in the database, ca_employees.photo_data).
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

/** API path of an employee photo (changes when the photo changes); null if none. */
export const employeePhotoUrl = (employeeId, version) =>
  version ? `/ca-employees/${employeeId}/photo?v=${version}` : null;
