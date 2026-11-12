import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

pg.types.setTypeParser(1082, (value) => value);

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = [
  "public.ca_leave_revokes",
  "public.ca_ot_requests",
  "public.ca_leave_requests",
  "public.ca_attendance",
];

async function clearData() {
  const client = await db.connect();
  try {
    console.log("🚀 Starting data cleanup...\n");
    for (const table of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = countRes.rows[0].count;
      await client.query(`DELETE FROM ${table}`);
      console.log(`✅ ${table} — ${count} rows deleted`);
    }
    console.log("\n🎉 All data cleared successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await db.end();
  }
}

clearData();
