import('./src/core/db/pool.js').then(async ({db}) => { 
  try { 
    const res = await db.query(
      'INSERT INTO public.ca_candidates (name, initials, details, role, match, stage, source, applied, assessment_count, email, phone, experience, location, skills, created_by_company_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *', 
      ['Test', 'TE', 'Test', 'Role', 90, 'Applied', 'Website', '10 Sep', 0, 'e@e.com', '123', 'Fresher', 'Loc', JSON.stringify(['React']), 1]
    ); 
    console.log('Inserted:', res.rows[0]); 
    process.exit(0); 
  } catch(e) { 
    console.error('Error:', e); 
    process.exit(1); 
  } 
});
