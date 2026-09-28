import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, establishment_id, details->>'countryId' as orig_country
      FROM public.ca_employees
      WHERE (details->>'countryId') = '2' AND establishment_id != 2
    `);
    
    console.log(`Found ${res.rows.length} Singapore employees not in Singapore HQ`);
    for(const r of res.rows) {
      console.log(r);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
