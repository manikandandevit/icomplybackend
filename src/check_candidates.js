import { db } from './core/db/pool.js';
async function run() {
  const { rows } = await db.query("SELECT candidate_id, sections FROM public.ca_onboarding_joiner_progress WHERE candidate_id = '53' OR candidate_id = 'Ramya' OR candidate_id = 'CAND-53';");
  console.log('Ramya DB rows:', JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
