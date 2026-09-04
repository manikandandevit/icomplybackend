import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const company = (
  await pool.query("SELECT id, email, countries FROM public.companies WHERE id = 7")
).rows[0];
const masterCountries = (await pool.query("SELECT id, name FROM public.country")).rows.map((r) => ({
  id: String(r.id),
  name: r.name,
}));

const byId = new Map(masterCountries.map((c) => [String(c.id), c]));
const byName = new Map(masterCountries.map((c) => [c.name.trim().toLowerCase(), c]));
const saved = Array.isArray(company.countries) ? company.countries : [];
const options = [];
for (const raw of saved) {
  const key = String(raw).trim();
  const match = byId.get(key) || byName.get(key.toLowerCase());
  console.log("raw", raw, "key", key, "match", match);
  if (!match) continue;
  options.push({ value: match.id, label: match.name });
}
console.log("options", options);
console.log("email", company.email);
await pool.end();
