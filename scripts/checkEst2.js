import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const estRes = await db.query(`
      SELECT id, name, company_id, company_name, country_id, country_name
      FROM public.ca_establishments
      WHERE company_name ILIKE '%Standard Global%'
    `);
    
    for (const r of estRes.rows) {
      console.log(`- ${r.name} (Est ID: ${r.id}, Country ID: ${r.country_id})`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
