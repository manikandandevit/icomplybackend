import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const res = await db.query(`
  SELECT id, employee_code, name, establishment_id, establishment_name, 
         created_by_company_id, details->>'reportingToId' as reporting_to_id,
         details->>'reportingToName' as reporting_to_name
  FROM public.ca_employees 
  WHERE establishment_id = 17 
  ORDER BY id
`);
res.rows.forEach(r => console.log(JSON.stringify(r)));
await db.end();
