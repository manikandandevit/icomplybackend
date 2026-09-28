import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, company_name, details->>'citizenshipStatus' as cs
      FROM public.ca_employees
      WHERE establishment_name ILIKE '%Singapore HQ%'
    `);
    
    console.log(`Found ${res.rows.length} employees in Singapore HQ.`);
    for (const r of res.rows) {
      console.log(`- ${r.name}, Status: ${r.cs}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
