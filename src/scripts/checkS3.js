import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Get columns
const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='companies' AND table_schema='public'`);
console.log("companies columns:", cols.rows.map(x => x.column_name).join(", "));

const r = await db.query(`SELECT * FROM public.companies LIMIT 2`);
console.log("companies data:", JSON.stringify(r.rows, null, 2));

await db.end();
