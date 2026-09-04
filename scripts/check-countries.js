import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const c = await pool.query(
  "SELECT id, legal_name, countries FROM public.companies WHERE id = 7"
);
console.log("company", JSON.stringify(c.rows, null, 2));

const countries = await pool.query("SELECT id, name FROM public.country ORDER BY id");
console.log("countries", JSON.stringify(countries.rows, null, 2));

await pool.end();
