import { db } from "../src/core/db/pool.js";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, details, establishment_name, company_name
      FROM public.ca_employees
    `);
    
    let updatedCount = 0;
    
    for (const row of res.rows) {
      const establishmentName = row.establishment_name || "";
      const companyName = row.company_name || "";
      
      if (establishmentName.toLowerCase().includes('singapore') || companyName.toLowerCase().includes('standard global')) {
        let details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
        
        const statuses = ['Singapore Citizen', 'Singapore PR', 'Foreigner'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        details.citizenshipStatus = randomStatus;
        if (randomStatus !== 'Foreigner') {
          details.singpass = 'SP' + Math.floor(10000000 + Math.random() * 90000000);
        } else {
          details.singpass = '';
        }
        
        await db.query(`
          UPDATE public.ca_employees 
          SET details = $1 
          WHERE id = $2
        `, [details, row.id]);
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} employees successfully.`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
