import dotenv from "dotenv";

dotenv.config();

const required = ["JWT_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT) || 4000,
  clientOrigins: [
    "http://localhost:5173",
    "https://icomplyfront-end.vercel.app",
  ],
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "ap-south-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME,
    logoKey: process.env.S3_LOGO_KEY ?? "icomply.png",
    tabbarKey: process.env.S3_TABBAR_KEY ?? "Tabbar.png",
  },
});
