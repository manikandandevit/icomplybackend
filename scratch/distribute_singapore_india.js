import { db } from "../src/core/db/pool.js";

async function run() {
  try {
    console.log("Updating requisitions with Singapore & India establishments...");

    // 1. Company 2 - Singapore Establishments
    // Innodha Singapore (ID 7)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '7', establishment_name = 'Innodha Singapore', location = 'Singapore'
      WHERE created_by_company_id = 2 AND position IN ('Product Manager', 'GEN AI Engineer', 'Data Analyst');
    `);

    // Standard Global - Singapore HQ (ID 2)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '2', establishment_name = 'Standard Global - Singapore HQ', location = 'Singapore'
      WHERE created_by_company_id = 2 AND position IN ('DevOps Engineer', 'Sales Manager');
    `);

    // 2. Company 2 - India Establishments
    // Standard Global - India Operations (ID 1 - Hyderabad)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '1', establishment_name = 'Standard Global - India Operations', location = 'Hyderabad, India'
      WHERE created_by_company_id = 2 AND position IN ('Senior Software Engineer', 'HR Business Partner');
    `);

    // Innodha India Office (ID 6 - Madurai)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '6', establishment_name = 'Innodha India Office', location = 'Madurai, India'
      WHERE created_by_company_id = 2 AND position IN ('Full Stack Developer', 'Software Developer', 'Quality Anayst', 'Softa', 'Web Developer');
    `);

    // 3. Company 3 - Singapore vs India Establishments
    // MDS-HQ (ID 9 - Singapore)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '9', establishment_name = 'MDS-HQ', location = 'Singapore'
      WHERE created_by_company_id = 3 AND position IN ('Project Manager', 'Technical Project Manager', 'Senior HR Manager');
    `);

    // Head Office (ID 8 - Woodlands, Singapore)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '8', establishment_name = 'Head Office', location = 'Woodlands, Singapore'
      WHERE created_by_company_id = 3 AND position IN ('Senior HR Executive');
    `);

    // MDS Tech (ID 10 - Bengaluru, India)
    await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '10', establishment_name = 'MDS Tech', location = 'Bengaluru, India'
      WHERE created_by_company_id = 3 AND position IN ('Java Developer', 'Senior Software Engineer', 'Product Manager', 'HR Business Partner', 'Data Analyst', 'Sales Manager', 'DevOps Engineer');
    `);

    // 4. Update hirepilot_openings to also have Singapore & India
    await db.query(`
      UPDATE public.hirepilot_openings
      SET establishment_id = '9', establishment_name = 'MDS-HQ'
      WHERE id = 12; -- Project Manager (Singapore)
    `);

    // 5. Sync ca_candidates with their updated position's establishment and location!
    await db.query(`
      UPDATE public.ca_candidates c
      SET establishment_id = r.establishment_id,
          establishment_name = r.establishment_name,
          location = r.location,
          details = CONCAT(COALESCE(NULLIF(c.experience, ''), '0 yrs'), ' · ', r.location)
      FROM public.ca_job_requisitions r
      WHERE LOWER(TRIM(c.role)) = LOWER(TRIM(r.position))
        AND (c.created_by_company_id = r.created_by_company_id OR c.created_by_company_id IS NULL)
        AND r.establishment_id IS NOT NULL;
    `);

    // Print resulting requisitions
    const reqs = await db.query(`
      SELECT id, req_id, position, created_by_company_id, establishment_id, establishment_name, location 
      FROM public.ca_job_requisitions 
      ORDER BY created_by_company_id, id;
    `);
    console.log("UPDATED REQUISITIONS (SINGAPORE & INDIA):");
    console.table(reqs.rows);

    // Print resulting candidates
    const cands = await db.query(`
      SELECT id, name, role, created_by_company_id, establishment_id, establishment_name, location 
      FROM public.ca_candidates 
      ORDER BY id DESC;
    `);
    console.log("UPDATED CANDIDATES (SINGAPORE & INDIA):");
    console.table(cands.rows);

    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
