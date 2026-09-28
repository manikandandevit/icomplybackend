import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    // Find the Singapore HQ establishment
    const estRes = await db.query(`
      SELECT id, name, company_id, company_name, country_id, country_name
      FROM public.ca_establishments
      WHERE name ILIKE '%Singapore HQ%'
      LIMIT 1
    `);
    
    if (estRes.rows.length === 0) {
      console.log("Singapore HQ establishment not found.");
      process.exit(1);
    }
    
    const est = estRes.rows[0];
    console.log("Found establishment:", est.name, "ID:", est.id);
    
    // Get 20 employees
    const empRes = await db.query(`
      SELECT id, details
      FROM public.ca_employees
      WHERE company_name ILIKE '%Standard Global%'
      LIMIT 20
    `);
    
    console.log(`Found ${empRes.rows.length} employees to update.`);
    
    let count = 0;
    for (const row of empRes.rows) {
      let details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
      
      let status = '';
      if (count < 7) {
        status = 'Singapore Citizen';
      } else if (count < 15) {
        status = 'Singapore PR';
      } else {
        status = 'Foreigner';
      }
      
      details.citizenshipStatus = status;
      if (status !== 'Foreigner') {
        details.singpass = 'SP' + Math.floor(10000000 + Math.random() * 90000000);
      } else {
        details.singpass = '';
      }
      
      // We also update the establishment ID and name for these 20 employees
      await db.query(`
        UPDATE public.ca_employees 
        SET 
          details = $1,
          establishment_id = $2,
          establishment_name = $3,
          company_id = $4,
          company_name = $5
        WHERE id = $6
      `, [details, est.id, est.name, est.company_id, est.company_name, row.id]);
      
      count++;
    }
    
    console.log(`Successfully updated exactly ${count} employees to Singapore HQ with the specified citizenship distribution.`);
    
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
