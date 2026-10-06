import { db } from "./src/core/db/pool.js";
import { syncOtRequest } from "./src/modules/CAAttendance/caAttendanceOtSync.js";

async function backfillOt() {
  try {
    const { rows } = await db.query(`SELECT id, created_by_company_id FROM ca_attendance WHERE check_out IS NOT NULL`);
    for (const row of rows) {
      await syncOtRequest(row.created_by_company_id, row.id);
    }
    console.log(`Synced ${rows.length} attendance records for OT`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
backfillOt();
