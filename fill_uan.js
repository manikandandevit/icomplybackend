import { db } from "./src/core/db/pool.js";

async function fillUan() {
  try {
    const query = `
      UPDATE public.ca_employees
      SET details = jsonb_set(COALESCE(details, '{}'::jsonb), '{uanNumber}', to_jsonb(('1000' || id::text)::text), true)
      WHERE establishment_id IN (
        SELECT id FROM public.ca_establishments WHERE lower(country_name) = 'india'
      );
    `;
    const res = await db.query(query);
    console.log(`Updated ${res.rowCount} Indian employees with a dummy UAN number.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fillUan();
