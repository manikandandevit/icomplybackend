/**
 * Seed holiday types + 2026 holidays (All + country-wise).
 * Usage: node scripts/seed-holidays.js [companyId]
 * Omit companyId to seed every company.
 */
import "dotenv/config";
import pg from "pg";

pg.types.setTypeParser(1082, (value) => value);

const ARG_ID = process.argv[2] ? Number.parseInt(process.argv[2], 10) : null;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const LEGACY = {
  in: "india",
  ind: "india",
  india: "india",
  sg: "singapore",
  singapore: "singapore",
  my: "malaysia",
  malaysia: "malaysia",
  th: "thailand",
  thailand: "thailand",
  vn: "vietnam",
  vietnam: "vietnam",
};

const TYPE_NAMES = ["Public", "Restricted"];

const ALL_HOLIDAYS = [
  { name: "New Year's Day", start: "2026-01-01", end: "2026-01-01", type: "Public" },
  { name: "Labour Day", start: "2026-05-01", end: "2026-05-01", type: "Public" },
  { name: "Christmas Day", start: "2026-12-25", end: "2026-12-25", type: "Public" },
];

const COUNTRY_HOLIDAYS = {
  india: [
    { name: "Republic Day", start: "2026-01-26", end: "2026-01-26", type: "Public" },
    { name: "Maha Shivaratri", start: "2026-02-15", end: "2026-02-15", type: "Restricted" },
    { name: "Holi", start: "2026-03-03", end: "2026-03-04", type: "Restricted" },
    { name: "Id-ul-Fitr", start: "2026-03-21", end: "2026-03-21", type: "Restricted" },
    { name: "Good Friday", start: "2026-04-03", end: "2026-04-03", type: "Restricted" },
    { name: "Independence Day", start: "2026-08-15", end: "2026-08-15", type: "Public" },
    { name: "Janmashtami", start: "2026-09-04", end: "2026-09-04", type: "Restricted" },
    { name: "Ganesh Chaturthi", start: "2026-09-14", end: "2026-09-14", type: "Restricted" },
    { name: "Gandhi Jayanti", start: "2026-10-02", end: "2026-10-02", type: "Public" },
    { name: "Dussehra", start: "2026-10-21", end: "2026-10-21", type: "Restricted" },
    { name: "Diwali", start: "2026-11-08", end: "2026-11-09", type: "Public" },
    { name: "Guru Nanak Jayanti", start: "2026-11-24", end: "2026-11-24", type: "Restricted" },
  ],
  singapore: [
    { name: "Chinese New Year", start: "2026-02-17", end: "2026-02-18", type: "Public" },
    { name: "Hari Raya Puasa", start: "2026-03-21", end: "2026-03-21", type: "Public" },
    { name: "Good Friday", start: "2026-04-03", end: "2026-04-03", type: "Public" },
    { name: "Hari Raya Haji", start: "2026-05-27", end: "2026-05-27", type: "Public" },
    { name: "Vesak Day", start: "2026-05-31", end: "2026-05-31", type: "Public" },
    { name: "National Day", start: "2026-08-09", end: "2026-08-09", type: "Public" },
    { name: "Deepavali", start: "2026-11-08", end: "2026-11-08", type: "Public" },
  ],
  malaysia: [
    { name: "Chinese New Year", start: "2026-02-17", end: "2026-02-18", type: "Public" },
    { name: "Hari Raya Aidilfitri", start: "2026-03-21", end: "2026-03-22", type: "Public" },
    { name: "Hari Raya Haji", start: "2026-05-27", end: "2026-05-27", type: "Public" },
    { name: "Wesak Day", start: "2026-05-31", end: "2026-05-31", type: "Public" },
    { name: "Agong's Birthday", start: "2026-06-06", end: "2026-06-06", type: "Public" },
    { name: "National Day", start: "2026-08-31", end: "2026-08-31", type: "Public" },
    { name: "Malaysia Day", start: "2026-09-16", end: "2026-09-16", type: "Public" },
    { name: "Deepavali", start: "2026-11-08", end: "2026-11-08", type: "Public" },
  ],
  thailand: [
    { name: "Makha Bucha Day", start: "2026-03-03", end: "2026-03-03", type: "Public" },
    { name: "Chakri Memorial Day", start: "2026-04-06", end: "2026-04-06", type: "Public" },
    { name: "Songkran Festival", start: "2026-04-13", end: "2026-04-15", type: "Public" },
    { name: "Coronation Day", start: "2026-05-04", end: "2026-05-04", type: "Public" },
    { name: "King's Birthday", start: "2026-07-28", end: "2026-07-28", type: "Public" },
    { name: "Queen Suthida's Birthday", start: "2026-06-03", end: "2026-06-03", type: "Public" },
  ],
  vietnam: [
    { name: "Tet Holiday", start: "2026-02-16", end: "2026-02-20", type: "Public" },
    { name: "Hung Kings Commemoration", start: "2026-04-26", end: "2026-04-26", type: "Public" },
    { name: "Reunification Day", start: "2026-04-30", end: "2026-04-30", type: "Public" },
    { name: "National Day", start: "2026-09-02", end: "2026-09-02", type: "Public" },
  ],
};

const ensureTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.ca_holidays (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      holiday_date DATE NOT NULL,
      end_date DATE,
      holiday_type_id INTEGER NOT NULL,
      holiday_type_name TEXT NOT NULL,
      country_id TEXT NOT NULL DEFAULT 'all',
      country_name TEXT NOT NULL DEFAULT 'All',
      created_by_company_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE public.ca_holidays ADD COLUMN IF NOT EXISTS end_date DATE`);
  await client.query(`UPDATE public.ca_holidays SET end_date = holiday_date WHERE end_date IS NULL`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ca_holidays_company_date
      ON public.ca_holidays (created_by_company_id, holiday_date)
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_holidays_company_date_country_name
      ON public.ca_holidays (
        created_by_company_id,
        holiday_date,
        COALESCE(country_id, 'all'),
        lower(name)
      )
  `);
};

const resolveCountries = (listed, rawCountries) => {
  const byId = new Map(listed.map((c) => [String(c.id), c]));
  const byName = new Map(listed.map((c) => [c.name.trim().toLowerCase(), c]));
  const out = [];
  for (const raw of rawCountries || []) {
    const key = String(raw ?? "").trim();
    if (!key) continue;
    const match = byId.get(key) || byName.get(key.toLowerCase()) || byName.get(LEGACY[key.toLowerCase()] || "");
    if (!match) continue;
    if (out.some((c) => String(c.id) === String(match.id))) continue;
    out.push({ id: String(match.id), name: match.name });
  }
  return out;
};

const ensureTypes = async (client, companyId) => {
  const map = {};
  for (const name of TYPE_NAMES) {
    const existing = await client.query(
      `
      SELECT id, name FROM public.ca_hr_masters
      WHERE created_by_company_id = $1 AND master_type = 'holiday-type'
        AND lower(name) = lower($2) AND COALESCE(country_id, 'all') = 'all'
      LIMIT 1
      `,
      [companyId, name],
    );
    if (existing.rows[0]) {
      map[name] = existing.rows[0];
      continue;
    }
    const inserted = await client.query(
      `
      INSERT INTO public.ca_hr_masters (master_type, name, country_id, country_name, created_by_company_id)
      VALUES ('holiday-type', $1, 'all', 'All', $2)
      RETURNING id, name
      `,
      [name, companyId],
    );
    map[name] = inserted.rows[0];
  }
  return map;
};

const insertHoliday = async (client, companyId, types, holiday, country) => {
  const type = types[holiday.type] || types.Public;
  await client.query(
    `
    INSERT INTO public.ca_holidays (
      name, holiday_date, end_date, holiday_type_id, holiday_type_name,
      country_id, country_name, created_by_company_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (created_by_company_id, holiday_date, COALESCE(country_id, 'all'), lower(name))
    DO UPDATE SET
      end_date = EXCLUDED.end_date,
      holiday_type_id = EXCLUDED.holiday_type_id,
      holiday_type_name = EXCLUDED.holiday_type_name,
      country_name = EXCLUDED.country_name,
      updated_at = NOW()
    `,
    [
      holiday.name,
      holiday.start,
      holiday.end,
      type.id,
      type.name,
      country.id,
      country.name,
      companyId,
    ],
  );
};

async function seedCompany(client, company, listed) {
  const countries = resolveCountries(listed, company.countries || []);
  const types = await ensureTypes(client, company.id);
  let count = 0;

  for (const holiday of ALL_HOLIDAYS) {
    await insertHoliday(client, company.id, types, holiday, { id: "all", name: "All" });
    count += 1;
  }

  for (const country of countries) {
    const key = country.name.trim().toLowerCase();
    const items = COUNTRY_HOLIDAYS[key] || [];
    for (const holiday of items) {
      await insertHoliday(client, company.id, types, holiday, country);
      count += 1;
    }
  }

  return { companyId: company.id, name: company.trade_name || company.legal_name, countries: countries.map((c) => c.name), count };
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const listed = (await client.query(`SELECT id, name FROM public.country ORDER BY id`)).rows;
    const companies = (
      await client.query(
        ARG_ID
          ? `SELECT id, legal_name, trade_name, countries FROM public.companies WHERE id = $1`
          : `SELECT id, legal_name, trade_name, countries FROM public.companies ORDER BY id`,
        ARG_ID ? [ARG_ID] : [],
      )
    ).rows;

    if (companies.length === 0) {
      throw new Error("No company found");
    }

    await client.query("BEGIN");
    const results = [];
    for (const company of companies) {
      results.push(await seedCompany(client, company, listed));
    }
    await client.query("COMMIT");
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
