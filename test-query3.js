import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT * FROM ca_ot_requests WHERE id IN (1673, 1678)").then(res => { 
  console.dir(res.rows, {depth: null}); 
  pool.end(); 
});
