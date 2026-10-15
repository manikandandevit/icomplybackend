import { db } from './core/db/pool.js';
async function run() {
  const { rows } = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ca_candidates';");
  console.log(rows);
  process.exit(0);
}
run();
