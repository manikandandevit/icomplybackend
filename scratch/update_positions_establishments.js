import { db } from "../src/core/db/pool.js";

async function run() {
  try {
    // 1. Update Company 3 requisitions
    const resComp3 = await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '10', establishment_name = 'MDS Tech'
      WHERE created_by_company_id = 3;
    `);
    console.log('Updated Comp 3 requisitions:', resComp3.rowCount);

    // 2. Update Company 2 requisitions
    const resComp2_1 = await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '1', establishment_name = 'Standard Global - India Operations'
      WHERE created_by_company_id = 2 AND position = 'HR Business Partner';
    `);
    console.log('Updated Comp 2 HR req:', resComp2_1.rowCount);

    const resComp2_6 = await db.query(`
      UPDATE public.ca_job_requisitions
      SET establishment_id = '6', establishment_name = 'Innodha India Office'
      WHERE created_by_company_id = 2 AND (establishment_id IS NULL OR establishment_id = '');
    `);
    console.log('Updated Comp 2 other reqs:', resComp2_6.rowCount);

    // 3. Update ca_candidates based on their role matching requisition position
    const resCands = await db.query(`
      UPDATE public.ca_candidates c
      SET establishment_id = r.establishment_id,
          establishment_name = r.establishment_name
      FROM public.ca_job_requisitions r
      WHERE LOWER(TRIM(c.role)) = LOWER(TRIM(r.position))
        AND (c.created_by_company_id = r.created_by_company_id OR c.created_by_company_id IS NULL)
        AND r.establishment_id IS NOT NULL;
    `);
    console.log('Updated candidates matching requisitions:', resCands.rowCount);

    // Update candidate 29 (Arjun Mehta)
    await db.query(`
      UPDATE public.ca_candidates
      SET created_by_company_id = 2, establishment_id = '6', establishment_name = 'Innodha India Office'
      WHERE id = 29;
    `);

    // 4. Update any candidate whose role matches HirePilot openings
    const resHpCands = await db.query(`
      UPDATE public.ca_candidates c
      SET establishment_id = o.establishment_id,
          establishment_name = o.establishment_name,
          created_by_company_id = COALESCE(c.created_by_company_id, o.created_by_company_id)
      FROM public.hirepilot_openings o
      WHERE LOWER(TRIM(c.role)) = LOWER(TRIM(o.role_name))
        AND (c.establishment_id IS NULL OR c.establishment_id = '')
        AND o.establishment_id IS NOT NULL;
    `);
    console.log('Updated candidates matching hirepilot openings:', resHpCands.rowCount);

    // Display results
    const reqs = await db.query(`
      SELECT id, req_id, position, created_by_company_id, establishment_id, establishment_name 
      FROM public.ca_job_requisitions 
      ORDER BY created_by_company_id, id;
    `);
    console.log('JOB REQUISITIONS AFTER UPDATE:');
    console.table(reqs.rows);

    const cands = await db.query(`
      SELECT id, name, role, created_by_company_id, establishment_id, establishment_name 
      FROM public.ca_candidates 
      ORDER BY id;
    `);
    console.log('CANDIDATES AFTER UPDATE:');
    console.table(cands.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
}

run();
