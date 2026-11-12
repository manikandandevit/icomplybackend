import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await db.connect();
try {
  await client.query("BEGIN");

  // Fix check_in: add 30 minutes for all establishments 16 and 17
  const r1 = await client.query(`
    UPDATE public.ca_attendance
    SET check_in = check_in + INTERVAL '30 minutes'
    WHERE establishment_id IN (16, 17) AND check_in IS NOT NULL
  `);
  console.log(`✅ check_in updated: ${r1.rowCount} rows`);

  // Fix check_out: add 30 minutes
  const r2 = await client.query(`
    UPDATE public.ca_attendance
    SET check_out = check_out + INTERVAL '30 minutes'
    WHERE establishment_id IN (16, 17) AND check_out IS NOT NULL
  `);
  console.log(`✅ check_out updated: ${r2.rowCount} rows`);

  // Fix requested_check_in
  const r3 = await client.query(`
    UPDATE public.ca_attendance
    SET requested_check_in = requested_check_in + INTERVAL '30 minutes'
    WHERE establishment_id IN (16, 17) AND requested_check_in IS NOT NULL
  `);
  console.log(`✅ requested_check_in updated: ${r3.rowCount} rows`);

  // Fix requested_check_out
  const r4 = await client.query(`
    UPDATE public.ca_attendance
    SET requested_check_out = requested_check_out + INTERVAL '30 minutes'
    WHERE establishment_id IN (16, 17) AND requested_check_out IS NOT NULL
  `);
  console.log(`✅ requested_check_out updated: ${r4.rowCount} rows`);

  await client.query("COMMIT");

  // Verify - show a sample
  const sample = await client.query(`
    SELECT employee_name, date, check_in, check_out, status
    FROM public.ca_attendance
    WHERE establishment_id IN (16, 17) AND check_in IS NOT NULL
    ORDER BY date, employee_name
    LIMIT 5
  `);
  console.log("\n📋 Sample check (first 5 Present records):");
  sample.rows.forEach(r => {
    const cin = r.check_in ? new Date(r.check_in).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
    const cout = r.check_out ? new Date(r.check_out).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
    console.log(`  ${r.employee_name} | ${r.date} | In: ${cin} | Out: ${cout} | ${r.status}`);
  });

  console.log("\n🎉 Shift times fixed! 09:30 - 18:30");

} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ Error:", err.message);
} finally {
  client.release();
  await db.end();
}

