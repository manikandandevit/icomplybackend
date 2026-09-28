import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, details->>'countryId' as orig_country, company_name
      FROM public.ca_employees
      WHERE company_name ILIKE '%Standard Global%'
    `);
    
    console.log("Employees with mismatching establishment and original country:");
    for (const r of res.rows) {
      if (r.establishment_name === 'Standard Global - Singapore HQ') {
        console.log(`- ${r.name}: est=${r.establishment_name}, orig_country=${r.orig_country}`);
      }
    }

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
