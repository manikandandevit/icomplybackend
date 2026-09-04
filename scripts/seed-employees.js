import "dotenv/config";
import pg from "pg";

const COMPANY_ID = 7;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const byType = (rows, type, countryId) =>
  rows.filter((r) => r.master_type === type && String(r.country_id) === String(countryId));

const buildDetails = ({
  countryId,
  index,
  suffix,
  estId,
  shift,
  reportingToId = "",
  reportingToName = "",
  maritalName = "",
}) => {
  const married = String(maritalName).toLowerCase().includes("married") && !String(maritalName).toLowerCase().includes("un");
  return {
    countryId: String(countryId),
    dateOfBirth: `199${index}-0${(index % 9) + 1}-1${index}`,
    fatherHusbandName: `Father ${suffix}`,
    address: `${10 + index}, Sample Street, Block ${suffix}`,
    state: "Tamil Nadu",
    city: "Chennai",
    pinCode: `60000${index + 1}`,
    childrenCount: married ? String((index % 2) + 1) : "",
    reportingToId: String(reportingToId || ""),
    reportingToName: String(reportingToName || ""),
    emergencyName: `Emergency ${suffix}`,
    emergencyRelationship: index % 2 === 0 ? "Spouse" : "Parent",
    emergencyPhone: `988870000${index + 1}`,
    emergencyAltPhone: `977770000${index + 1}`,
    emergencyAddress: `${20 + index}, Emergency Colony`,
    emergencyState: "Tamil Nadu",
    emergencyCity: "Chennai",
    emergencyPinCode: `60010${index + 1}`,
    shiftNameCode: `${shift?.name || "Shift"}-${suffix}`,
    weekOffDay: ["Sunday", "Saturday", "Friday"][index % 3],
    shiftStartTime: ["09:00", "14:00", "22:00"][index % 3],
    shiftEndTime: ["18:00", "22:00", "06:00"][index % 3],
    breakTime: String([60, 45, 30][index % 3]),
  };
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE public.ca_employees
        ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    const { rows: establishments } = await client.query(
      `
      SELECT id, name, company_id, company_source, company_name, country_id, country_name
      FROM public.ca_establishments
      WHERE created_by_company_id = $1
      ORDER BY id
      `,
      [COMPANY_ID],
    );

    if (establishments.length === 0) {
      throw new Error("No establishments found for company 7");
    }

    const { rows: masters } = await client.query(
      `
      SELECT id, master_type, name, country_id, related_id, multiplier, code
      FROM public.ca_hr_masters
      WHERE created_by_company_id = $1
      ORDER BY id
      `,
      [COMPANY_ID],
    );

    await client.query(
      `DELETE FROM public.ca_employees WHERE created_by_company_id = $1 AND employee_code LIKE 'SEED-%'`,
      [COMPANY_ID],
    );

    let created = 0;
    /** @type {{ id: number, establishmentId: number, name: string }[]} */
    const createdRows = [];

    for (const est of establishments) {
      const countryId = String(est.country_id);
      const employmentTypes = byType(masters, "employment-type", countryId);
      const shifts = byType(masters, "shift-type", countryId);
      const ots = byType(masters, "ot-type", countryId);
      const departments = byType(masters, "department", countryId);
      const designations = byType(masters, "designation", countryId);
      const genders = byType(masters, "gender", countryId);
      const marital = byType(masters, "marital-status", countryId);
      const bankTypes = byType(masters, "bank-account-type", countryId);

      if (
        employmentTypes.length === 0 ||
        shifts.length === 0 ||
        departments.length === 0 ||
        designations.length === 0 ||
        genders.length === 0 ||
        marital.length === 0
      ) {
        console.warn(`Skip establishment ${est.id} — missing masters for country ${countryId}`);
        continue;
      }

      const templates = [
        {
          suffix: "A",
          name: "Arun Kumar",
          email: `arun.${est.id}@innodha.test`,
          mobile: "9876500001",
          employment: employmentTypes[0],
          shift: shifts[0],
          ot: ots[0] || null,
          otApplicable: Boolean(ots[0]),
        },
        {
          suffix: "B",
          name: "Bhavya Shah",
          email: `bhavya.${est.id}@innodha.test`,
          mobile: "9876500002",
          employment: employmentTypes[1] || employmentTypes[0],
          shift: shifts[1] || shifts[0],
          ot: ots[1] || ots[0] || null,
          otApplicable: Boolean(ots[1] || ots[0]),
        },
        {
          suffix: "C",
          name: "Chitra Devi",
          email: `chitra.${est.id}@innodha.test`,
          mobile: "9876500003",
          employment: employmentTypes[employmentTypes.length - 1],
          shift: shifts[shifts.length - 1],
          ot: null,
          otApplicable: false,
        },
      ];

      const estCreated = [];

      for (const [index, t] of templates.entries()) {
        const dept = departments[index % departments.length];
        const desig =
          designations.find((d) => String(d.related_id) === String(dept.id)) ||
          designations[index % designations.length];
        const gender = genders[index % genders.length];
        const maritalStatus = marital[index % marital.length];
        const bankType = bankTypes[index % Math.max(bankTypes.length, 1)] || null;
        const code = `SEED-${est.id}-${t.suffix}`;

        // First employee reports to self placeholder empty; later ones report to first in same establishment
        const manager = estCreated[0] || null;

        const details = buildDetails({
          countryId,
          index,
          suffix: t.suffix,
          estId: est.id,
          shift: t.shift,
          reportingToId: manager ? String(manager.id) : "",
          reportingToName: manager ? manager.name : "",
          maritalName: maritalStatus.name,
        });

        const bankDetails = [
          {
            id: `bank-${est.id}-${t.suffix}`,
            bankAccountTypeId: bankType ? String(bankType.id) : "",
            bankAccountTypeName: bankType?.name || "Savings",
            accountNumber: `10020030${est.id}${index}`,
            ifscCode: "SBIN0001234",
            bankNameBranch: "Sbi, Test Branch",
          },
        ];

        const { rows } = await client.query(
          `
          INSERT INTO public.ca_employees (
            employee_code, name, email, mobile, join_date, status,
            company_id, company_source, company_name,
            establishment_id, establishment_name,
            department_id, department_name,
            designation_id, designation_name,
            employment_type_id, employment_type_name,
            shift_type_id, shift_type_name,
            ot_applicable, ot_type_id, ot_type_name,
            gender_id, gender_name, marital_status_id, marital_status_name,
            bank_details, details, created_by_company_id
          ) VALUES (
            $1,$2,$3,$4, CURRENT_DATE, 'Active',
            $5,$6,$7,
            $8,$9,
            $10,$11,
            $12,$13,
            $14,$15,
            $16,$17,
            $18,$19,$20,
            $21,$22,$23,$24,
            $25::jsonb, $26::jsonb, $27
          )
          RETURNING id, name, establishment_id
          `,
          [
            code,
            t.name,
            t.email,
            t.mobile,
            est.company_id,
            est.company_source,
            est.company_name || "Company",
            est.id,
            est.name,
            dept.id,
            dept.name,
            desig.id,
            desig.name,
            t.employment.id,
            t.employment.name,
            t.shift.id,
            t.shift.name,
            t.otApplicable,
            t.otApplicable && t.ot ? t.ot.id : null,
            t.otApplicable && t.ot ? t.ot.name : null,
            gender.id,
            gender.name,
            maritalStatus.id,
            maritalStatus.name,
            JSON.stringify(bankDetails),
            JSON.stringify(details),
            COMPANY_ID,
          ],
        );

        const row = rows[0];
        estCreated.push({ id: row.id, name: row.name, establishmentId: row.establishment_id });
        createdRows.push({ id: row.id, name: row.name, establishmentId: row.establishment_id });
        created += 1;
        console.log(
          `+ ${code} @ ${est.name} | ${t.employment.name} | ${t.shift.name} | OT ${
            t.otApplicable ? t.ot?.name || "yes" : "no"
          } | reporting: ${details.reportingToName || "-"}`,
        );
      }

      // First employee reports to second (circular peer manager) so Reporting To is filled for all
      if (estCreated.length >= 2) {
        const first = estCreated[0];
        const second = estCreated[1];
        await client.query(
          `
          UPDATE public.ca_employees
          SET details = jsonb_set(
            jsonb_set(COALESCE(details, '{}'::jsonb), '{reportingToId}', to_jsonb($2::text), true),
            '{reportingToName}', to_jsonb($3::text), true
          ),
          updated_at = NOW()
          WHERE id = $1
          `,
          [first.id, String(second.id), second.name],
        );
        console.log(`  ↻ ${first.name} reports to ${second.name}`);
      }
    }

    // Also fill any non-seed employees that have empty details
    const { rows: incomplete } = await client.query(
      `
      SELECT e.*, est.country_id
      FROM public.ca_employees e
      LEFT JOIN public.ca_establishments est ON est.id = e.establishment_id
      WHERE e.created_by_company_id = $1
        AND (e.details IS NULL OR e.details = '{}'::jsonb OR COALESCE(e.details->>'dateOfBirth','') = '')
      `,
      [COMPANY_ID],
    );

    for (const [index, emp] of incomplete.entries()) {
      const countryId = String(emp.country_id || "");
      const peers = createdRows.filter(
        (r) => String(r.establishmentId) === String(emp.establishment_id) && r.id !== emp.id,
      );
      const manager = peers[0] || null;
      const shifts = byType(masters, "shift-type", countryId);
      const shift = shifts.find((s) => String(s.id) === String(emp.shift_type_id)) || shifts[0];
      const details = buildDetails({
        countryId,
        index: index % 3,
        suffix: emp.employee_code?.slice(-1) || "X",
        estId: emp.establishment_id,
        shift: shift || { name: emp.shift_type_name || "General" },
        reportingToId: manager ? String(manager.id) : "",
        reportingToName: manager ? manager.name : "",
        maritalName: emp.marital_status_name || "",
      });

      await client.query(
        `
        UPDATE public.ca_employees
        SET details = $2::jsonb, updated_at = NOW()
        WHERE id = $1
        `,
        [emp.id, JSON.stringify(details)],
      );
      console.log(`~ filled details for ${emp.employee_code} (${emp.name})`);
    }

    // Sync establishment employee counts
    await client.query(
      `
      UPDATE public.ca_establishments est
      SET employee_count = (
        SELECT COUNT(*)::int FROM public.ca_employees e
        WHERE e.establishment_id = est.id AND e.created_by_company_id = est.created_by_company_id
      )
      WHERE est.created_by_company_id = $1
      `,
      [COMPANY_ID],
    );

    await client.query("COMMIT");
    console.log(`\nCreated ${created} employees with full details`);
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
