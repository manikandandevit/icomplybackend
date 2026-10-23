import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { s3PublicUrl } from "../Companies/companies.storage.js";

export const caCandidatesStorage = {
  async upload(file) {
    const originalName = file.originalname || "resume.pdf";
    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!config.s3.bucket || !config.s3.accessKeyId) {
      const dataUrl = `data:${file.mimetype || "application/pdf"};base64,${file.buffer.toString("base64")}`;
      return {
        key: null,
        url: dataUrl,
        name: originalName,
        mime: file.mimetype || "application/pdf",
      };
    }

    try {
      const key = `candidate-resumes/${Date.now()}-${randomUUID()}-${cleanName}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/pdf",
        })
      );

      const publicUrl = s3PublicUrl(key) || key;

      return {
        key,
        url: publicUrl,
        name: originalName,
        mime: file.mimetype || "application/pdf",
      };
    } catch (err) {
      console.warn("S3 resume upload failed, falling back to data URL:", err.message);
      const dataUrl = `data:${file.mimetype || "application/pdf"};base64,${file.buffer.toString("base64")}`;
      return {
        key: null,
        url: dataUrl,
        name: originalName,
        mime: file.mimetype || "application/pdf",
      };
    }
  },

  async get(key) {
    if (!config.s3.bucket || !config.s3.accessKeyId) {
      return null;
    }

    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
        })
      );

      return {
        stream: response.Body,
        contentType: response.ContentType || "application/pdf",
      };
    } catch (err) {
      console.error("Failed to get resume from S3:", err.message);
      return null;
    }
  },
};
