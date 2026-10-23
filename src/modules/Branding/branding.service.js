import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, "../../assets/branding");

const getLocalFallback = (key) => {
  const filename = path.basename(key);
  const localPath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(localPath)) {
    return {
      body: fs.createReadStream(localPath),
      contentType: filename.endsWith(".svg") ? "image/svg+xml" : "image/png",
    };
  }
  return null;
};

const getObject = async (key) => {
  try {
    if (config.s3.bucket && config.s3.accessKeyId) {
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
    }
  } catch (err) {
    console.warn(`S3 fetch failed for "${key}", using local fallback:`, err?.message);
    const fallback = getLocalFallback(key);
    if (fallback) return fallback;
    throw err;
  }

  const fallback = getLocalFallback(key);
  if (fallback) return fallback;

  throw new AppError("Logo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
};

export const brandingService = {
  getLogo: () => getObject(config.s3.logoKey),
  getTabbar: () => getObject(config.s3.tabbarKey),
};
