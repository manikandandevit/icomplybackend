import { db } from "../src/core/db/pool.js";

async function run() {
  try {
    const del = await db.query(`
      DELETE FROM public.ca_offboarding_exits
      WHERE employee_id NOT IN (
        SELECT employee_id FROM public.ca_separation_requests WHERE status = 'Offboarding'
      )
    `);
    console.log("Cleaned up unlinked exits count:", del.rowCount);

    const remaining = await db.query(
      "SELECT id, employee_id, employee_name, reason, status FROM public.ca_offboarding_exits"
    );
    console.log("REMAINING EXITS IN DB:", JSON.stringify(remaining.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Cleanup error:", err);
    process.exit(1);
  }
}

run();

