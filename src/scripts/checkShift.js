import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// All attendance with times for est 16
const r16 = await db.query(`
  SELECT employee_name, date::text,
    to_char(check_in AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') as ci,
    to_char(check_out AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') as co,
    status
  FROM public.ca_attendance
  WHERE establishment_id = 16
  ORDER BY employee_name, date
`);

console.log("=== Est 16 (Oct 2026) All Records ===");
let prevEmp = "";
for (const r of r16.rows) {
  if (r.employee_name !== prevEmp) { console.log(`\n${r.employee_name}:`); prevEmp = r.employee_name; }
  console.log(`  ${r.date} | In: ${r.ci || "----"} | Out: ${r.co || "----"} | ${r.status}`);
}

await db.end();
