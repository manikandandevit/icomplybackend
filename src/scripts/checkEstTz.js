import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkEstablishments() {
  const r = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ca_establishments' 
      AND column_name IN ('timezone', 'country_id', 'country_name', 'id', 'name')
  `);
  console.log("Columns:", r.rows);

  const sample = await db.query(`SELECT id, name, country_id, country_name FROM public.ca_establishments`);
  console.log("Establishments:", sample.rows);

  // Add timezone column if not exists
  await db.query(`ALTER TABLE public.ca_establishments ADD COLUMN IF NOT EXISTS timezone TEXT;`);
  console.log("Ensured timezone column in ca_establishments");

  await db.end();
}

checkEstablishments().catch(console.error);

