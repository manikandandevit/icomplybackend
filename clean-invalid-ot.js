import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixInvalidOtRequests() {
  try {
    // Delete auto-generated OT requests that incorrectly have 9 hours
    const result = await pool.query(`
      DELETE FROM ca_ot_requests 
      WHERE source = 'auto' 
      AND reason = 'Auto-calculated from attendance' 
      AND (hours = 9 OR ot_hours = '9')
    `);
    console.log(`Deleted ${result.rowCount} invalid auto-generated OT requests with 9 hours.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

fixInvalidOtRequests();
