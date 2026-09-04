/**
 * Clear CA HR masters and seed 2 records per operation country.
 * Usage: node scripts/seed-hr-masters.js [companyId]
 */
import "dotenv/config";
import pg from "pg";

const COMPANY_ID = Number.parseInt(process.argv[2] || "7", 10);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const insert = async (client, row) => {
  const { rows } = await client.query(
    `
    INSERT INTO public.ca_hr_masters (
      master_type, name, related_id, start_time, end_time, total_hours, break_time,
      multiplier, days, code, country_id, country_name, eligible_gender_id,
      min_hours, max_hours, created_by_company_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )
    RETURNING id, name, country_id
    `,
    [
      row.master_type,
      row.name,
      row.related_id ?? null,
      row.start_time ?? null,
      row.end_time ?? null,
      row.total_hours ?? null,
      row.break_time ?? null,
      row.multiplier ?? null,
      row.days ?? null,
      row.code ?? null,
      row.country_id,
      row.country_name,
      row.eligible_gender_id ?? null,
      row.min_hours ?? null,
      row.max_hours ?? null,
      COMPANY_ID,
    ]
  );
  return rows[0];
};

const resolveCountries = async (client, rawCountries) => {
  const listed = (
    await client.query(`SELECT id, name FROM public.country ORDER BY id`)
  ).rows.map((r) => ({ id: String(r.id), name: r.name }));

  const byId = new Map(listed.map((c) => [c.id, c]));
  const byName = new Map(listed.map((c) => [c.name.trim().toLowerCase(), c]));
  const legacy = { in: "india", sg: "singapore", my: "malaysia", th: "thailand", vn: "vietnam" };

  const out = [];
  for (const raw of rawCountries) {
    const key = String(raw ?? "").trim();
    if (!key) continue;
    const match =
      byId.get(key) ||
      byName.get(key.toLowerCase()) ||
      byName.get(legacy[key.toLowerCase()] || "");
    if (!match) continue;
    if (out.some((c) => c.id === match.id)) continue;
    out.push(match);
  }
  return out;
};

async function main() {
  if (!Number.isInteger(COMPANY_ID) || COMPANY_ID < 1) {
    throw new Error("Invalid company id");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const company = await client.query(
      `SELECT id, legal_name, trade_name, countries FROM public.companies WHERE id = $1`,
      [COMPANY_ID]
    );
    if (!company.rows[0]) {
      throw new Error(`Company ${COMPANY_ID} not found`);
    }

    const countries = await resolveCountries(client, company.rows[0].countries || []);
    if (countries.length === 0) {
      throw new Error("No countries of operation on this company");
    }

    console.log("Seeding company:", company.rows[0].legal_name);
    console.log(
      "Countries:",
      countries.map((c) => `${c.name}(${c.id})`).join(", ")
    );

    const deleted = await client.query(
      `DELETE FROM public.ca_hr_masters WHERE created_by_company_id = $1`,
      [COMPANY_ID]
    );
    console.log(`Removed ${deleted.rowCount} existing master rows`);

    // Per-country templates: exactly 2 rows each
    const templates = {
      gender: ["Male", "Female"],
      "marital-status": ["Single", "Married"],
      "employment-type": ["Full Time", "Contract"],
      "bank-account-type": ["Savings", "Current"],
      "payment-method": ["Bank Transfer", "Cash"],
      "attendance-type": ["Present", "Absent"],
      "leave-category": ["Paid Leave", "Unpaid Leave"],
      department: ["Human Resources", "Information Technology"],
    };

    for (const country of countries) {
      const ctx = { country_id: country.id, country_name: country.name };
      const code = country.name.slice(0, 2).toUpperCase();

      const genders = {};
      for (const name of templates.gender) {
        const row = await insert(client, { master_type: "gender", name, ...ctx });
        genders[name] = row.id;
      }

      for (const name of templates["marital-status"]) {
        await insert(client, { master_type: "marital-status", name, ...ctx });
      }
      for (const name of templates["employment-type"]) {
        await insert(client, { master_type: "employment-type", name, ...ctx });
      }
      for (const name of templates["bank-account-type"]) {
        await insert(client, { master_type: "bank-account-type", name, ...ctx });
      }
      for (const name of templates["payment-method"]) {
        await insert(client, { master_type: "payment-method", name, ...ctx });
      }
      for (const name of templates["attendance-type"]) {
        await insert(client, { master_type: "attendance-type", name, ...ctx });
      }

      const categories = {};
      for (const name of templates["leave-category"]) {
        const row = await insert(client, { master_type: "leave-category", name, ...ctx });
        categories[name] = row.id;
      }

      const departments = {};
      for (const name of templates.department) {
        const row = await insert(client, { master_type: "department", name, ...ctx });
        departments[name] = row.id;
      }

      await insert(client, {
        master_type: "designation",
        name: "HR Executive",
        related_id: departments["Human Resources"],
        ...ctx,
      });
      await insert(client, {
        master_type: "designation",
        name: "Software Engineer",
        related_id: departments["Information Technology"],
        ...ctx,
      });

      await insert(client, {
        master_type: "shift-type",
        name: "General Shift",
        code: `${code}GS`,
        start_time: "09:00",
        end_time: "18:00",
        break_time: "60",
        ...ctx,
      });
      await insert(client, {
        master_type: "shift-type",
        name: "Night Shift",
        code: `${code}NS`,
        start_time: "22:00",
        end_time: "06:00",
        break_time: "60",
        ...ctx,
      });

      await insert(client, {
        master_type: "ot-type",
        name: "Normal OT",
        code: `${code}NOT`,
        multiplier: "1.5",
        min_hours: "1",
        max_hours: "4",
        ...ctx,
      });
      await insert(client, {
        master_type: "ot-type",
        name: "Double OT",
        code: `${code}DOT`,
        multiplier: "2",
        min_hours: "1",
        max_hours: "8",
        ...ctx,
      });

      await insert(client, {
        master_type: "leave-types",
        name: "Casual Leave",
        code: `${code}CL`,
        days: "12",
        related_id: categories["Paid Leave"],
        eligible_gender_id: null,
        ...ctx,
      });
      await insert(client, {
        master_type: "leave-types",
        name: "Sick Leave",
        code: `${code}SL`,
        days: "12",
        related_id: categories["Paid Leave"],
        eligible_gender_id: null,
        ...ctx,
      });
    }

    await client.query("COMMIT");

    const summary = await client.query(
      `
      SELECT master_type, country_name, count(*)::int AS c
      FROM public.ca_hr_masters
      WHERE created_by_company_id = $1
      GROUP BY master_type, country_name
      ORDER BY master_type, country_name
      `,
      [COMPANY_ID]
    );
    console.log("Seeded (2 per country):");
    console.table(summary.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
