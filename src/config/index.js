import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Accept "Production", "PRODUCTION", etc.
const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const isProd = nodeEnv === "production";
const required = isProd ? ["JWT_SECRET"] : [];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = Object.freeze({
  env: nodeEnv,
  port: Number(process.env.PORT) || 4000,
  clientOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
    : [
        "http://localhost:5173",
        "https://icomplyfront-end.vercel.app",
        "https://icomplyone.com",
        "https://www.icomplyone.com",
      ],
  jwt: {
    secret: process.env.JWT_SECRET || "icomply_jwt_secret_key_2026_super_secure_token",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "ap-south-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME ?? process.env.AWS_S3_BUCKET,
    logoKey: process.env.S3_LOGO_KEY ?? "icomply.png",
    tabbarKey: process.env.S3_TABBAR_KEY ?? "Tabbar.png",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    email: process.env.SMTP_EMAIL || process.env.SMTP_USER || "",
    password: String(process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    fromName: process.env.SMTP_FROM_NAME || "iComply HR",
  },
});
