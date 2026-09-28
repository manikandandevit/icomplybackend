import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, establishment_id, details->>'countryId' as orig_country
      FROM public.ca_employees
      WHERE establishment_id = 2
    `);
    
    console.log(`Singapore HQ has ${res.rows.length} employees`);
    for(const r of res.rows) {
      console.log(`- ID: ${r.id}, Name: ${r.name}, countryId: ${r.orig_country}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
