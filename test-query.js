import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT details FROM ca_employees WHERE employee_code IN ('MDS00013', 'MDS00012', 'MDS00011')").then(res => { 
  console.dir(res.rows, {depth: null}); 
  pool.end(); 
});
