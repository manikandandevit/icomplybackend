import { db } from "../src/core/db/pool.js";

async function run() {
  try {
    console.log("Ensuring Vikram Reddy, Neha Gupta, and Anjali Patel exist in ca_candidates...");

    // 1. Vikram Reddy (Senior Software Engineer -> Innodha India Office, Chennai)
    const vrCheck = await db.query("SELECT id FROM public.ca_candidates WHERE LOWER(name) = 'vikram reddy'");
    if (vrCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO public.ca_candidates (
          name, initials, details, role, match, stage, source, applied,
          email, phone, experience, location, skills,
          establishment_id, establishment_name, created_by_company_id
        ) VALUES (
          'Vikram Reddy', 'VR', '7 yrs · Chennai, India', 'Senior Software Engineer', 79, 'Screening', 'Referral', '09 Sep 2026',
          'vikram.reddy@techmail.com', '9840123456', '7 yrs', 'Chennai, India', '["Java", "Spring Boot", "React", "PostgreSQL"]'::jsonb,
          '6', 'Innodha India Office', 2
        );
      `);
      console.log("Inserted Vikram Reddy into ca_candidates");
    } else {
      await db.query(`
        UPDATE public.ca_candidates
        SET establishment_id = '6', establishment_name = 'Innodha India Office', location = 'Chennai, India', details = '7 yrs · Chennai, India'
        WHERE LOWER(name) = 'vikram reddy';
      `);
      console.log("Updated Vikram Reddy in ca_candidates");
    }

    // 2. Neha Gupta (Data Analyst -> Innodha Singapore, Singapore)
    const ngCheck = await db.query("SELECT id FROM public.ca_candidates WHERE LOWER(name) = 'neha gupta'");
    if (ngCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO public.ca_candidates (
          name, initials, details, role, match, stage, source, applied,
          email, phone, experience, location, skills,
          establishment_id, establishment_name, created_by_company_id
        ) VALUES (
          'Neha Gupta', 'NG', '3 yrs · Singapore', 'Data Analyst', 85, 'Assessment', 'LinkedIn', '12 Sep 2026',
          'neha.gupta@analytics.sg', '+65 8123 4567', '3 yrs', 'Singapore', '["Python", "SQL", "Tableau", "PowerBI"]'::jsonb,
          '7', 'Innodha Singapore', 2
        );
      `);
      console.log("Inserted Neha Gupta into ca_candidates");
    } else {
      await db.query(`
        UPDATE public.ca_candidates
        SET establishment_id = '7', establishment_name = 'Innodha Singapore', location = 'Singapore', details = '3 yrs · Singapore'
        WHERE LOWER(name) = 'neha gupta';
      `);
      console.log("Updated Neha Gupta in ca_candidates");
    }

    // 3. Anjali Patel (HR Business Partner -> Innodha Singapore, Singapore)
    const apCheck = await db.query("SELECT id FROM public.ca_candidates WHERE LOWER(name) = 'anjali patel'");
    if (apCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO public.ca_candidates (
          name, initials, details, role, match, stage, source, applied,
          email, phone, experience, location, skills,
          establishment_id, establishment_name, created_by_company_id
        ) VALUES (
          'Anjali Patel', 'AP', '4 yrs · Singapore', 'HR Business Partner', 74, 'Applied', 'Naukri', '14 Sep 2026',
          'anjali.patel@hrmail.sg', '+65 9234 5678', '4 yrs', 'Singapore', '["Talent Acquisition", "Employee Relations", "HR Operations"]'::jsonb,
          '7', 'Innodha Singapore', 2
        );
      `);
      console.log("Inserted Anjali Patel into ca_candidates");
    } else {
      await db.query(`
        UPDATE public.ca_candidates
        SET establishment_id = '7', establishment_name = 'Innodha Singapore', location = 'Singapore', details = '4 yrs · Singapore'
        WHERE LOWER(name) = 'anjali patel';
      `);
      console.log("Updated Anjali Patel in ca_candidates");
    }

    const all = await db.query(`
      SELECT id, name, role, created_by_company_id, establishment_id, establishment_name, location 
      FROM public.ca_candidates 
      ORDER BY id DESC;
    `);
    console.log("ALL CANDIDATES NOW IN DATABASE:");
    console.table(all.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
