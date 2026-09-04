import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const drops = [
  "uq_ca_hr_masters_company_type_name",
  "uq_ca_hr_masters_company_type_related_name",
  "uq_ca_hr_masters_company_type_code",
  "uq_ca_hr_masters_company_type_country_related_name",
  "uq_ca_hr_masters_company_type_country_code",
];

for (const name of drops) {
  await pool.query(`DROP INDEX IF EXISTS ${name}`);
  console.log("dropped", name);
}

await pool.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_hr_masters_company_type_country_related_name
  ON public.ca_hr_masters (
    created_by_company_id,
    master_type,
    COALESCE(country_id, 'all'),
    COALESCE(related_id, 0),
    lower(name)
  )
`);

await pool.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_hr_masters_company_type_country_code
  ON public.ca_hr_masters (
    created_by_company_id,
    master_type,
    COALESCE(country_id, 'all'),
    lower(code)
  )
  WHERE code IS NOT NULL AND btrim(code) <> ''
`);

console.log("country-scoped unique indexes ready");
await pool.end();
