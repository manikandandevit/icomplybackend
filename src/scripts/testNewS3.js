import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

console.log("Testing S3 connection...");
console.log("Endpoint:", process.env.S3_ENDPOINT);
console.log("Bucket:", process.env.S3_BUCKET_NAME);

try {
  const res = await client.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME,
    MaxKeys: 30,
  }));
  console.log("Connection success!");
  console.log("Total objects in bucket:", res.KeyCount);
  if (res.Contents && res.Contents.length > 0) {
    res.Contents.forEach(c => console.log(` - ${c.Key} (${c.Size} bytes)`));
  } else {
    console.log("Bucket is currently empty.");
  }
} catch (err) {
  console.error("S3 Test Failed:", err);
}

