import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    // 1. Get all establishments for Standard Global
    const estRes = await db.query(`
      SELECT id, name, company_id, company_name, country_id, country_name
      FROM public.ca_establishments
      WHERE company_name ILIKE '%Standard Global%'
    `);
    const estMapByCountry = {};
    for (const est of estRes.rows) {
      estMapByCountry[String(est.country_id)] = est;
    }
    
    // 2. Fix all employees who are in Singapore HQ but their orig_country != 2
    const mismatches = await db.query(`
      SELECT id, name, details->>'countryId' as orig_country
      FROM public.ca_employees
      WHERE establishment_name = 'Standard Global - Singapore HQ' 
        AND (details->>'countryId') != '2'
    `);
    
    let restored = 0;
    for (const emp of mismatches.rows) {
      const origCountry = String(emp.orig_country);
      const correctEst = estMapByCountry[origCountry];
      if (correctEst) {
        await db.query(`
          UPDATE public.ca_employees
          SET establishment_id = $1, establishment_name = $2
          WHERE id = $3
        `, [correctEst.id, correctEst.name, emp.id]);
        restored++;
        
        // Also clear out any bogus citizenship/singpass data added by mistake
        const empRec = await db.query(`SELECT details FROM public.ca_employees WHERE id = $1`, [emp.id]);
        let details = typeof empRec.rows[0].details === 'string' ? JSON.parse(empRec.rows[0].details) : (empRec.rows[0].details || {});
        delete details.citizenshipStatus;
        delete details.singpass;
        await db.query(`UPDATE public.ca_employees SET details = $1 WHERE id = $2`, [details, emp.id]);
      }
    }
    console.log(`Restored ${restored} employees to their correct non-Singapore establishments.`);
    
    // 3. Now we should have exactly the correct employees in Singapore HQ
    const sgEmployees = await db.query(`
      SELECT id, name, details
      FROM public.ca_employees
      WHERE establishment_name = 'Standard Global - Singapore HQ'
    `);
    console.log(`There are now ${sgEmployees.rows.length} employees in Singapore HQ.`);
    
    // 4. Update the requested 20 employees in Singapore HQ (if they are 20)
    let sgCount = 0;
    for (const row of sgEmployees.rows) {
      let details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
      
      let status = '';
      if (sgCount < 7) {
        status = 'Singapore Citizen';
      } else if (sgCount < 15) { // 7 + 8 = 15
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
      
      await db.query(`
        UPDATE public.ca_employees 
        SET details = $1 
        WHERE id = $2
      `, [details, row.id]);
      
      sgCount++;
    }
    
    console.log(`Applied citizenship and singpass to ${sgCount} Singapore HQ employees correctly.`);

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
