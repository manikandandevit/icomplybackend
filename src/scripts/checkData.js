import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Get employees for establishment 16
const empRes = await db.query(`
  SELECT id, employee_code, name, establishment_id, establishment_name, 
         created_by_company_id, details, status
  FROM public.ca_employees 
  WHERE establishment_id = 16 
  ORDER BY id
`);
console.log("=== EMPLOYEES ===");
empRes.rows.forEach(r => console.log(JSON.stringify({ id: r.id, name: r.name, code: r.employee_code, company_id: r.created_by_company_id, details: r.details })));

// Get leave types
try {
  const ltRes = await db.query(`SELECT id, name FROM public.ca_leave_types LIMIT 20`);
  console.log("\n=== LEAVE TYPES ===");
  ltRes.rows.forEach(r => console.log(JSON.stringify(r)));
} catch(e) {
  console.log("leave types table error:", e.message);
  // Try hr master
  try {
    const hrRes = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%leave%'`);
    console.log("Leave related tables:", hrRes.rows);
  } catch(e2) { console.log(e2.message); }
}

await db.end();

