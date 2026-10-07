import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT a.date, a.check_in, a.check_out, o.id as ot_id, o.hours as ot_hours, o.total_working_hours, o.work_hours FROM ca_attendance a LEFT JOIN ca_ot_requests o ON a.employee_id = o.employee_id AND a.date::date = o.date::date WHERE a.employee_id = (SELECT id FROM ca_employees WHERE employee_code = 'MDS00013') ORDER BY a.date DESC LIMIT 5").then(res => { 
  console.dir(res.rows, {depth: null}); 
  pool.end(); 
});
