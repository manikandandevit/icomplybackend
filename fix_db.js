import { db } from './src/core/db/pool.js';

async function run() {
  try {
    const res = await db.query(`
      UPDATE ca_employees 
      SET details = jsonb_set(details, '{shiftEndTime}', '"18:00"'::jsonb) 
      WHERE details->>'shiftStartTime' = '09:00' 
        AND details->>'shiftEndTime' = '06:00'
    `);
    console.log("Updated rows:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
