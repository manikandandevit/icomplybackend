import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, details
      FROM public.ca_employees
      WHERE company_name ILIKE '%Standard Global%' AND establishment_name != 'Standard Global - Singapore HQ'
    `);
    
    let count = 0;
    for(const r of res.rows) {
      let details = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
      if (details.citizenshipStatus !== undefined || details.singpass !== undefined) {
        delete details.citizenshipStatus;
        delete details.singpass;
        await db.query(`UPDATE public.ca_employees SET details = $1 WHERE id = $2`, [details, r.id]);
        count++;
      }
    }
    console.log(`Cleaned up ${count} non-Singapore employees.`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
