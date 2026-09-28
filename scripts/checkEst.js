import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const estRes = await db.query(`
      SELECT id, name, company_id, company_name, country_id, country_name
      FROM public.ca_establishments
      WHERE company_name ILIKE '%Standard Global%'
    `);
    
    console.log(`Found ${estRes.rows.length} establishments for Standard Global.`);
    for (const r of estRes.rows) {
      console.log(`- ${r.name} (ID: ${r.id})`);
    }

    const empRes = await db.query(`
      SELECT id, name, establishment_name, establishment_id, company_name
      FROM public.ca_employees
      WHERE company_name ILIKE '%Standard Global%'
    `);

    let byEst = {};
    for (const row of empRes.rows) {
      byEst[row.establishment_name] = (byEst[row.establishment_name] || 0) + 1;
    }
    console.log("Employees by establishment:", byEst);

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
