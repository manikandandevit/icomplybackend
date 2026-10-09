import { db } from './src/core/db/pool.js';
db.query(`SELECT establishment_id, statutory_name, rules FROM ca_statutory_configs WHERE statutory_name = 'LWF'`)
  .then(r => console.log(JSON.stringify(r.rows, null, 2)))
  .catch(console.error)
  .finally(() => process.exit());
