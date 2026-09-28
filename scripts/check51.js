import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, details->>'citizenshipStatus' as cs
      FROM public.ca_employees
      WHERE id = 51
    `);
    
    console.log(res.rows[0]);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
