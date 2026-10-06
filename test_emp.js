import { db } from './src/core/db/pool.js';
db.query("SELECT id, name FROM public.ca_employees WHERE name = 'Priya Sharma'").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
