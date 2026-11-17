import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";
import { s3PublicUrl } from "../Companies/companies.storage.js";

export const FILING_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const FILING_DOC_MAX_FILES = 10;

const safeExt = (name) => {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ""));
  return match ? match[1].toLowerCase() : "bin";
};

export const filingDocumentsStorage = {
  async upload(file, { companyId, country }) {
    if (!config.s3.bucket) {
      throw new AppError("Document storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
    }
    const key = `filing-documents/${companyId}/${country.toLowerCase()}/${randomUUID()}.${safeExt(file.originalname)}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }),
    );
    return { key, url: s3PublicUrl(key) };
  },

  async get(key) {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    return { body: response.Body, contentType: response.ContentType || "application/octet-stream" };
  },

  async remove(key) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    } catch (error) {
      console.warn("[filingDocuments] S3 delete failed:", error?.message || error);
    }
  },
};
