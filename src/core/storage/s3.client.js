import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";

export const s3Client = new S3Client({
  region: config.s3.region,
  ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
  ...(config.s3.accessKeyId && config.s3.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        },
      }
    : {}),
});
