import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkMonths() {
  const att = await db.query(`SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count FROM public.ca_attendance GROUP BY 1 ORDER BY 1`);
  const leave = await db.query(`SELECT TO_CHAR(start_date, 'YYYY-MM') as month, COUNT(*) as count FROM public.ca_leave_requests GROUP BY 1 ORDER BY 1`);
  const ot = await db.query(`SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count FROM public.ca_ot_requests GROUP BY 1 ORDER BY 1`);
  const revoke = await db.query(`SELECT TO_CHAR(start_date, 'YYYY-MM') as month, COUNT(*) as count FROM public.ca_leave_revokes GROUP BY 1 ORDER BY 1`);

  console.log("=== DB DATA SUMMARY ===");
  console.log("Attendance Months:", att.rows);
  console.log("Leave Request Months:", leave.rows);
  console.log("OT Request Months:", ot.rows);
  console.log("Leave Revoke Months:", revoke.rows);

  await db.end();
}

checkMonths().catch(console.error);

