import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "./s3.client.js";
import { s3PublicUrl } from "../../modules/Companies/companies.storage.js";

/**
 * Employee documents used to be stored as base64 data URLs inside
 * ca_employees.details.documents, which made every employee API response
 * several MB. These helpers move such documents to S3 and keep only the
 * public URL + key in the database.
 */

const KEY_PREFIX = "employee-documents";
const DATA_URL_PATTERN = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s;

const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

export const isStorageConfigured = () => Boolean(config.s3.bucket && config.s3.accessKeyId);

export const isBase64Document = (doc) =>
  Boolean(doc && typeof doc === "object" && typeof doc.url === "string" && doc.url.startsWith("data:"));

const parseDataUrl = (dataUrl) => {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) return null;
  const mime = (match[1] || "application/octet-stream").toLowerCase();
  return { mime, buffer: Buffer.from(match[2], "base64") };
};

/** Uploads one base64 document to S3 and returns the stored metadata. */
export const uploadBase64Document = async (doc) => {
  const parsed = parseDataUrl(doc.url);
  if (!parsed) {
    throw new Error("Invalid document data URL");
  }

  const ext = MIME_TO_EXT[parsed.mime] || "bin";
  const key = `${KEY_PREFIX}/${randomUUID()}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: parsed.buffer,
      ContentType: parsed.mime,
    }),
  );

  return {
    ...doc,
    url: s3PublicUrl(key),
    key,
    mime: parsed.mime,
    size: doc.size ?? parsed.buffer.length,
  };
};

/**
 * Returns a copy of `details` where every base64 document has been moved to S3.
 * Never blocks a save: if storage is not configured or an upload fails, that
 * document is kept as it was and the error is logged.
 */
export const offloadEmployeeDocuments = async (details) => {
  if (!details || typeof details !== "object" || !Array.isArray(details.documents)) {
    return details;
  }
  if (!details.documents.some(isBase64Document)) {
    return details;
  }
  if (!isStorageConfigured()) {
    console.warn("[employeeDocuments] S3 is not configured; documents kept as base64");
    return details;
  }

  const documents = [];
  for (const doc of details.documents) {
    if (!isBase64Document(doc)) {
      documents.push(doc);
      continue;
    }
    try {
      documents.push(await uploadBase64Document(doc));
    } catch (error) {
      console.error("[employeeDocuments] Upload failed; document kept as base64", error?.message || error);
      documents.push(doc);
    }
  }

  return { ...details, documents };
};
