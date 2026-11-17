import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "./s3.client.js";
import { s3PublicUrl } from "../../modules/Companies/companies.storage.js";

const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Uploads all base64-encoded candidate / offer documents to S3,
 * replacing dataUrl with S3 public URL.
 */
export const offloadCandidateDocuments = async (documents, targetId = "general") => {
  if (!Array.isArray(documents) || !config.s3.bucket) {
    return documents;
  }
  const processed = [];
  for (const doc of documents) {
    const rawData = doc.dataUrl || (typeof doc.url === "string" && doc.url.startsWith("data:") ? doc.url : null);
    if (rawData) {
      try {
        const matches = rawData.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s);
        if (matches) {
          const mime = (matches[1] || doc.type || "application/octet-stream").toLowerCase();
          const buffer = Buffer.from(matches[2], "base64");
          const ext = MIME_TO_EXT[mime] || (mime.includes("pdf") ? "pdf" : mime.includes("image") ? "jpg" : "bin");
          const key = `candidate-documents/${targetId}/${randomUUID()}.${ext}`;

          await s3Client.send(
            new PutObjectCommand({
              Bucket: config.s3.bucket,
              Key: key,
              Body: buffer,
              ContentType: mime,
            })
          );

          const publicUrl = s3PublicUrl(key) || `https://${config.s3.bucket}.s3.${config.s3.region || "ap-south-1"}.amazonaws.com/${key}`;

          processed.push({
            ...doc,
            url: publicUrl,
            key,
            dataUrl: undefined,
          });
          continue;
        }
      } catch (err) {
        console.warn("[candidateDocuments] S3 upload failed:", err?.message || err);
      }
    }
    processed.push(doc);
  }
  return processed;
};
