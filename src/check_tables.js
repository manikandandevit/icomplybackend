import { db } from './core/db/pool.js';
async function run() {
  const { rows } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");
  console.log(rows.map(r => r.table_name).join(', '));
  process.exit(0);
}
run();
