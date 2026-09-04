import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const companies = await pool.query(
    `SELECT id, legal_name, trade_name, countries, address_country_id, status
     FROM public.companies
     ORDER BY id
     LIMIT 40`
  );
  console.log("COMPANIES", JSON.stringify(companies.rows, null, 2));

  const masters = await pool.query(
    `SELECT created_by_company_id, master_type, count(*)::int AS c
     FROM public.ca_hr_masters
     GROUP BY 1, 2
     ORDER BY 1, 2`
  );
  console.log("MASTERS_BY", JSON.stringify(masters.rows, null, 2));

  const sample = await pool.query(
    `SELECT id, created_by_company_id, master_type, name, code, country_id, country_name, related_id, days
     FROM public.ca_hr_masters
     ORDER BY id
     LIMIT 100`
  );
  console.log("SAMPLE", JSON.stringify(sample.rows, null, 2));

  const countries = await pool.query(`SELECT id, name FROM public.country ORDER BY id`);
  console.log("COUNTRIES", JSON.stringify(countries.rows, null, 2));

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND (table_name ILIKE '%ca_%' OR table_name ILIKE '%establish%')
     ORDER BY table_name`
  );
  console.log("CA_TABLES", tables.rows.map((r) => r.table_name));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
