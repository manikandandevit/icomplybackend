import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT details
      FROM public.ca_employees
      WHERE id = 51
    `);
    
    console.log(JSON.stringify(res.rows[0].details, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
