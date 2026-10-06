import { db } from './src/core/db/pool.js';
db.query("SELECT * FROM public.ca_ot_requests ORDER BY date DESC LIMIT 5").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
