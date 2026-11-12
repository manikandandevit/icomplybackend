import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verifyDb() {
  const client = await db.connect();
  try {
    const tzRes = await client.query("SHOW timezone;");
    console.log("=== DB TIMEZONE ===");
    console.log("Current timezone:", tzRes.rows[0].TimeZone);

    const tables = ['ca_attendance', 'ca_leave_requests', 'ca_ot_requests', 'ca_leave_revokes', 'ca_notifications'];
    console.log("\n=== COLUMN TYPES ===");
    for (const t of tables) {
      const colRes = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND data_type LIKE '%timestamp%'
        ORDER BY column_name;
      `, [t]);
      console.log(`\nTable: ${t}`);
      colRes.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    }
  } catch (err) {
    console.error("DB check error:", err);
  } finally {
    client.release();
    await db.end();
  }
}

verifyDb();

