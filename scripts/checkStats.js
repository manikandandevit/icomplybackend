import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, establishment_name, details->>'citizenshipStatus' as cs, details->>'countryId' as c_id
      FROM public.ca_employees
      WHERE establishment_id = 2
    `);
    
    let stats = {
      'Singapore Citizen': 0,
      'Singapore PR': 0,
      'Foreigner': 0
    };
    
    for(const r of res.rows) {
      if(stats[r.cs] !== undefined) stats[r.cs]++;
    }
    
    console.log(`Total SG HQ employees: ${res.rows.length}`);
    console.log(stats);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
