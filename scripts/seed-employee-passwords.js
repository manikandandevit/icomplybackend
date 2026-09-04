import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const DEFAULT_PASSWORD = "Employee@123";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  await client.query(`
    ALTER TABLE public.ca_employees ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE public.ca_employees ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
  `);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const { rowCount } = await client.query(
    `
    UPDATE public.ca_employees
    SET
      password_hash = COALESCE(password_hash, $1),
      must_reset_password = COALESCE(must_reset_password, TRUE)
    WHERE password_hash IS NULL OR must_reset_password IS NULL
    `,
    [hash],
  );

  // Ensure free-trial companies without trial_started_at get created_at as start
  await client.query(`
    UPDATE public.companies
    SET trial_started_at = COALESCE(trial_started_at, created_at)
    WHERE plan <> 'Standard' AND trial_started_at IS NULL
  `);

  console.log(`Updated employee passwords (touched rows approx ${rowCount}). Default: ${DEFAULT_PASSWORD}`);
} finally {
  client.release();
  await pool.end();
}
