import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT date FROM ca_attendance LIMIT 1").then(res => { 
  console.log(res.rows[0].date.toISOString()); 
  pool.end(); 
});
