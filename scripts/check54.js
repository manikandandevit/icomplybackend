import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, establishment_id, details->>'countryId' as orig_country, details
      FROM public.ca_employees
      WHERE id = 54
    `);
    
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
