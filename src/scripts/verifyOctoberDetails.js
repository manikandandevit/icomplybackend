import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verifyDetails() {
  const pendingLeaves = await db.query(`SELECT COUNT(*) FROM public.ca_leave_requests WHERE status = 'Pending'`);
  const pendingRevokes = await db.query(`SELECT COUNT(*) FROM public.ca_leave_revokes WHERE status = 'Pending'`);
  const pendingOt = await db.query(`SELECT COUNT(*) FROM public.ca_ot_requests WHERE status = 'Pending'`);
  const pendingReg = await db.query(`SELECT COUNT(*) FROM public.ca_attendance WHERE regularization_status = 'Pending'`);

  console.log("=== PENDING VERIFICATION ===");
  console.log("Pending Leaves:", pendingLeaves.rows[0].count);
  console.log("Pending Revokes:", pendingRevokes.rows[0].count);
  console.log("Pending OT:", pendingOt.rows[0].count);
  console.log("Pending Regularization:", pendingReg.rows[0].count);

  const sample = await db.query(`
    SELECT employee_name, date::text, 
      to_char(check_in AT TIME ZONE 'Asia/Singapore', 'HH24:MI') as sg_in,
      to_char(check_out AT TIME ZONE 'Asia/Singapore', 'HH24:MI') as sg_out,
      status, regularization_status
    FROM public.ca_attendance
    WHERE establishment_id = 16 AND employee_id = 106
    ORDER BY date LIMIT 10
  `);
  console.log("\n=== SAMPLE ETHAN TAN (SINGAPORE) ATTENDANCE ===");
  sample.rows.forEach(r => console.log(`  ${r.date} | In: ${r.sg_in || '----'} | Out: ${r.sg_out || '----'} | Status: ${r.status} | RegStatus: ${r.regularization_status || '-'}`));

  await db.end();
}

verifyDetails().catch(console.error);

