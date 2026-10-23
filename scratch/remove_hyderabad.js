import { db } from "../src/core/db/pool.js";

async function run() {
  try {
    console.log("Removing Hyderabad and updating to Innodha India Office (Chennai) & Innodha Singapore...");

    // 1. Update 'Senior Software Engineer' from Hyderabad to Innodha India Office (Chennai, India)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '6', establishment_name = 'Innodha India Office', location = 'Chennai, India'
      WHERE created_by_company_id = 2 AND position = 'Senior Software Engineer';
    `);

    // 2. Update 'HR Business Partner' from Hyderabad to Innodha Singapore (Singapore)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '7', establishment_name = 'Innodha Singapore', location = 'Singapore'
      WHERE created_by_company_id = 2 AND position = 'HR Business Partner';
    `);

    // 3. Update candidates (Arjun Mehta) from Hyderabad to Innodha India Office (Chennai, India)
    await db.query(`
      UPDATE public.ca_candidates
      SET establishment_id = '6',
          establishment_name = 'Innodha India Office',
          location = 'Chennai, India',
          details = CONCAT(COALESCE(NULLIF(experience, ''), '0 yrs'), ' · Chennai, India')
      WHERE role = 'Senior Software Engineer' AND created_by_company_id = 2;
    `);

    // 4. Verify no candidate has Hyderabad
    const candCheck = await db.query(`
      SELECT id, name, role, created_by_company_id, establishment_id, establishment_name, location, details
      FROM public.ca_candidates
      ORDER BY id DESC;
    `);
    console.log("ALL CANDIDATES AFTER HYDERABAD REMOVAL:");
    console.table(candCheck.rows);

    // 5. Verify no requisition has Hyderabad
    const reqCheck = await db.query(`
      SELECT id, req_id, position, created_by_company_id, establishment_id, establishment_name, location
      FROM public.ca_job_requisitions
      WHERE created_by_company_id = 2
      ORDER BY id;
    `);
    console.log("COMPANY 2 REQUISITIONS:");
    console.table(reqCheck.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
