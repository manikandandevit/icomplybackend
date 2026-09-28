import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, details->>'countryId' as orig_country, details
      FROM public.ca_employees
      WHERE establishment_id = 2
    `);
    
    console.log("Checking countryId in details for Singapore HQ employees:");
    for(const r of res.rows) {
      console.log(`ID: ${r.id}, Name: ${r.name}, countryId: ${r.orig_country}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
