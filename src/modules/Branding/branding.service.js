import { GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { AppError } from "../../core/errors/AppError.js";

const getObject = async (key) => {
  if (!config.s3.bucket || !config.s3.accessKeyId) {
    throw new AppError("Logo storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
  }

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
};

export const brandingService = {
  getLogo: () => getObject(config.s3.logoKey),
  getTabbar: () => getObject(config.s3.tabbarKey),
};
