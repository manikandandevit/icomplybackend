import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, details
      FROM public.ca_employees
      WHERE id = 32
    `);
    
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
